import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reward } from '../rewards/entities/reward.entity';
import { User } from '../admin/entities/user.entity';
import Decimal from 'decimal.js';

@Injectable()
export class MobileEarningsService {
  constructor(
    @InjectRepository(Reward)
    private readonly rewardRepo: Repository<Reward>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getUserEarnings(userId: string) {
    // Check if userId is UUID or displayCode
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    
    let actualUserId: string;
    
    if (isUuid) {
      actualUserId = userId;
    } else {
      // It's a display code, find the user first to get their UUID
      const user = await this.userRepo.findOne({ 
        where: { displayCode: userId } 
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      actualUserId = user.id;
    }

    // Fetch all distributed rewards for this user with investment and property relations
    const rewards = await this.rewardRepo.find({
      where: {
        userId: actualUserId,
        status: 'distributed',
      },
      relations: ['investment', 'investment.property'],
      order: {
        createdAt: 'DESC',
      },
    });

    // Calculate total earnings
    const totalEarnings = rewards.reduce(
      (sum, reward) => sum.plus(reward.amountUSDT as Decimal),
      new Decimal(0),
    );

    // Transform rewards to earnings format
    const earnings = rewards.map((reward) => {
      const property = reward.investment?.property;
      
      return {
        id: reward.id,
        displayCode: reward.displayCode,
        amount: (reward.amountUSDT as Decimal).toString(),
        propertyId: property?.id || null,
        propertyTitle: property?.title || null,
        propertyDisplayCode: property?.displayCode || null,
        description: reward.description || `Reward from ${property?.title || 'property'}`,
        createdAt: reward.createdAt,
      };
    });

    return {
      totalEarnings: totalEarnings.toString(),
      earnings,
      count: earnings.length,
    };
  }
}

