import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, MoreThanOrEqual } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import Decimal from 'decimal.js';
import { Portfolio } from './entities/portfolio.entity';
import { PortfolioHistory } from './entities/portfolio-history.entity';
import { PortfolioDailyCandle } from './entities/portfolio-daily-candle.entity';
import { Investment } from '../investments/entities/investment.entity';
import { Reward } from '../rewards/entities/reward.entity';
import { User } from '../admin/entities/user.entity';

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Portfolio)
    private readonly portfolioRepo: Repository<Portfolio>,
    @InjectRepository(PortfolioHistory)
    private readonly historyRepo: Repository<PortfolioHistory>,
    @InjectRepository(PortfolioDailyCandle)
    private readonly dailyCandleRepo: Repository<PortfolioDailyCandle>,
    @InjectRepository(Investment)
    private readonly investmentRepo: Repository<Investment>,
    @InjectRepository(Reward)
    private readonly rewardRepo: Repository<Reward>,
    private eventEmitter: EventEmitter2,
  ) {}

  // Auto-update method called by InvestmentService (legacy - kept for backward compatibility)
  // Note: Portfolio updates are now handled by PortfolioListener via investment.completed event
  // This method is kept in case it's called directly, but snapshots are recorded via event listener
  async updateAfterInvestment(userId: string, amountUSDT: Decimal, transactionManager: EntityManager) {
    const portfolio = await transactionManager.findOne(Portfolio, { where: { userId } });
    if (!portfolio) return;
    
    portfolio.totalInvestedUSDT = (portfolio.totalInvestedUSDT as Decimal).plus(amountUSDT);
    portfolio.activeInvestments += 1;
    portfolio.lastUpdated = new Date();
    await transactionManager.save(Portfolio, portfolio);

    // Snapshot will be recorded via PortfolioListener after transaction commits
  }

  // Auto-update method called by RewardService (legacy - kept for backward compatibility)
  // Note: Portfolio updates are now handled by PortfolioListener via reward.distributed event
  // This method is kept in case it's called directly, but snapshots are recorded via event listener
  async updateAfterReward(userId: string, rewardUSDT: Decimal, transactionManager: EntityManager) {
    const portfolio = await transactionManager.findOne(Portfolio, { where: { userId } });
    if (!portfolio) return;
    
    portfolio.totalRewardsUSDT = (portfolio.totalRewardsUSDT as Decimal).plus(rewardUSDT);
    portfolio.totalROIUSDT = (portfolio.totalROIUSDT as Decimal).plus(rewardUSDT);
    portfolio.lastUpdated = new Date();
    await transactionManager.save(Portfolio, portfolio);

    // Snapshot will be recorded via PortfolioListener after transaction commits
  }

  // Auto-update method called by MarketplaceService for buyer
  async updateAfterMarketplaceBuy(
    userId: string,
    amountUSDT: Decimal,
    isNewInvestment: boolean,
    transactionManager: EntityManager,
  ) {
    const portfolio = await transactionManager.findOne(Portfolio, { where: { userId } });
    if (!portfolio) return;
    
    portfolio.totalInvestedUSDT = (portfolio.totalInvestedUSDT as Decimal).plus(amountUSDT);
    if (isNewInvestment) {
      portfolio.activeInvestments += 1;
    }
    portfolio.lastUpdated = new Date();
    await transactionManager.save(Portfolio, portfolio);

    // Snapshot will be recorded via event listener after transaction commits
    // See handleMarketplaceTradeCompleted() method below
  }

  // Auto-update method called by MarketplaceService for seller
  async updateAfterMarketplaceSell(
    userId: string,
    originalInvestmentAmountUSDT: Decimal,
    investmentStatusChangedToSold: boolean,
    transactionManager: EntityManager,
  ) {
    const portfolio = await transactionManager.findOne(Portfolio, { where: { userId } });
    if (!portfolio) return;
    
    // Decrease totalInvestedUSDT by the original investment amount that corresponds to tokens sold
    portfolio.totalInvestedUSDT = (portfolio.totalInvestedUSDT as Decimal).minus(originalInvestmentAmountUSDT);
    // Ensure it doesn't go negative
    if (portfolio.totalInvestedUSDT.lt(0)) {
      portfolio.totalInvestedUSDT = new Decimal(0);
    }
    
    // Decrease activeInvestments if investment status changed to 'sold'
    if (investmentStatusChangedToSold && portfolio.activeInvestments > 0) {
      portfolio.activeInvestments -= 1;
    }
    
    portfolio.lastUpdated = new Date();
    await transactionManager.save(Portfolio, portfolio);

    // Snapshot will be recorded via event listener after transaction commits
    // See handleMarketplaceTradeCompleted() method below
  }

  // GET endpoint method - comprehensive portfolio for specific user
  async getDetailedPortfolio(userId: string) {
    // Check if userId is UUID or displayCode
    const isUserIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

    let actualUserId = userId;
    let user: User;
    if (!isUserIdUuid) {
      // Find user by displayCode to get their UUID
      const foundUser = await this.dataSource.getRepository(User).findOne({ where: { displayCode: userId } });
      if (!foundUser) throw new NotFoundException('User not found');
      user = foundUser;
      actualUserId = user.id;
    } else {
      // Fetch user by UUID
      const foundUser = await this.dataSource.getRepository(User).findOne({ where: { id: userId } });
      if (!foundUser) throw new NotFoundException('User not found');
      user = foundUser;
    }

    // Get portfolio
    const portfolio = await this.portfolioRepo.findOne({ where: { userId: actualUserId } });
    if (!portfolio) throw new NotFoundException('Portfolio not found');

    // Get all investments with property details
    const investments = await this.investmentRepo.find({
      where: { userId: actualUserId },
      relations: ['property', 'property.organization'],
      order: { createdAt: 'DESC' }
    });

    // Get all rewards
    const rewards = await this.rewardRepo.find({
      where: { userId: actualUserId },
      relations: ['investment', 'investment.property', 'investment.propertyToken'],
      order: { createdAt: 'DESC' }
    });

    // Calculate detailed investment data
    const investmentDetails = investments.map(investment => {
      // Calculate current value: tokensPurchased × property.tokenPrice
      const currentValue = (investment.tokensPurchased as Decimal).mul(investment.property.pricePerTokenUSDT as Decimal);
      const totalRewards = rewards
        .filter(reward => reward.investmentId === investment.id)
        .reduce((sum, reward) => sum.plus(reward.amountUSDT as Decimal), new Decimal(0));
      
      return {
        investmentId: investment.id,
        displayCode: investment.displayCode,
        property: {
          id: investment.property.id,
          displayCode: investment.property.displayCode,
          title: investment.property.title,
          slug: investment.property.slug,
          type: investment.property.type,
          status: investment.property.status,
          city: investment.property.city,
          country: investment.property.country,
          organization: {
            id: investment.property.organization.id,
            displayCode: investment.property.organization.displayCode,
            name: investment.property.organization.name,
          }
        },
        tokensPurchased: investment.tokensPurchased.toString(),
        amountInvestedUSDT: investment.amountUSDT.toString(),
        currentValueUSDT: currentValue.toString(),
        expectedROI: investment.expectedROI.toString(),
        totalRewardsUSDT: totalRewards.toString(),
        netROI: totalRewards.minus(investment.amountUSDT as Decimal).toString(),
        status: investment.status,
        paymentStatus: investment.paymentStatus,
        investedAt: investment.createdAt,
        lastUpdated: investment.updatedAt,
      };
    });

    // Calculate summary statistics
    const totalInvested = investments.reduce((sum, inv) => sum.plus(inv.amountUSDT as Decimal), new Decimal(0));
    const totalRewards = rewards.reduce((sum, reward) => sum.plus(reward.amountUSDT as Decimal), new Decimal(0));
    const totalCurrentValue = investmentDetails.reduce((sum, inv) => sum.plus(new Decimal(inv.currentValueUSDT)), new Decimal(0));
    const totalNetROI = totalRewards.minus(totalInvested);

    return {
      user: {
        id: user.id,
        displayCode: user.displayCode,
        fullName: user.fullName,
        email: user.email,
      },
      portfolio: {
        id: portfolio.id,
        totalInvestedUSDT: portfolio.totalInvestedUSDT.toString(),
        totalRewardsUSDT: portfolio.totalRewardsUSDT.toString(),
        totalROIUSDT: portfolio.totalROIUSDT.toString(),
        activeInvestments: portfolio.activeInvestments,
        lastUpdated: portfolio.lastUpdated,
        createdAt: portfolio.createdAt,
      },
      summary: {
        totalInvestedUSDT: totalInvested.toString(),
        totalRewardsUSDT: totalRewards.toString(),
        totalCurrentValueUSDT: totalCurrentValue.toString(),
        totalNetROI: totalNetROI.toString(),
        totalInvestments: investments.length,
        activeInvestments: investments.filter(inv => inv.status === 'confirmed' || inv.status === 'active').length,
        averageROI: investments.length > 0 ? 
          investments.reduce((sum, inv) => sum.plus(inv.expectedROI as Decimal), new Decimal(0)).div(investments.length).toString() : '0',
      },
      investments: investmentDetails,
      rewards: rewards.map(reward => ({
        id: reward.id,
        displayCode: reward.displayCode,
        amountUSDT: reward.amountUSDT.toString(),
        type: reward.type,
        description: reward.description,
        status: reward.status,
        createdAt: reward.createdAt,
        property: {
          title: reward.investment.property.title,
          displayCode: reward.investment.property.displayCode,
        }
      })),
    };
  }

  /**
   * Calculate current portfolio value for a user
   * Calculation: tokens × tokenPrice
   */
  private async calculatePortfolioValue(userId: string): Promise<{
    totalValue: Decimal;
    totalInvested: Decimal;
  }> {
    const investments = await this.investmentRepo.find({
      where: [{ userId, status: 'active' },{ userId, status: 'confirmed' },],
      relations: ['property'],
    });

    let totalValue = new Decimal(0);
    let totalInvested = new Decimal(0);

    for (const inv of investments) {
      const tokens = inv.tokensPurchased as Decimal;
      const tokenPrice = inv.property.pricePerTokenUSDT as Decimal;
      const invested = inv.amountUSDT as Decimal;
      
      // Calculate current value: tokens × price
      const currentValue = tokens.mul(tokenPrice);
      totalValue = totalValue.plus(currentValue);
      totalInvested = totalInvested.plus(invested);
    }

    return { totalValue, totalInvested };
  }

  /**
   * Record portfolio snapshot when value changes
   * Called from updateAfterInvestment, updateAfterReward, etc.
   */
  async recordPortfolioSnapshot(
    userId: string,
    changeType: 'investment' | 'reward' | 'price_update' | 'marketplace_buy' | 'marketplace_sell' | 'snapshot',
    referenceId?: string
  ): Promise<PortfolioHistory> {
    try {
      const { totalValue, totalInvested } = await this.calculatePortfolioValue(userId);

      const snapshot = this.historyRepo.create({
        userId,
        totalValue,
        totalInvested,
        recordedAt: new Date(),
        changeType,
        referenceId,
      });

      const saved = await this.historyRepo.save(snapshot);
      this.logger.debug(`Portfolio snapshot saved: userId=${userId}, changeType=${changeType}, totalValue=${totalValue.toString()}`);

      // Don't emit events here - wait for aggregation to broadcast updates
      return saved;
    } catch (error) {
      this.logger.error(`Failed to record portfolio snapshot: userId=${userId}, changeType=${changeType}`, error.stack);
      throw error;
    }
  }

  /**
   * Aggregate snapshots into daily candles (runs hourly)
   * Similar to token-price-history aggregation
   */
  @Cron('0 * * * *') // Every hour
  async aggregateDailyCandles() {
    try {
      this.logger.debug('Starting portfolio daily candles aggregation...');

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      const aggregationQuery = `
        INSERT INTO portfolio_daily_candles (
          bucket_day,
          user_id,
          open_value,
          high_value,
          low_value,
          close_value,
          total_invested,
          snapshot_count,
          updated_at
        )
        WITH ranked_snapshots AS (
          SELECT 
            DATE_TRUNC('day', recorded_at) AS bucket_day,
            user_id,
            total_value,
            total_invested,
            ROW_NUMBER() OVER (
              PARTITION BY DATE_TRUNC('day', recorded_at), user_id 
              ORDER BY recorded_at ASC
            ) AS rn_asc,
            ROW_NUMBER() OVER (
              PARTITION BY DATE_TRUNC('day', recorded_at), user_id 
              ORDER BY recorded_at DESC
            ) AS rn_desc
          FROM portfolio_history
          WHERE recorded_at >= $1
            AND recorded_at < $2
        ),
        daily_aggregates AS (
          SELECT 
            bucket_day,
            user_id,
            MAX(total_value) AS high_value,
            MIN(total_value) AS low_value,
            MAX(CASE WHEN rn_asc = 1 THEN total_value END) AS open_value,
            MAX(CASE WHEN rn_desc = 1 THEN total_value END) AS close_value,
            MAX(CASE WHEN rn_desc = 1 THEN total_invested END) AS total_invested,
            COUNT(*) AS snapshot_count
          FROM ranked_snapshots
          GROUP BY bucket_day, user_id
        )
        SELECT 
          bucket_day,
          user_id,
          open_value,
          high_value,
          low_value,
          close_value,
          total_invested,
          snapshot_count,
          NOW() AS updated_at
        FROM daily_aggregates
        ON CONFLICT (bucket_day, user_id) 
        DO UPDATE SET
          open_value = EXCLUDED.open_value,
          high_value = EXCLUDED.high_value,
          low_value = EXCLUDED.low_value,
          close_value = EXCLUDED.close_value,
          total_invested = EXCLUDED.total_invested,
          snapshot_count = EXCLUDED.snapshot_count,
          updated_at = EXCLUDED.updated_at;
      `;

      const result = await this.dataSource.query(aggregationQuery, [
        yesterday,
        tomorrow,
      ]);

      const rowsAffected = result?.rowCount || 0;
      this.logger.log(
        `Portfolio daily candles aggregation completed. Updated ${rowsAffected} candle(s)`
      );

      // Emit WebSocket events for updated candles (today's candles only)
      await this.emitCandleUpdates();
    } catch (error) {
      this.logger.error(
        `Error aggregating daily candles: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Emit WebSocket updates for today's candles after aggregation
   * Broadcasts to users who are subscribed to portfolio updates
   */
  private async emitCandleUpdates() {
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      // Get all today's candles directly
      const todayCandles = await this.dailyCandleRepo.find({
        where: {
          bucketDay: MoreThanOrEqual(today),
        },
        order: { bucketDay: 'ASC' },
      });

      if (todayCandles.length === 0) {
        return;
      }

      // Filter to only today's candles and emit events
      for (const candle of todayCandles) {
        const candleDate = new Date(candle.bucketDay);
        if (candleDate >= today && candleDate < tomorrow) {
          try {
            // Emit WebSocket event with candle data
            this.eventEmitter.emit('portfolio.candle.updated', {
              userId: candle.userId,
              candle: {
                date: candle.bucketDay,
                openValue: candle.openValue.toNumber(),
                highValue: candle.highValue.toNumber(),
                lowValue: candle.lowValue.toNumber(),
                closeValue: candle.closeValue.toNumber(),
                totalInvested: candle.totalInvested.toNumber(),
                snapshotCount: candle.snapshotCount,
              },
              timestamp: new Date(),
            });
          } catch (error) {
            this.logger.error(
              `Error emitting candle update for user ${candle.userId}: ${error.message}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error emitting candle updates: ${error.message}`, error.stack);
    }
  }

  /**
   * Get portfolio history (from daily candles for performance)
   */
  async getPortfolioHistory(
    userId: string,
    days: number = 30
  ): Promise<PortfolioDailyCandle[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setUTCHours(0, 0, 0, 0);

    return await this.dailyCandleRepo.find({
      where: {
        userId,
        bucketDay: MoreThanOrEqual(startDate),
      },
      order: { bucketDay: 'ASC' },
    });
  }

  /**
   * Listen to marketplace trade completed event
   * Records portfolio snapshots for both buyer and seller after transaction commits
   */
  @OnEvent('marketplace.trade.completed')
  async handleMarketplaceTradeCompleted(payload: {
    tradeId: string;
    tradeDisplayCode: string;
    buyerId: string;
    sellerId: string;
    propertyId: string;
    propertyTitle: string;
    tokensBought: string;
    totalUSDT: string;
    buyerInvestmentId: string;
    sellerInvestmentId?: string;
  }) {
    try {
      // Validate tradeId is present
      if (!payload.tradeId) {
        this.logger.error(
          `Trade ID is missing in marketplace.trade.completed event payload: ${JSON.stringify(payload)}`
        );
        return;
      }

      // Add delay to ensure transaction is committed and investment is visible in database
      // This ensures calculatePortfolioValue includes the newly purchased investment
      await new Promise(resolve => setTimeout(resolve, 500));

      // Record snapshot for buyer
      await this.recordPortfolioSnapshot(
        payload.buyerId,
        'marketplace_buy',
        payload.tradeId
      );
      this.logger.debug(
        `Portfolio snapshot recorded for marketplace buy: tradeId=${payload.tradeId}, buyerId=${payload.buyerId}`
      );

      // Record snapshot for seller
      await this.recordPortfolioSnapshot(
        payload.sellerId,
        'marketplace_sell',
        payload.tradeId
      );
      this.logger.debug(
        `Portfolio snapshot recorded for marketplace sell: tradeId=${payload.tradeId}, sellerId=${payload.sellerId}`
      );
    } catch (error) {
      this.logger.error(
        `Error recording portfolio snapshots for marketplace trade: ${error.message}`,
        error.stack
      );
    }
  }
}


