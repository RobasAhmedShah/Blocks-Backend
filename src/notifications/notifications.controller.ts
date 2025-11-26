import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus, Req, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { RegisterExpoTokenDto } from './dto/register-expo-token.dto';
import { RegisterWebPushDto } from './dto/register-web-push.dto';
import { CreateNotificationJobDto } from './dto/create-notification-job.dto';
import { JwtAuthGuard } from '../mobile-auth/guards/jwt-auth.guard';
import { QStashSignatureGuard } from './guards/qstash-signature.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User } from '../admin/entities/user.entity';

@Controller('api/notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('process')
  @Public() // QStash calls this endpoint, so it needs to be public
  @UseGuards(QStashSignatureGuard) // Verify QStash signature for security
  @HttpCode(HttpStatus.OK)
  async processNotification(@Body() job: any, @Req() request: Request) {
    // Log the received job for debugging
    this.logger.log(`Received notification job: ${JSON.stringify(job)}`);
    this.logger.log(`Request body type: ${typeof request.body}`);
    this.logger.log(`Request body keys: ${Object.keys(job || {})}`);
    
    // Handle QStash body format - it might wrap the body
    let notificationJob: CreateNotificationJobDto;
    
    // Check if QStash wrapped the body (sometimes it sends { body: {...} })
    if (job.body && typeof job.body === 'object') {
      notificationJob = job.body;
      this.logger.log('QStash wrapped body detected, using job.body');
    } else if (job.userId) {
      notificationJob = job;
    } else {
      this.logger.error(`ERROR: Invalid job format! Received: ${JSON.stringify(job)}`);
      throw new Error('Invalid notification job format - userId is required');
    }
    
    if (!notificationJob.userId) {
      this.logger.error(`ERROR: userId is missing! Full job: ${JSON.stringify(notificationJob)}`);
      throw new Error('userId is required in notification job');
    }
    
    await this.notificationsService.processNotification(notificationJob);
    return { success: true };
  }

  @Post('register-expo-token')
  @UseGuards(JwtAuthGuard)
  async registerExpoToken(
    @CurrentUser() user: User,
    @Body() dto: RegisterExpoTokenDto,
  ) {
    await this.notificationsService.registerExpoToken(user.id, dto.token);
    return { success: true, message: 'Expo token registered successfully' };
  }

  @Post('register-web-push')
  @UseGuards(JwtAuthGuard)
  async registerWebPush(
    @CurrentUser() user: User,
    @Body() dto: RegisterWebPushDto,
  ) {
    await this.notificationsService.registerWebPush(user.id, dto.subscription);
    return { success: true, message: 'Web push subscription registered successfully' };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserNotifications(@CurrentUser() user: User) {
    const notifications = await this.notificationsService.getUserNotifications(user.id);
    return { notifications };
  }
}

