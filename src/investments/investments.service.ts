import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';
import { Investment } from './entities/investment.entity';
import { Property } from '../properties/entities/property.entity';
import { PropertyToken } from '../properties/entities/property-token.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../admin/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { InvestDto } from './dto/invest.dto';
import { InvestmentCompletedEvent } from '../events/investment.events';
import { 
  InvestmentAnalyticsDto, 
  UserInvestmentAnalyticsDto, 
  OrganizationInvestmentAnalyticsDto, 
  UserOrganizationInvestmentAnalyticsDto 
} from './dto/investment-analytics.dto';

@Injectable()
export class InvestmentsService {
  private readonly logger = new Logger(InvestmentsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Investment)
    private readonly investmentRepo: Repository<Investment>,
    private readonly eventEmitter: EventEmitter2, // Event-driven architecture
  ) {}

  async invest(
    userId: string,
    propertyIdOrTokenId: string,
    tokensToBuy: Decimal,
    isTokenId = false,
  ) {
    // ✅ Execute transaction first, then emit event AFTER it commits
    const result = await this.dataSource.transaction(async (manager) => {
      let property: Property | null = null;
      let propertyToken: PropertyToken | null = null;
      let pricePerToken: Decimal;
      let expectedROI: Decimal;

      if (isTokenId) {
        // NEW: Investment in specific token tier
        // Step 1: Fetch and lock propertyToken (pessimistic_write)
        const isTokenUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          propertyIdOrTokenId,
        );

        propertyToken = await manager.findOne(PropertyToken, {
          where: isTokenUuid
            ? { id: propertyIdOrTokenId }
            : { displayCode: propertyIdOrTokenId },
          lock: { mode: 'pessimistic_write' },
          relations: ['property'],
        });

        if (!propertyToken) {
          throw new NotFoundException(
            `Property token not found: ${propertyIdOrTokenId}`,
          );
        }

        if (!propertyToken.isActive) {
          throw new BadRequestException(
            `Token tier ${propertyToken.displayCode} is not active`,
          );
        }

        property = propertyToken.property;
        pricePerToken = propertyToken.pricePerTokenUSDT as Decimal;
        expectedROI = propertyToken.expectedROI as Decimal;

        // Step 2: Validate availableTokens >= tokensToBuy
        if ((propertyToken.availableTokens as Decimal).lt(tokensToBuy)) {
          throw new BadRequestException('Insufficient available tokens');
        }
      } else {
        // LEGACY: Investment in property (backward compatibility)
        // Step 1: Fetch and lock property (pessimistic_write)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          propertyIdOrTokenId,
        );

        const foundProperty = await manager.findOne(Property, {
          where: isUuid
            ? { id: propertyIdOrTokenId }
            : { displayCode: propertyIdOrTokenId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!foundProperty) {
          throw new NotFoundException('Property not found');
        }

        property = foundProperty;

        pricePerToken = property.pricePerTokenUSDT as Decimal;
        expectedROI = property.expectedROI as Decimal;

        // Step 2: Validate availableTokens >= tokensToBuy
        if ((property.availableTokens as Decimal).lt(tokensToBuy)) {
          throw new BadRequestException('Insufficient available tokens');
        }
      }

      // Ensure property is not null at this point
      if (!property) {
        throw new NotFoundException('Property not found');
      }

      // Step 3: Compute amountUSDT = tokensToBuy * pricePerTokenUSDT
      const amountUSDT = pricePerToken.mul(tokensToBuy);

      // Step 4: Fetch and lock wallet
      // Check if userId is UUID or displayCode
      const isUserIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      
      let actualUserId = userId;
      let user: User;
      if (!isUserIdUuid) {
        // Find user by displayCode to get their UUID
        const foundUser = await manager.findOne(User, { where: { displayCode: userId } });
        if (!foundUser) throw new NotFoundException('User not found');
        user = foundUser;
        actualUserId = user.id;
      } else {
        // Fetch user by UUID
        const foundUser = await manager.findOne(User, { where: { id: userId } });
        if (!foundUser) throw new NotFoundException('User not found');
        user = foundUser;
      }
      
      const wallet = await manager.findOne(Wallet, {
        where: { userId: actualUserId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) throw new NotFoundException('Wallet not found');
      
      // Step 5: Validate wallet.balanceUSDT >= amountUSDT
      if ((wallet.balanceUSDT as Decimal).lt(amountUSDT)) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      // Step 6: Decrement balances atomically
      wallet.balanceUSDT = (wallet.balanceUSDT as Decimal).minus(amountUSDT);

      if (propertyToken) {
        // Decrement token tier available tokens
        propertyToken.availableTokens = (
          propertyToken.availableTokens as Decimal
        ).minus(tokensToBuy);
        await manager.save([wallet, propertyToken]);
      } else {
        // Legacy: Decrement property available tokens
        property.availableTokens = (property.availableTokens as Decimal).minus(
          tokensToBuy,
        );
        await manager.save([wallet, property]);
      }

      // Step 7: Insert investment record
      // Generate displayCode for investment
      const invResult = await manager.query('SELECT nextval(\'investment_display_seq\') as nextval');
      const invDisplayCode = `INV-${invResult[0].nextval.toString().padStart(6, '0')}`;
      
      const investment = manager.create(Investment, {
        userId: actualUserId, // Use actualUserId (UUID) not displayCode
        propertyId: property.id, // Use property.id (UUID) not displayCode
        propertyTokenId: propertyToken?.id || null, // NEW: Link to token tier if investing in token
        tokensPurchased: tokensToBuy,
        amountUSDT,
        status: 'confirmed',
        paymentStatus: 'completed',
        expectedROI: expectedROI, // Use token ROI if token investment, else property ROI
        displayCode: invDisplayCode,
      });
      const savedInvestment = await manager.save(Investment, investment);

      // Step 8: Insert transaction record
      // Generate displayCode for transaction
      const txnResult = await manager.query('SELECT nextval(\'transaction_display_seq\') as nextval');
      const txnDisplayCode = `TXN-${txnResult[0].nextval.toString().padStart(6, '0')}`;
      
      // Create and save the transaction record
      const transaction = manager.create(Transaction, {
        userId: actualUserId,
        walletId: wallet.id,
        propertyId: property.id,
        type: 'investment',
        status: 'completed',
        amountUSDT,
        displayCode: txnDisplayCode,
        description: propertyToken
          ? `Investment in ${propertyToken.name} (${propertyToken.displayCode}) - ${property.title}`
          : `Investment in ${property.title}`,
      });
      await manager.save(Transaction, transaction);
      
      // Step 9: Get organization for event emission
      const organization = await manager.findOne(Organization, {
        where: { id: property.organizationId },
      });
      if (!organization) throw new NotFoundException('Organization not found for property');

      // Return data needed for event emission (but don't emit here)
      return {
        investment: savedInvestment,
        transaction,
        user,
        property,
        propertyToken, // NEW: Include token tier info
        organization,
        actualUserId,
        tokensToBuy,
        amountUSDT,
      };
    });

      // ✅ NOW emit event AFTER transaction commits
    try {
      const investmentEvent: InvestmentCompletedEvent = {
        eventId: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        userId: result.actualUserId,
        userDisplayCode: result.user.displayCode,
        propertyId: result.property.id,
        propertyDisplayCode: result.property.displayCode,
        propertyTokenId: result.propertyToken?.id || null, // NEW: Include token tier ID
        propertyTokenDisplayCode: result.propertyToken?.displayCode || null, // NEW: Include token symbol
        organizationId: result.organization.id,
        organizationDisplayCode: result.organization.displayCode,
        tokensPurchased: result.tokensToBuy,
        amountUSDT: result.amountUSDT,
        investmentId: result.investment.id,
        investmentDisplayCode: result.investment.displayCode,
        transactionId: result.transaction.id, // Add transaction ID to event
        transactionDisplayCode: result.transaction.displayCode, // Add transaction display code
      };

      this.eventEmitter.emit('investment.completed', investmentEvent);
      this.logger.log(
        `[InvestmentsService] ✅ Investment completed event emitted for user ${result.user.displayCode}, transaction: ${result.transaction.displayCode}`,
      );
    } catch (error) {
      this.logger.error('[InvestmentsService] ❌ Failed to emit investment completed event:', error);
      // Don't throw - let the main operation continue
    }

    // Certificate generation will be handled by CertificateListener
    // listening to 'investment.completed' event

    return result.investment;
  }

  async create(dto: CreateInvestmentDto) {
    // Legacy method - convert amountUSDT to tokens for backward compatibility
    // Check if propertyId is UUID or displayCode
    const isPropertyUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dto.propertyId);
    
    const property = await this.dataSource.getRepository(Property).findOne({ 
      where: isPropertyUuid ? { id: dto.propertyId } : { displayCode: dto.propertyId } 
    });
    if (!property) throw new NotFoundException('Property not found');
    
    const amountUSDT = new Decimal(dto.amountUSDT);
    const tokensToBuy = amountUSDT.div(property.pricePerTokenUSDT as Decimal);
    
    return this.invest(dto.userId, dto.propertyId, tokensToBuy);
  }

  async findAll() {
    return this.investmentRepo.find({
      relations: ['user', 'property', 'propertyToken'],
    });
  }

  async findByUserId(userId: string) {
    // Check if userId is UUID or displayCode
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      userId,
    );

    if (isUuid) {
      return this.investmentRepo.find({
        where: { userId },
        relations: ['property', 'propertyToken'],
      });
    } else {
      // It's a display code, find the user first to get their UUID
      const user = await this.dataSource
        .getRepository(User)
        .findOne({ where: { displayCode: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return this.investmentRepo.find({
        where: { userId: user.id },
        relations: ['property', 'propertyToken'],
      });
    }
  }

  async findByOrganization(orgIdOrCode: string) {
    // Check if orgIdOrCode is UUID or displayCode
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgIdOrCode);
    
    let organizationId = orgIdOrCode;
    
    if (!isUuid) {
      // It's a display code, find the organization
      const org = await this.dataSource.getRepository(Organization).findOne({ where: { displayCode: orgIdOrCode } });
      if (!org) {
        throw new NotFoundException(`Organization with display code '${orgIdOrCode}' not found`);
      }
      organizationId = org.id;
    }
    
    // Use QueryBuilder to join with property table and filter by organizationId
    return this.investmentRepo
      .createQueryBuilder('investment')
      .leftJoinAndSelect('investment.user', 'user')
      .leftJoinAndSelect('investment.property', 'property')
      .leftJoinAndSelect('investment.propertyToken', 'propertyToken')
      .where('property.organizationId = :organizationId', { organizationId })
      .getMany();
  }

  async findOne(id: string) {
    return this.investmentRepo.findOne({
      where: { id },
      relations: ['user', 'property', 'propertyToken'],
    });
  }

  async findByIdOrDisplayCode(idOrCode: string) {
    // Check if it's a UUID format (contains hyphens and is 36 chars)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrCode,
    );

    if (isUuid) {
      return this.investmentRepo.findOne({
        where: { id: idOrCode },
        relations: ['user', 'property', 'propertyToken'],
      });
    } else {
      return this.investmentRepo.findOne({
        where: { displayCode: idOrCode },
        relations: ['user', 'property', 'propertyToken'],
      });
    }
  }

  async getUserInvestmentAnalytics(userIdOrCode: string): Promise<UserInvestmentAnalyticsDto> {
    // Check if userIdOrCode is UUID or displayCode
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userIdOrCode);
    
    let actualUserId = userIdOrCode;
    let user: User;
    
    if (!isUuid) {
      // It's a display code, find the user first to get their UUID
      const foundUser = await this.dataSource.getRepository(User).findOne({ where: { displayCode: userIdOrCode } });
      if (!foundUser) {
        throw new NotFoundException('User not found');
      }
      user = foundUser;
      actualUserId = user.id;
    } else {
      // Fetch user by UUID
      const foundUser = await this.dataSource.getRepository(User).findOne({ where: { id: userIdOrCode } });
      if (!foundUser) {
        throw new NotFoundException('User not found');
      }
      user = foundUser;
    }

    // Get all investments for the user
    const investments = await this.investmentRepo.find({
      where: { userId: actualUserId },
      relations: ['property', 'property.organization', 'propertyToken'],
      order: { createdAt: 'DESC' },
    });

    // Calculate analytics
    const analytics = this.calculateInvestmentAnalytics(investments);

    return {
      user: {
        id: user.id,
        displayCode: user.displayCode,
        fullName: user.fullName,
        email: user.email
      },
      investments,
      analytics
    };
  }

  async getOrganizationInvestmentAnalytics(orgIdOrCode: string): Promise<OrganizationInvestmentAnalyticsDto> {
    // Check if orgIdOrCode is UUID or displayCode
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgIdOrCode);
    
    let organizationId = orgIdOrCode;
    let organization: Organization;
    
    if (!isUuid) {
      // It's a display code, find the organization
      const org = await this.dataSource.getRepository(Organization).findOne({ where: { displayCode: orgIdOrCode } });
      if (!org) {
        throw new NotFoundException(`Organization with display code '${orgIdOrCode}' not found`);
      }
      organization = org;
      organizationId = org.id;
    } else {
      // Fetch organization by UUID
      const org = await this.dataSource.getRepository(Organization).findOne({ where: { id: orgIdOrCode } });
      if (!org) {
        throw new NotFoundException('Organization not found');
      }
      organization = org;
    }

    // Get all investments in properties owned by the organization
    const investments = await this.investmentRepo
      .createQueryBuilder('investment')
      .leftJoinAndSelect('investment.user', 'user')
      .leftJoinAndSelect('investment.property', 'property')
      .leftJoinAndSelect('investment.propertyToken', 'propertyToken')
      .leftJoinAndSelect('property.organization', 'organization')
      .where('property.organizationId = :organizationId', { organizationId })
      .orderBy('investment.createdAt', 'DESC')
      .getMany();

    // Calculate analytics
    const analytics = this.calculateInvestmentAnalytics(investments);

    return {
      organization: {
        id: organization.id,
        displayCode: organization.displayCode,
        name: organization.name
      },
      investments,
      analytics
    };
  }

  async getUserOrganizationInvestmentAnalytics(userIdOrCode: string, orgIdOrCode: string): Promise<UserOrganizationInvestmentAnalyticsDto> {
    // Resolve user ID
    const isUserIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userIdOrCode);
    let actualUserId = userIdOrCode;
    let user: User;
    
    if (!isUserIdUuid) {
      const foundUser = await this.dataSource.getRepository(User).findOne({ where: { displayCode: userIdOrCode } });
      if (!foundUser) {
        throw new NotFoundException('User not found');
      }
      user = foundUser;
      actualUserId = user.id;
    } else {
      const foundUser = await this.dataSource.getRepository(User).findOne({ where: { id: userIdOrCode } });
      if (!foundUser) {
        throw new NotFoundException('User not found');
      }
      user = foundUser;
    }

    // Resolve organization ID
    const isOrgIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgIdOrCode);
    let organizationId = orgIdOrCode;
    let organization: Organization;
    
    if (!isOrgIdUuid) {
      const org = await this.dataSource.getRepository(Organization).findOne({ where: { displayCode: orgIdOrCode } });
      if (!org) {
        throw new NotFoundException(`Organization with display code '${orgIdOrCode}' not found`);
      }
      organization = org;
      organizationId = org.id;
    } else {
      const org = await this.dataSource.getRepository(Organization).findOne({ where: { id: orgIdOrCode } });
      if (!org) {
        throw new NotFoundException('Organization not found');
      }
      organization = org;
    }

    // Get investments for the user in the organization's properties
    const investments = await this.investmentRepo
      .createQueryBuilder('investment')
      .leftJoinAndSelect('investment.user', 'user')
      .leftJoinAndSelect('investment.property', 'property')
      .leftJoinAndSelect('investment.propertyToken', 'propertyToken')
      .leftJoinAndSelect('property.organization', 'organization')
      .where('investment.userId = :userId', { userId: actualUserId })
      .andWhere('property.organizationId = :organizationId', { organizationId })
      .orderBy('investment.createdAt', 'DESC')
      .getMany();

    // Calculate analytics
    const analytics = this.calculateInvestmentAnalytics(investments);

    return {
      user: {
        id: user.id,
        displayCode: user.displayCode,
        fullName: user.fullName,
        email: user.email
      },
      organization: {
        id: organization.id,
        displayCode: organization.displayCode,
        name: organization.name
      },
      investments,
      analytics
    };
  }

  private calculateInvestmentAnalytics(investments: any[]): any {
    if (investments.length === 0) {
      return {
        totalInvestments: 0,
        totalAmountUSDT: '0',
        totalTokensPurchased: '0',
        averageInvestmentAmount: '0',
        averageTokensPerInvestment: '0',
        totalExpectedROI: '0',
        activeInvestments: 0,
        completedInvestments: 0,
        pendingInvestments: 0,
        totalValueAtCurrentPrice: '0'
      };
    }

    const totalAmountUSDT = investments.reduce((sum, inv) => sum.plus(inv.amountUSDT), new Decimal(0));
    const totalTokensPurchased = investments.reduce((sum, inv) => sum.plus(inv.tokensPurchased), new Decimal(0));
    const totalExpectedROI = investments.reduce((sum, inv) => sum.plus(inv.expectedROI), new Decimal(0));
    
    const activeInvestments = investments.filter(inv => inv.status === 'active').length;
    const completedInvestments = investments.filter(inv => inv.status === 'confirmed').length;
    const pendingInvestments = investments.filter(inv => inv.status === 'pending').length;

    // Calculate total value at current price (sum of tokens * current price per token)
    const totalValueAtCurrentPrice = investments.reduce((sum, inv) => {
      const currentValue = inv.tokensPurchased.mul(inv.property.pricePerTokenUSDT);
      return sum.plus(currentValue);
    }, new Decimal(0));

    return {
      totalInvestments: investments.length,
      totalAmountUSDT: totalAmountUSDT.toString(),
      totalTokensPurchased: totalTokensPurchased.toString(),
      averageInvestmentAmount: totalAmountUSDT.div(investments.length).toString(),
      averageTokensPerInvestment: totalTokensPurchased.div(investments.length).toString(),
      totalExpectedROI: totalExpectedROI.toString(),
      activeInvestments,
      completedInvestments,
      pendingInvestments,
      totalValueAtCurrentPrice: totalValueAtCurrentPrice.toString()
    };
  }
}
