import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import Decimal from 'decimal.js';
import { PriceEvent } from './entities/price-event.entity';
import { TokenPriceHistory, PriceSource } from './entities/token-price-history.entity';
import { DailyCandle, DailyCandleDto } from './entities/daily-candle.entity';

@Injectable()
export class TokenPriceHistoryService {
  private readonly logger = new Logger(TokenPriceHistoryService.name);

  constructor(
    @InjectRepository(PriceEvent)
    private priceEventRepository: Repository<PriceEvent>,
    
    @InjectRepository(TokenPriceHistory)
    private priceHistoryRepository: Repository<TokenPriceHistory>,
    
    private eventEmitter: EventEmitter2,
    private dataSource: DataSource,
  ) {}

  /**
   * Record a property creation event
   */
  async recordPropertyCreated(
    propertyId: string,
    pricePerToken: Decimal,
    totalTokens: Decimal,
    actorId: string
  ): Promise<PriceEvent> {
    const priceEvent = await this.createPriceEvent({
      propertyId,
      eventType: 'PROPERTY_CREATED',
      pricePerToken,
      quantity: totalTokens,
      actorId,
      referenceId: propertyId,
      referenceType: 'property',
      metadata: { initialPrice: pricePerToken.toNumber() },
    });

    // Insert initial price history
    await this.insertPriceHistory({
      time: new Date(),
      propertyId,
      pricePerToken,
      volume: new Decimal(0),
      priceSource: 'base',
      tradeCount: 0,
      derivedFromEventId: priceEvent.id,
    });

    return priceEvent;
  }

  /**
   * Record a property price update event
   */
  async recordPropertyPriceUpdate(
    propertyId: string,
    oldPricePerToken: Decimal,
    newPricePerToken: Decimal,
    actorId: string
  ): Promise<PriceEvent> {
    const priceEvent = await this.createPriceEvent({
      propertyId,
      eventType: 'PROPERTY_PRICE_UPDATE',
      pricePerToken: newPricePerToken,
      quantity: new Decimal(0), // No quantity change for price updates
      actorId,
      referenceId: propertyId,
      referenceType: 'property',
      metadata: {
        oldPrice: oldPricePerToken.toNumber(),
        newPrice: newPricePerToken.toNumber(),
      },
    });

    // Update price history with new base price
    await this.insertPriceHistory({
      time: new Date(),
      propertyId,
      pricePerToken: newPricePerToken,
      volume: new Decimal(0),
      priceSource: 'base',
      tradeCount: 0,
      derivedFromEventId: priceEvent.id,
    });

    return priceEvent;
  }

  /**
   * Record a marketplace listing creation event
   * Only creates a price_event record, NOT a token_price_history entry
   * (token_price_history is only created when trades are executed)
   */
  async recordListingCreated(
    listingId: string,
    propertyId: string,
    pricePerToken: Decimal,
    totalTokens: Decimal,
    sellerId: string
  ): Promise<PriceEvent> {
    const priceEvent = await this.createPriceEvent({
      propertyId,
      eventType: 'LISTING_CREATED',
      pricePerToken,
      quantity: totalTokens,
      actorId: sellerId,
      referenceId: listingId,
      referenceType: 'listing',
      metadata: { listingPrice: pricePerToken.toNumber() },
    });

    // Note: We do NOT insert into token_price_history here
    // token_price_history is only created when actual trades are executed

    return priceEvent;
  }

  /**
   * Record a marketplace trade execution
   */
  async recordMarketplaceTrade(
    tradeId: string,
    propertyId: string,
    pricePerToken: Decimal,
    quantity: Decimal,
    buyerId: string
  ): Promise<PriceEvent> {
    // 1. Create price_event record
    const priceEvent = await this.createPriceEvent({
      propertyId,
      eventType: 'PURCHASE_EXECUTED',
      pricePerToken,
      quantity,
      actorId: buyerId,
      referenceId: tradeId,
      referenceType: 'trade',
      metadata: { tradePrice: pricePerToken.toNumber() },
    });

    // 2. Insert into token_price_history
    await this.insertPriceHistory({
      time: new Date(),
      propertyId,
      pricePerToken,
      volume: quantity,
      priceSource: 'marketplace',
      tradeCount: 1,
      derivedFromEventId: priceEvent.id,
    });

    // 4. Trigger aggregation (async, don't await)
    this.aggregatePriceForPeriod(propertyId).catch(err => {
      this.logger.error('Error aggregating price:', err);
    });

    return priceEvent;
  }

  /**
   * Get price history for a property
   */
  async getPriceHistory(
    propertyId: string,
    startDate?: Date,
    endDate?: Date,
    priceSource?: 'base' | 'marketplace'
  ): Promise<TokenPriceHistory[]> {
    const query = this.priceHistoryRepository
      .createQueryBuilder('history')
      .where('history.propertyId = :propertyId', { propertyId })
      .orderBy('history.time', 'ASC');

    if (startDate) {
      query.andWhere('history.time >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('history.time <= :endDate', { endDate });
    }

    if (priceSource) {
      query.andWhere('history.priceSource = :priceSource', { priceSource });
    }

    return await query.getMany();
  }

  /**
   * Get current price statistics for a property
   */
  async getCurrentPriceStats(propertyId: string): Promise<{
    currentPrice: Decimal;
    minPrice: Decimal;
    maxPrice: Decimal;
    avgPrice: Decimal;
    totalVolume: Decimal;
    tradeCount: number;
  } | null> {
    const result = await this.priceHistoryRepository
      .createQueryBuilder('history')
      .select('AVG(history.pricePerToken)', 'avgPrice')
      .addSelect('MIN(history.pricePerToken)', 'minPrice')
      .addSelect('MAX(history.pricePerToken)', 'maxPrice')
      .addSelect('SUM(history.volume)', 'totalVolume')
      .addSelect('SUM(history.tradeCount)', 'totalTrades')
      .where('history.propertyId = :propertyId', { propertyId })
      .andWhere('history.priceSource = :source', { source: 'marketplace' })
      .getRawOne();

    if (!result || !result.avgPrice) {
      return null;
    }

    // Get most recent price
    const latest = await this.priceHistoryRepository
      .createQueryBuilder('history')
      .where('history.propertyId = :propertyId', { propertyId })
      .orderBy('history.time', 'DESC')
      .limit(1)
      .getOne();

    return {
      currentPrice: latest?.pricePerToken || new Decimal(result.avgPrice),
      minPrice: new Decimal(result.minPrice || 0),
      maxPrice: new Decimal(result.maxPrice || 0),
      avgPrice: new Decimal(result.avgPrice),
      totalVolume: new Decimal(result.totalVolume || 0),
      tradeCount: parseInt(result.totalTrades || '0', 10),
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Creates a price_event record
   */
  private async createPriceEvent(data: {
    propertyId: string;
    eventType: 'PROPERTY_CREATED' | 'PROPERTY_PRICE_UPDATE' | 'LISTING_CREATED' | 'PURCHASE_EXECUTED';
    pricePerToken: Decimal;
    quantity: Decimal;
    actorId: string;
    referenceId: string;
    referenceType: 'listing' | 'trade' | 'property';
    metadata?: any;
  }): Promise<PriceEvent> {
    const priceEvent = this.priceEventRepository.create({
      propertyId: data.propertyId,
      eventType: data.eventType,
      pricePerToken: data.pricePerToken,
      quantity: data.quantity,
      actorId: data.actorId,
      referenceId: data.referenceId,
      referenceType: data.referenceType,
      metadata: data.metadata || null,
    });

    return await this.priceEventRepository.save(priceEvent);
  }

  /**
   * Helper method to insert into token_price_history
   */
  private async insertPriceHistory(data: {
    time: Date;
    propertyId: string;
    pricePerToken: Decimal;
    volume: Decimal;
    priceSource: PriceSource;
    tradeCount: number;
    derivedFromEventId: string;
  }): Promise<TokenPriceHistory> {
    const history = this.priceHistoryRepository.create({
      time: data.time,
      propertyId: data.propertyId,
      pricePerToken: data.pricePerToken,
      volume: data.volume,
      priceSource: data.priceSource,
      tradeCount: data.tradeCount,
      derivedFromEventId: data.derivedFromEventId,
    });

    const saved = await this.priceHistoryRepository.save(history);
    // TypeORM save can return array or single entity, ensure we return single
    if (Array.isArray(saved)) {
      return saved[0];
    }
    return saved;
  }

  /**
   * Get daily candles (1d OHLC) for a property
   * Queries the daily_candles_1d table (populated by cron job)
   */
  async getDailyCandles(
    propertyId: string,
    startDate?: Date,
    endDate?: Date,
    priceSource: PriceSource = 'marketplace'
  ): Promise<DailyCandleDto[]> {
    try {
      let query = `
        SELECT 
          bucket_day AS "date",
          property_id AS "propertyId",
          price_source AS "priceSource",
          open_price AS "openPrice",
          high_price AS "highPrice",
          low_price AS "lowPrice",
          close_price AS "closePrice",
          volume,
          trade_count AS "tradeCount"
        FROM daily_candles_1d
        WHERE property_id = $1
        AND price_source = $2
      `;

      const params: any[] = [propertyId, priceSource];
      let paramIndex = 3;

      if (startDate) {
        // Truncate to start of day for comparison
        const startOfDay = new Date(startDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        query += ` AND bucket_day >= $${paramIndex}`;
        params.push(startOfDay);
        paramIndex++;
      }

      if (endDate) {
        // Truncate to end of day for comparison
        const endOfDay = new Date(endDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        query += ` AND bucket_day <= $${paramIndex}`;
        params.push(endOfDay);
        paramIndex++;
      }

      query += ` ORDER BY bucket_day ASC`;

      const results = await this.dataSource.query(query, params);

      return results.map((row: any) => ({
        date: new Date(row.date),
        propertyId: row.propertyId,
        priceSource: row.priceSource as PriceSource,
        openPrice: new Decimal(row.openPrice),
        highPrice: new Decimal(row.highPrice),
        lowPrice: new Decimal(row.lowPrice),
        closePrice: new Decimal(row.closePrice),
        volume: new Decimal(row.volume),
        tradeCount: parseInt(row.tradeCount, 10),
      }));
    } catch (error) {
      this.logger.error(`Error fetching daily candles: ${error.message}`, error.stack);
      // If table doesn't exist, return empty array
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        this.logger.warn('Daily candles table not found. Run migration: add-daily-candles-table.sql');
        return [];
      }
      throw error;
    }
  }

  /**
   * Scheduled task: Aggregate daily candles from token_price_history
   * Runs every 15 minutes to update the daily_candles_1d table
   * 
   * This aggregates all marketplace trades into daily OHLC candles
   */
  @Cron('*/15 * * * *') // Every 15 minutes
  async aggregateDailyCandles() {
    try {
      this.logger.debug('Starting daily candles aggregation...');

      // Calculate date range: today and yesterday (in UTC)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      // Aggregate data from token_price_history into daily_candles_1d
      // Using UPSERT (INSERT ... ON CONFLICT UPDATE) to handle updates
      // Using CTE with window functions to calculate open/close prices correctly
      // Only processing today and yesterday's trades for performance
      const aggregationQuery = `
        INSERT INTO daily_candles_1d (
          bucket_day,
          property_id,
          price_source,
          open_price,
          high_price,
          low_price,
          close_price,
          volume,
          trade_count,
          updated_at
        )
        WITH ranked_data AS (
          SELECT 
            DATE_TRUNC('day', time) AS bucket_day,
            property_id,
            price_source,
            price_per_token,
            volume,
            trade_count,
            ROW_NUMBER() OVER (
              PARTITION BY DATE_TRUNC('day', time), property_id, price_source 
              ORDER BY time ASC
            ) AS rn_asc,
            ROW_NUMBER() OVER (
              PARTITION BY DATE_TRUNC('day', time), property_id, price_source 
              ORDER BY time DESC
            ) AS rn_desc
          FROM token_price_history
          WHERE price_source = 'marketplace'
            AND time >= $1
            AND time < $2
        ),
        daily_aggregates AS (
          SELECT 
            bucket_day,
            property_id,
            price_source,
            MAX(price_per_token) AS high_price,
            MIN(price_per_token) AS low_price,
            SUM(volume) AS volume,
            SUM(trade_count) AS trade_count,
            MAX(CASE WHEN rn_asc = 1 THEN price_per_token END) AS open_price,
            MAX(CASE WHEN rn_desc = 1 THEN price_per_token END) AS close_price
          FROM ranked_data
          GROUP BY bucket_day, property_id, price_source
        )
        SELECT 
          bucket_day,
          property_id,
          price_source,
          open_price,
          high_price,
          low_price,
          close_price,
          volume,
          trade_count,
          NOW() AS updated_at
        FROM daily_aggregates
        ON CONFLICT (bucket_day, property_id, price_source) 
        DO UPDATE SET
          open_price = EXCLUDED.open_price,
          high_price = EXCLUDED.high_price,
          low_price = EXCLUDED.low_price,
          close_price = EXCLUDED.close_price,
          volume = EXCLUDED.volume,
          trade_count = EXCLUDED.trade_count,
          updated_at = EXCLUDED.updated_at;
      `;

      const result = await this.dataSource.query(aggregationQuery, [
        yesterday, // Start from yesterday (inclusive)
        tomorrow,  // Up to but not including tomorrow (so today is included)
      ]);
      const rowsAffected = result?.rowCount || 0;

      this.logger.log(`Daily candles aggregation completed. Updated ${rowsAffected} candle(s)`);

      // Emit WebSocket events for updated candles (today's candles only)
      await this.emitCandleUpdates();
    } catch (error) {
      this.logger.error(`Error aggregating daily candles: ${error.message}`, error.stack);
    }
  }

  /**
   * Emit WebSocket updates for today's candles after aggregation
   */
  private async emitCandleUpdates() {
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

      // Get all properties with candles for today
      const query = `
        SELECT DISTINCT property_id AS "propertyId"
        FROM daily_candles_1d
        WHERE bucket_day >= $1
        AND bucket_day < $2
        AND price_source = $3
      `;

      const results = await this.dataSource.query(query, [
        today,
        tomorrow,
        'marketplace',
      ]);

      if (results.length === 0) {
        return;
      }

      // For each property, get today's candle and emit WebSocket event
      for (const row of results) {
        const propertyId = row.propertyId;
        
        try {
          const candles = await this.getDailyCandles(
            propertyId,
            today,
            tomorrow,
            'marketplace'
          );

          if (candles.length > 0) {
            const todayCandle = candles[0];

            // Emit WebSocket event with candle data
            this.eventEmitter.emit('candle.updated', {
              propertyId,
              candle: {
                date: todayCandle.date,
                openPrice: todayCandle.openPrice.toNumber(),
                highPrice: todayCandle.highPrice.toNumber(),
                lowPrice: todayCandle.lowPrice.toNumber(),
                closePrice: todayCandle.closePrice.toNumber(),
                volume: todayCandle.volume.toNumber(),
                tradeCount: todayCandle.tradeCount,
              },
              timestamp: new Date(),
            });
          }
        } catch (error) {
          this.logger.error(
            `Error emitting candle update for property ${propertyId}: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error emitting candle updates: ${error.message}`, error.stack);
    }
  }

  /**
   * Background aggregation method for price periods
   * Note: Aggregation is now handled by scheduled cron job
   */
  private async aggregatePriceForPeriod(propertyId: string): Promise<void> {
    // Aggregation is handled by the scheduled cron job
    // This method is kept for backward compatibility but does nothing
    this.logger.debug(`Aggregation will be handled by scheduled task for property ${propertyId}`);
  }
}
