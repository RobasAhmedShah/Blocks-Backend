import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { Portfolio } from './entities/portfolio.entity';
import { PortfolioHistory } from './entities/portfolio-history.entity';
import { PortfolioDailyCandle } from './entities/portfolio-daily-candle.entity';
import { User } from '../admin/entities/user.entity';
import { Investment } from '../investments/entities/investment.entity';
import { Reward } from '../rewards/entities/reward.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Portfolio,
      PortfolioHistory,
      PortfolioDailyCandle,
      User,
      Investment,
      Reward,
    ]),
    ScheduleModule.forRoot(), // Enable scheduled tasks for cron jobs
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService], // EXPORT for use in other modules
})
export class PortfolioModule {}


