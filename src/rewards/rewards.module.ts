import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { Reward } from './entities/reward.entity';
import { Investment } from '../investments/entities/investment.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../admin/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reward, Investment, Wallet, Transaction, User, Property]),
    NotificationsModule, // For push notifications
    // PortfolioModule removed - now handled by event listeners
  ],
  controllers: [RewardsController],
  providers: [RewardsService],
})
export class RewardsModule {}


