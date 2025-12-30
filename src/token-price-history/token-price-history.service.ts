import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';
import { PriceEvent } from './entities/price-event.entity';
import { TokenPriceHistory, PriceSource } from './entities/token-price-history.entity';

@Injectable()
export class TokenPriceHistoryService {
  private readonly logger = new Logger(TokenPriceHistoryService.name);

  constructor(
    @InjectRepository(PriceEvent)
    private priceEventRepository: Repository<PriceEvent>,
    
    @InjectRepository(TokenPriceHistory)
    private priceHistoryRepository: Repository<TokenPriceHistory>,
    
    private eventEmitter: EventEmitter2,
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

    // 3. Emit WebSocket event for real-time updates
    this.eventEmitter.emit('price.event.created', {
      propertyId,
      eventType: 'PURCHASE_EXECUTED',
      pricePerToken: pricePerToken.toNumber(),
      quantity: quantity.toNumber(),
      timestamp: new Date(),
      eventId: priceEvent.id,
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
   * Background aggregation method for price periods
   */
  private async aggregatePriceForPeriod(propertyId: string): Promise<void> {
    // This can be implemented later for hourly/daily aggregations
    // For now, we record individual trades
    this.logger.debug(`Aggregating price for property ${propertyId}`);
  }
}
