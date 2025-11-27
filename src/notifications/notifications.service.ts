import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '@upstash/qstash';
import { ConfigService } from '@nestjs/config';
import { CreateNotificationJobDto } from './dto/create-notification-job.dto';
import { Notification } from './entities/notification.entity';
import { User } from '../admin/entities/user.entity';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import * as webPush from 'web-push';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private qstash: Client;
  private expo: Expo;
  private apiUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    // Initialize QStash client
    const qstashToken = this.configService.get<string>('QSTASH_TOKEN');
    if (qstashToken) {
      this.qstash = new Client({ token: qstashToken });
      this.logger.log('QStash client initialized');
    } else {
      this.logger.warn('QSTASH_TOKEN not configured - notifications will not be queued');
    }

    // Initialize Expo SDK
    this.expo = new Expo();

    // Initialize Web Push VAPID details
    const vapidPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const vapidEmail = this.configService.get<string>('VAPID_EMAIL', 'admin@yourapp.com');

    if (vapidPublicKey && vapidPrivateKey) {
      // VAPID subject must be in mailto: format
      const vapidSubject = vapidEmail.startsWith('mailto:') 
        ? vapidEmail 
        : `mailto:${vapidEmail}`;
      
      webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      this.logger.log('Web Push VAPID details configured');
    } else {
      this.logger.warn('VAPID keys not configured - Web Push notifications will not work');
    }

    // Get API URL for QStash callbacks
    this.apiUrl = this.configService.get<string>('API_URL') || 
                  this.configService.get<string>('VERCEL_URL') || 
                  'http://localhost:3000';
    
    // Warn if using localhost (QStash cannot reach it)
    if (this.qstash && (this.apiUrl.includes('localhost') || this.apiUrl.includes('127.0.0.1'))) {
      this.logger.warn(
        '⚠️  WARNING: API_URL is set to localhost. QStash cannot reach localhost addresses.\n' +
        '   For local testing, use ngrok: https://ngrok.com/\n' +
        '   1. Install: npm install -g ngrok\n' +
        '   2. Run: ngrok http 3000\n' +
        '   3. Update API_URL in .env to the ngrok URL (e.g., https://abc123.ngrok.io)\n' +
        '   4. Restart backend'
      );
    }
    
    // Log configuration status
    if (this.qstash) {
      this.logger.log(`QStash configured with API URL: ${this.apiUrl}`);
    }
  }

  async queueNotification(job: CreateNotificationJobDto): Promise<void> {
    try {
      if (!this.qstash) {
        this.logger.error('QStash not initialized - cannot queue notification');
        return;
      }

      // Ensure no double slashes in URL
      const baseUrl = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
      const processUrl = `${baseUrl}/api/notifications/process`;
      
      await this.qstash.publishJSON({
        url: processUrl,
        body: job,
        retries: 3,
        delay: 0, // Send immediately
      });

      this.logger.log(`Notification queued for user ${job.userId}`);
    } catch (error) {
      this.logger.error(`Failed to queue notification for user ${job.userId}:`, error);
      throw error;
    }
  }

  async processNotification(job: CreateNotificationJobDto): Promise<void> {
    const { userId, title, message, data } = job;

    try {
      this.logger.log(`Processing notification for user ${userId}`);
      
      // Fetch user with tokens
      const user = await this.userRepo.findOne({
        where: { id: userId },
        select: ['id', 'expoToken', 'webPushSubscription'],
      });

      if (!user) {
        this.logger.warn(`User ${userId} not found`);
        return;
      }

      // Check if user has any push tokens
      if (!user.expoToken && !user.webPushSubscription) {
        this.logger.warn(`User ${userId} has no push tokens registered - skipping notification`);
        return;
      }

      this.logger.log(`User ${userId} has tokens - expoToken: ${!!user.expoToken}, webPush: ${!!user.webPushSubscription}`);

      let notificationSent = false;
      let platform: 'expo' | 'web' | null = null;

      // Send Expo push notification
      if (user.expoToken) {
        try {
          if (Expo.isExpoPushToken(user.expoToken)) {
            const messages: ExpoPushMessage[] = [
              {
                to: user.expoToken,
                sound: 'default',
                title,
                body: message,
                data: {
                  ...(data || {}),
                  // Ensure URL is included for navigation
                  url: data?.url || '/notifications?context=portfolio',
                },
              },
            ];

            const chunks = this.expo.chunkPushNotifications(messages);
            const tickets: ExpoPushTicket[] = [];

            for (const chunk of chunks) {
              try {
                const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
              } catch (error) {
                this.logger.error(`Error sending Expo push chunk:`, error);
              }
            }

            // Check for errors in tickets
            for (const ticket of tickets) {
              if (ticket.status === 'error') {
                this.logger.error(`Expo push error: ${ticket.message}`);
                if (ticket.details?.error === 'DeviceNotRegistered') {
                  user.expoToken = null;
                  await this.userRepo.save(user);
                  this.logger.log(`Removed invalid Expo token for user ${userId}`);
                }
              } else {
                notificationSent = true;
                platform = 'expo';
                this.logger.log(`Expo notification sent to user ${userId}`);
              }
            }
          } else {
            this.logger.warn(`Invalid Expo token format for user ${userId}`);
          }
        } catch (error) {
          this.logger.error(`Failed to send Expo push to user ${userId}:`, error);
        }
      }

      // Send Web Push notification
      if (user.webPushSubscription) {
        try {
          const subscription = JSON.parse(user.webPushSubscription);
          const payload = JSON.stringify({
            title,
            message,
            data: data || {},
          });

          await webPush.sendNotification(subscription, payload);
          notificationSent = true;
          platform = platform || 'web';
          this.logger.log(`Web push notification sent to user ${userId}`);
        } catch (error: any) {
          this.logger.error(`Failed to send Web push to user ${userId}:`, error);
          if (error.statusCode === 410 || error.statusCode === 404) {
            user.webPushSubscription = null;
            await this.userRepo.save(user);
            this.logger.log(`Removed invalid Web Push subscription for user ${userId}`);
          }
        }
      }

      // Save notification record
      await this.notificationRepo.save({
        userId,
        title,
        message,
        data: data || null,
        status: notificationSent ? 'sent' : 'failed',
        platform,
      });

      if (!notificationSent) {
        this.logger.warn(`No notification sent to user ${userId} - no valid tokens found`);
      }
    } catch (error) {
      this.logger.error(`Error processing notification for user ${userId}:`, error);
      throw error;
    }
  }

  async registerExpoToken(userId: string, token: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    user.expoToken = token;
    return this.userRepo.save(user);
  }

  async registerWebPush(userId: string, subscription: any): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    user.webPushSubscription = JSON.stringify(subscription);
    return this.userRepo.save(user);
  }

  async saveNotification(notification: Partial<Notification>): Promise<Notification> {
    const newNotification = this.notificationRepo.create(notification);
    return this.notificationRepo.save(newNotification);
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.read = true;
    return this.notificationRepo.save(notification);
  }

  async markAllNotificationsAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.notificationRepo.update(
      { userId, read: false },
      { read: true }
    );

    return { count: result.affected || 0 };
  }

  /**
   * Map category to route URL
   */
  private mapCategoryToUrl(category: string, propertyId?: string, customUrl?: string): string {
    switch (category) {
      case 'properties':
        return '/properties';
      case 'property-detail':
        if (!propertyId) {
          throw new Error('propertyId is required for property-detail category');
        }
        return `/properties/${propertyId}`;
      case 'portfolio':
        return '/notifications?context=portfolio';
      case 'wallet':
        return '/notifications?context=wallet';
      case 'notifications':
        return '/notifications';
      case 'custom':
        if (!customUrl) {
          throw new Error('customUrl is required for custom category');
        }
        return customUrl;
      default:
        return '/notifications';
    }
  }

  /**
   * Send notifications to multiple users (admin function)
   */
  async sendNotificationsToUsers(
    userIds: string[],
    title: string,
    message: string,
    category: string,
    propertyId?: string,
    customUrl?: string,
  ): Promise<{ success: boolean; sent: number; failed: number; errors: string[] }> {
    // Validate and ensure userIds is an array
    if (!userIds) {
      throw new Error('userIds is required');
    }

    // Convert to array if it's not already
    const userIdsArray = Array.isArray(userIds) ? userIds : [userIds];
    
    if (userIdsArray.length === 0) {
      throw new Error('At least one user ID is required');
    }

    this.logger.log(`Sending notifications to ${userIdsArray.length} user(s)`);

    const errors: string[] = [];
    let sent = 0;
    let failed = 0;

    // Map category to URL
    let url: string;
    try {
      url = this.mapCategoryToUrl(category, propertyId, customUrl);
    } catch (error: any) {
      throw new Error(`Invalid notification category: ${error.message}`);
    }

    // Prepare notification data
    const notificationData: any = {
      type: category,
      url,
    };

    // Add property info if property-detail category
    if (category === 'property-detail' && propertyId) {
      notificationData.propertyId = propertyId;
      notificationData.propertyDisplayCode = propertyId; // Can be enhanced to fetch actual displayCode
    }

    // Queue notification for each user
    for (const userId of userIdsArray) {
      try {
        await this.queueNotification({
          userId,
          title,
          message,
          data: notificationData,
        });
        sent++;
        this.logger.log(`Notification queued for user ${userId}`);
      } catch (error: any) {
        failed++;
        const errorMsg = `Failed to queue notification for user ${userId}: ${error.message}`;
        errors.push(errorMsg);
        this.logger.error(errorMsg);
      }
    }

    return {
      success: failed === 0,
      sent,
      failed,
      errors,
    };
  }
}
