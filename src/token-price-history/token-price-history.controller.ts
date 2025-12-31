import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { TokenPriceHistoryService } from './token-price-history.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/mobile/price-history')
export class TokenPriceHistoryController {
  constructor(
    private readonly tokenPriceHistoryService: TokenPriceHistoryService,
  ) {}

  /**
   * Get daily candles (1d OHLC) for a property
   * GET /api/mobile/price-history/candles/:propertyId
   */
  @Get('candles/:propertyId')
  @Public() // Can be public or protected - adjust based on your needs
  async getDailyCandles(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('priceSource') priceSource?: 'base' | 'marketplace',
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const source = priceSource || 'marketplace';

    const candles = await this.tokenPriceHistoryService.getDailyCandles(
      propertyId,
      start,
      end,
      source,
    );

    // Convert Decimal values to numbers for JSON response
    return candles.map((candle) => ({
      date: candle.date.toISOString().split('T')[0], // YYYY-MM-DD format
      propertyId: candle.propertyId,
      priceSource: candle.priceSource,
      openPrice: candle.openPrice.toNumber(),
      highPrice: candle.highPrice.toNumber(),
      lowPrice: candle.lowPrice.toNumber(),
      closePrice: candle.closePrice.toNumber(),
      volume: candle.volume.toNumber(),
      tradeCount: candle.tradeCount,
    }));
  }

  /**
   * Get price history (individual trades) for a property
   * GET /api/mobile/price-history/history/:propertyId
   */
  @Get('history/:propertyId')
  @Public()
  async getPriceHistory(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('priceSource') priceSource?: 'base' | 'marketplace',
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const source = priceSource;

    const history = await this.tokenPriceHistoryService.getPriceHistory(
      propertyId,
      start,
      end,
      source,
    );

    // Convert Decimal values to numbers for JSON response
    return history.map((entry) => ({
      time: entry.time.toISOString(),
      propertyId: entry.propertyId,
      pricePerToken: entry.pricePerToken.toNumber(),
      volume: entry.volume.toNumber(),
      priceSource: entry.priceSource,
      tradeCount: entry.tradeCount,
      minPricePerToken: entry.minPricePerToken?.toNumber() || null,
      maxPricePerToken: entry.maxPricePerToken?.toNumber() || null,
      createdAt: entry.createdAt.toISOString(),
    }));
  }

  /**
   * Get current price statistics for a property
   * GET /api/mobile/price-history/stats/:propertyId
   */
  @Get('stats/:propertyId')
  @Public()
  async getCurrentPriceStats(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    const stats = await this.tokenPriceHistoryService.getCurrentPriceStats(propertyId);

    if (!stats) {
      return { error: 'No price data available for this property' };
    }

    return {
      currentPrice: stats.currentPrice.toNumber(),
      minPrice: stats.minPrice.toNumber(),
      maxPrice: stats.maxPrice.toNumber(),
      avgPrice: stats.avgPrice.toNumber(),
      totalVolume: stats.totalVolume.toNumber(),
      tradeCount: stats.tradeCount,
    };
  }
}


