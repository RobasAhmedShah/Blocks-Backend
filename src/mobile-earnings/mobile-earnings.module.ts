import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MobileEarningsController } from './mobile-earnings.controller';
import { MobileEarningsService } from './mobile-earnings.service';
import { Reward } from '../rewards/entities/reward.entity';
import { User } from '../admin/entities/user.entity';
import { Investment } from '../investments/entities/investment.entity';
import { Property } from '../properties/entities/property.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reward, User, Investment, Property]),
  ],
  controllers: [MobileEarningsController],
  providers: [MobileEarningsService],
  exports: [MobileEarningsService],
})
export class MobileEarningsModule {}

