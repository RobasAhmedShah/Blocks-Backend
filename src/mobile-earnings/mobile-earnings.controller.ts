import { Controller, Get, Query, NotFoundException } from '@nestjs/common';
import { MobileEarningsService } from './mobile-earnings.service';

@Controller('api/mobile/earnings')
export class MobileEarningsController {
  constructor(private readonly mobileEarningsService: MobileEarningsService) {}

  @Get()
  async getEarnings(@Query('userId') userId: string) {
    if (!userId) {
      throw new NotFoundException('userId is required');
    }
    return this.mobileEarningsService.getUserEarnings(userId);
  }
}

