import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TokenPriceHistoryService } from './token-price-history.service';
import { TokenPriceHistoryController } from './token-price-history.controller';
import { PriceEvent } from './entities/price-event.entity';
import { TokenPriceHistory } from './entities/token-price-history.entity';
import { DailyCandle } from './entities/daily-candle.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PriceEvent, TokenPriceHistory, DailyCandle]),
    ScheduleModule.forRoot(), // Enable scheduled tasks for cron jobs
  ],
  controllers: [TokenPriceHistoryController],
  providers: [TokenPriceHistoryService],
  exports: [TokenPriceHistoryService],
})
export class TokenPriceHistoryModule {}


