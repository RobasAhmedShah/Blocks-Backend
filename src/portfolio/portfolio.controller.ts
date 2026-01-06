import { Controller, Get, Param, Query, BadRequestException } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';

@Controller('api/mobile/portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get('user/:userId/detailed')
  async getDetailedPortfolio(@Param('userId') userId: string) {
    return this.portfolioService.getDetailedPortfolio(userId);
  }

  /**
   * Get portfolio daily candles for a user
   * GET /api/mobile/portfolio/candles?userId=xxx&days=30
   */
  @Get('candles')
  async getPortfolioCandles(
    @Query('userId') userId: string,
    @Query('days') days?: number,
  ) {
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }
    const daysParam = days ? parseInt(days.toString(), 10) : 30;
    const candles = await this.portfolioService.getPortfolioHistory(userId, daysParam);

    // Convert Decimal values to numbers and format for JSON response
    return candles.map((candle) => ({
      date: candle.bucketDay.toISOString().split('T')[0], // YYYY-MM-DD format
      userId: candle.userId,
      openValue: candle.openValue.toNumber(),
      highValue: candle.highValue.toNumber(),
      lowValue: candle.lowValue.toNumber(),
      closeValue: candle.closeValue.toNumber(),
      totalInvested: candle.totalInvested.toNumber(),
      snapshotCount: candle.snapshotCount,
    }));
  }
}


