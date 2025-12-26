import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';
import { Reward } from './entities/reward.entity';
import { Investment } from '../investments/entities/investment.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Property } from '../properties/entities/property.entity';
import { User } from '../admin/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { DistributeRoiDto } from './dto/distribute-roi.dto';
import { RewardDistributedEvent } from '../events/reward.events';
import { NotificationsService } from '../notifications/notifications.service';
import { TokenLock } from '../marketplace/entities/token-lock.entity';
import { MarketplaceListing } from '../marketplace/entities/marketplace-listing.entity';
import { MarketplaceTrade } from '../marketplace/entities/marketplace-trade.entity';

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Reward)
    private readonly rewardRepo: Repository<Reward>,
    private readonly eventEmitter: EventEmitter2, // Event-driven architecture
    private readonly notificationsService: NotificationsService, // Push notifications
  ) {}

  async distributeRoi(dto: DistributeRoiDto) {
    return this.dataSource.transaction(async (manager) => {
      // Fetch property and all active investments for this property
      // Check if propertyId is UUID or displayCode
      const isPropertyUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dto.propertyId);
      
      const property = await manager.findOne(Property, { 
        where: isPropertyUuid ? { id: dto.propertyId } : { displayCode: dto.propertyId } 
      });
      if (!property) {
        throw new Error('Property not found');
      }

      const investments = await manager.find(Investment, {
        where: { propertyId: property.id, status: 'confirmed' },  // Use property.id (UUID)
      });

      if (investments.length === 0) {
        throw new Error('No active investments found for this property');
      }

      const totalRoi = new Decimal(dto.totalRoiUSDT);
      const totalTokens = property.totalTokens as Decimal;
      const rewards: Reward[] = [];

      // Group investments by userId to aggregate rewards per user
      const investmentsByUser = new Map<string, Investment[]>();
      for (const investment of investments) {
        if (!investmentsByUser.has(investment.userId)) {
          investmentsByUser.set(investment.userId, []);
        }
        investmentsByUser.get(investment.userId)!.push(investment);
      }

      // Process rewards per user (aggregate all their investments)
      for (const [userId, userInvestments] of investmentsByUser) {
        // Calculate total ROI share for this user across all their investments
        // IMPORTANT: Exclude locked tokens (in active listings)
        // Note: Sold tokens are already excluded because investment.tokensPurchased is reduced when tokens are sold
        let totalAvailableTokens = new Decimal(0);

        for (const investment of userInvestments) {
          // Current tokens owned (already excludes sold tokens since tokensPurchased is reduced on sale)
          const ownedTokens = investment.tokensPurchased as Decimal;

          // Get locked tokens from active listings for this investment
          const locks = await manager
            .createQueryBuilder(TokenLock, 'lock')
            .innerJoin('lock.listing', 'listing')
            .where('lock.investment_id = :investmentId', { investmentId: investment.id })
            .andWhere('listing.status = :status', { status: 'active' })
            .getMany();

          let lockedTokens = new Decimal(0);
          for (const lock of locks) {
            lockedTokens = lockedTokens.plus(lock.lockedTokens as Decimal);
          }

          // Available tokens = owned - locked
          // (Sold tokens are already excluded from ownedTokens)
          const availableFromInvestment = ownedTokens.minus(lockedTokens);
          if (availableFromInvestment.gt(0)) {
            totalAvailableTokens = totalAvailableTokens.plus(availableFromInvestment);
          }
        }

        // If no available tokens, skip ROI for this user
        if (totalAvailableTokens.lte(0)) {
          this.logger.log(`Skipping ROI for user ${userId} - no available tokens`);
          continue;
        }

        const roiShare = totalAvailableTokens.div(totalTokens).mul(totalRoi);

        // Fetch wallet with lock
        const wallet = await manager
          .createQueryBuilder(Wallet, 'wallet')
          .where('wallet.userId = :userId', { userId })
          .setLock('pessimistic_write')
          .getOne();

        if (!wallet) {
          throw new Error(`Wallet not found for user ${userId}`);
        }

        // Credit wallet.balanceUSDT += roiShare
        wallet.balanceUSDT = (wallet.balanceUSDT as Decimal).plus(roiShare);
        await manager.save(Wallet, wallet);

        // Create one reward record per user (referencing the first investment for backward compatibility)
        const rewardResult = await manager.query('SELECT nextval(\'reward_display_seq\') as nextval');
        const rewardDisplayCode = `RWD-${rewardResult[0].nextval.toString().padStart(6, '0')}`;
        
        const reward = manager.getRepository(Reward).create({
          userId,
          investmentId: userInvestments[0].id, // Reference first investment
          amountUSDT: roiShare,
          type: 'roi',
          description: `ROI distribution for property ${property.title}`,
          status: 'distributed',
          displayCode: rewardDisplayCode,
        });
        const savedReward = await manager.save(Reward, reward);
        rewards.push(savedReward);

        // Get user display name for traceability
        const user = await manager.findOne(User, { where: { id: userId } });
        const userDisplayName = user?.fullName || user?.email || 'Unknown User';
        
        // Get organization display name for traceability
        const organization = await manager.findOne(Organization, { where: { id: property.organizationId } });
        const orgDisplayName = organization?.name || 'Unknown Organization';

        // Create one transaction per user with full traceability
        const txnResult = await manager.query('SELECT nextval(\'transaction_display_seq\') as nextval');
        const txnDisplayCode = `TXN-${txnResult[0].nextval.toString().padStart(6, '0')}`;
        
        const txn = manager.getRepository(Transaction).create({
          userId,
          walletId: wallet.id,
          organizationId: property.organizationId,
          propertyId: property.id,
          type: 'reward',
          amountUSDT: roiShare,
          status: 'completed',
          referenceId: savedReward.id,
          description: `ROI reward for ${property.title}`,
          fromEntity: orgDisplayName,  // Human-readable sender (organization)
          toEntity: userDisplayName,   // Human-readable receiver (user)
          displayCode: txnDisplayCode,
        });
        await manager.save(Transaction, txn);

        // Emit reward distributed event (replaces manual portfolio update)
        const rewardEvent: RewardDistributedEvent = {
          eventId: `rwd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          userId,
          userDisplayCode: userDisplayName,
          propertyId: property.id,
          propertyDisplayCode: property.displayCode,
          organizationId: property.organizationId,
          organizationDisplayCode: orgDisplayName,
          amountUSDT: roiShare,
          rewardId: savedReward.id,
          rewardDisplayCode: savedReward.displayCode,
          investmentId: userInvestments[0].id,
          investmentDisplayCode: userInvestments[0].displayCode,
        };

        // Emit event for listeners to handle portfolio and transaction updates
        try {
          this.eventEmitter.emit('reward.distributed', rewardEvent);
          this.logger.log(`Reward distributed event emitted for user ${userDisplayName}`);
        } catch (error) {
          this.logger.error(`Failed to emit reward distributed event for user ${userDisplayName}:`, error);
          // Don't throw - let the main operation continue
        }

        // Queue push notification for this user
        try {
          await this.notificationsService.queueNotification({
            userId,
            title: 'Reward Credited',
            message: `A new reward of ${roiShare.toFixed(6)} USDT has been added to your property investment.`,
            data: {
              type: 'reward',
              rewardId: savedReward.id,
              rewardDisplayCode: savedReward.displayCode,
              propertyId: property.id,
              propertyDisplayCode: property.displayCode,
              amountUSDT: roiShare.toString(),
              // Add URL for navigation to notifications screen
              url: '/notifications?context=portfolio',
            },
          });
          this.logger.log(`Notification queued for user ${userDisplayName}`);
        } catch (error) {
          this.logger.error(`Failed to queue notification for user ${userDisplayName}:`, error);
          // Don't throw - let the main operation continue
        }
      }

      return { rewards, count: rewards.length, totalDistributed: totalRoi.toString() };
    });
  }

  async findAll() {
    return this.rewardRepo.find({ relations: ['user', 'investment'] });
  }

  async findByUserId(userId: string) {
    // Check if userId is UUID or displayCode
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    
    if (isUuid) {
      return this.rewardRepo.find({ where: { userId }, relations: ['investment'] });
    } else {
      // It's a display code, find the user first to get their UUID
      const user = await this.dataSource.getRepository(User).findOne({ where: { displayCode: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return this.rewardRepo.find({ where: { userId: user.id }, relations: ['investment'] });
    }
  }

  async findOne(id: string) {
    return this.rewardRepo.findOne({ where: { id }, relations: ['user', 'investment'] });
  }

  async findByIdOrDisplayCode(idOrCode: string) {
    // Check if it's a UUID format (contains hyphens and is 36 chars)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode);
    
    if (isUuid) {
      return this.rewardRepo.findOne({ where: { id: idOrCode }, relations: ['user', 'investment'] });
    } else {
      return this.rewardRepo.findOne({ where: { displayCode: idOrCode }, relations: ['user', 'investment'] });
    }
  }
}
