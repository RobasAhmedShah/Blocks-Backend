import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminAnalyticsModule } from './analytics/admin-analytics.module';
import { User } from './entities/user.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { KycVerification } from '../kyc/entities/kyc-verification.entity';
import { Portfolio } from '../portfolio/entities/portfolio.entity';
import { OrganizationsModule } from '../organizations/organizations.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Wallet, KycVerification, Portfolio]),
    AdminAnalyticsModule,
    OrganizationsModule,
    NotificationsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}


