import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '@upstash/qstash';
import { ConfigService } from '@nestjs/config';
import { CreateNotificationJobDto } from './dto/create-notification-job.dto';
import { Notification } from './entities/notification.entity';
import { User } from '../admin/entities/user.entity';
import { OrganizationAdmin } from '../organization-admins/entities/organization-admin.entity';
import { BlocksAdmin } from '../blocks-admin/entities/blocks-admin.entity';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import * as webPush from 'web-push';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private qstash: Client;
  private expo: Expo;
  private firebaseApp: admin.app.App | null = null;
  private apiUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(OrganizationAdmin)
    private readonly orgAdminRepo: Repository<OrganizationAdmin>,
    @InjectRepository(BlocksAdmin)
    private readonly blocksAdminRepo: Repository<BlocksAdmin>,
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

    // Initialize Firebase Admin for FCM tokens
    // Use split environment variables (best practice for serverless/Vercel)
    // This avoids JSON parsing issues and newline escaping problems
    const firebaseProjectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const firebaseClientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const firebasePrivateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    
    // Fallback: support legacy FIREBASE_SERVICE_ACCOUNT JSON blob for backward compatibility
    const firebaseServiceAccount = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT');

    // Log Firebase credential configuration status (full values for testing)
    this.logger.log('🔍 Firebase Credentials Check:');
    this.logger.log(`   FIREBASE_PROJECT_ID: ${firebaseProjectId ? `✅ Present (${firebaseProjectId})` : '❌ Missing'}`);
    this.logger.log(`   FIREBASE_CLIENT_EMAIL: ${firebaseClientEmail ? `✅ Present (${firebaseClientEmail})` : '❌ Missing'}`);
    this.logger.log(`   FIREBASE_PRIVATE_KEY: ${firebasePrivateKey ? `✅ Present (length: ${firebasePrivateKey.length}, has BEGIN: ${firebasePrivateKey.includes('BEGIN PRIVATE KEY')}, has END: ${firebasePrivateKey.includes('END PRIVATE KEY')}, escaped newlines: ${(firebasePrivateKey.match(/\\n/g) || []).length})` : '❌ Missing'}`);
    this.logger.log(`   FIREBASE_SERVICE_ACCOUNT (legacy): ${firebaseServiceAccount ? `✅ Present (length: ${firebaseServiceAccount.length}, is JSON: ${firebaseServiceAccount.trim().startsWith('{')})` : '❌ Missing'}`);
    
    if (firebasePrivateKey) {
      // Show full private key for testing
      this.logger.log(`   FIREBASE_PRIVATE_KEY (full value): ${firebasePrivateKey}`);
    }
    
    if (firebaseServiceAccount) {
      // Show full legacy JSON blob for testing
      this.logger.log(`   FIREBASE_SERVICE_ACCOUNT (full value): ${firebaseServiceAccount}`);
    }

    if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
      // Preferred method: split environment variables
      try {
        // Normalize private key: replace escaped newlines with actual newlines
        // Vercel may store \n as literal \\n, so we handle both cases
        const escapedNewlineCount = (firebasePrivateKey.match(/\\n/g) || []).length;
        const actualNewlineCount = (firebasePrivateKey.match(/\n/g) || []).length;
        
        this.logger.log(`   Normalizing private key: ${escapedNewlineCount} escaped newlines (\\n), ${actualNewlineCount} actual newlines`);
        
        const normalizedPrivateKey = firebasePrivateKey
          .replace(/\\n/g, '\n')  // Replace escaped newlines
          .replace(/\r\n/g, '\n')  // Normalize Windows line endings
          .replace(/\r/g, '\n');   // Normalize Mac line endings
        
        const normalizedNewlineCount = (normalizedPrivateKey.match(/\n/g) || []).length;
        this.logger.log(`   After normalization: ${normalizedNewlineCount} newlines in private key`);
        this.logger.log(`   Normalized Private Key (full value): ${normalizedPrivateKey}`);

        // Check if Firebase is already initialized
        try {
          this.firebaseApp = admin.app();
          this.logger.log('Firebase Admin already initialized, reusing existing instance');
        } catch {
          // Not initialized, create new instance
          this.firebaseApp = admin.initializeApp({
            credential: admin.credential.cert({
              projectId: firebaseProjectId,
              clientEmail: firebaseClientEmail,
              privateKey: normalizedPrivateKey,
            }),
          });
          this.logger.log('✅ Firebase Admin initialized for FCM notifications (using split env vars)');
        }
      } catch (error: any) {
        if (error.code === 'app/duplicate-app') {
          // Firebase already initialized, use existing instance
          this.firebaseApp = admin.app();
          this.logger.log('Firebase Admin already initialized, reusing existing instance');
        } else {
          this.logger.error('Failed to initialize Firebase Admin with split env vars:', {
            code: error.code,
            message: error.message,
          });
          this.logger.warn('FCM notifications will not work. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.');
        }
      }
    } else if (firebaseServiceAccount) {
      // Legacy method: parse JSON blob (for backward compatibility)
      this.logger.log('   Using legacy FIREBASE_SERVICE_ACCOUNT JSON blob method');
      try {
        const serviceAccount = JSON.parse(firebaseServiceAccount);
        
        this.logger.log(`   Parsed JSON blob: project_id=${serviceAccount.project_id}, client_email=${serviceAccount.client_email}`);
        
        // Normalize private key newlines
        if (serviceAccount.private_key) {
          const escapedNewlineCount = (serviceAccount.private_key.match(/\\n/g) || []).length;
          const actualNewlineCount = (serviceAccount.private_key.match(/\n/g) || []).length;
          this.logger.log(`   Private key in JSON: ${escapedNewlineCount} escaped newlines (\\n), ${actualNewlineCount} actual newlines`);
          
          serviceAccount.private_key = serviceAccount.private_key
            .replace(/\\n/g, '\n')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');
          
          const normalizedNewlineCount = (serviceAccount.private_key.match(/\n/g) || []).length;
          this.logger.log(`   After normalization: ${normalizedNewlineCount} newlines in private key`);
          this.logger.log(`   Normalized Private Key from JSON (full value): ${serviceAccount.private_key}`);
        }
        
        // Log full service account object for testing
        this.logger.log(`   Full Service Account Object: ${JSON.stringify(serviceAccount, null, 2)}`);

        // Check if Firebase is already initialized
        try {
          this.firebaseApp = admin.app();
          this.logger.log('Firebase Admin already initialized, reusing existing instance');
        } catch {
          // Not initialized, create new instance
          this.firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
          this.logger.log('✅ Firebase Admin initialized for FCM notifications (using legacy JSON blob)');
          this.logger.warn('⚠️  Consider migrating to split env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) for better reliability');
        }
      } catch (error: any) {
        if (error.code === 'app/duplicate-app') {
          // Firebase already initialized, use existing instance
          this.firebaseApp = admin.app();
          this.logger.log('Firebase Admin already initialized, reusing existing instance');
        } else {
          this.logger.error('Failed to initialize Firebase Admin with JSON blob:', {
            code: error.code,
            message: error.message,
          });
          this.logger.warn('FCM notifications will not work. Check FIREBASE_SERVICE_ACCOUNT environment variable.');
          this.logger.warn('⚠️  Consider using split env vars instead: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
        }
      }
    } else {
      this.logger.warn('Firebase credentials not configured - FCM notifications will not work for standalone builds');
      this.logger.warn('⚠️ To enable FCM notifications for standalone APK builds:');
      this.logger.warn('   Option 1 (Recommended): Set split environment variables:');
      this.logger.warn('     - FIREBASE_PROJECT_ID=blocks-1b5ba');
      this.logger.warn('     - FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@blocks-1b5ba.iam.gserviceaccount.com');
      this.logger.warn('     - FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----');
      this.logger.warn('   Option 2 (Legacy): Set FIREBASE_SERVICE_ACCOUNT with full JSON as single-line string');
    }
    
    // Log Firebase initialization status
    this.logger.log(`🔥 Firebase Admin SDK Status: ${this.firebaseApp ? '✅ Initialized' : '❌ Not Initialized'}`);

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

      // Send push notification (Expo or FCM)
      if (user.expoToken) {
        try {
          // Check if it's a valid Expo push token OR if it looks like an FCM token
          // FCM tokens are long strings without the ExponentPushToken[] wrapper
          // Expo tokens are in format: ExponentPushToken[xxxxxxxxxxxxxx]
          const isExpoToken = Expo.isExpoPushToken(user.expoToken);
          // FCM tokens: typically 140+ characters, no ExponentPushToken wrapper, alphanumeric
          // In standalone APK builds, getExpoPushTokenAsync returns raw FCM tokens
          const tokenStr = String(user.expoToken);
          const isFCMToken =
            !isExpoToken &&
            tokenStr.length > 100 &&
            !tokenStr.includes('ExponentPushToken') &&
            // FCM registration tokens commonly contain ':' and sometimes '.'
            /^[A-Za-z0-9:._-]+$/.test(tokenStr);
          
          this.logger.log(`🔍 Token analysis for user ${userId}:`, {
            tokenLength: tokenStr.length,
            isExpoToken,
            isFCMToken,
            hasFirebaseApp: !!this.firebaseApp,
            tokenPreview: tokenStr.substring(0, 30) + '...',
            firebaseInitialized: !!this.firebaseApp,
          });
          
          // Ensure URL is always included in notification data
          const notificationUrl = data?.url || '/notifications?context=portfolio';
          
          if (isFCMToken && this.firebaseApp) {
            // Send FCM token directly via Firebase Admin SDK
            this.logger.log(`📤 Sending FCM push notification to user ${userId}`, {
              token: tokenStr.substring(0, 20) + '...',
              title,
              message,
              url: notificationUrl,
            });

            try {
              const fcmMessage: admin.messaging.Message = {
                token: tokenStr,
                notification: {
                  title,
                  body: message,
                },
                data: {
                  ...(data || {}),
                  url: notificationUrl,
                  // Convert all data values to strings (FCM requirement)
                  ...Object.fromEntries(
                    Object.entries(data || {}).map(([key, value]) => [
                      key,
                      typeof value === 'string' ? value : JSON.stringify(value),
                    ])
                  ),
                },
                android: {
                  priority: 'high' as const,
                  notification: {
                    sound: 'default',
                    channelId: 'default',
                  },
                },
                apns: {
                  payload: {
                    aps: {
                      sound: 'default',
                    },
                  },
                },
              };

              const response = await admin.messaging().send(fcmMessage);
              this.logger.log(`✅ FCM notification sent successfully to user ${userId}. Message ID: ${response}`);
              notificationSent = true;
              platform = 'expo'; // Keep as 'expo' for consistency in database
            } catch (fcmError: any) {
              this.logger.error(`❌ Failed to send FCM notification to user ${userId}:`, {
                error: fcmError.message,
                code: fcmError.code,
                errorInfo: fcmError.errorInfo,
              });
              
              // Handle invalid tokens
              if (
                fcmError.code === 'messaging/invalid-registration-token' ||
                fcmError.code === 'messaging/registration-token-not-registered' ||
                fcmError.message?.includes('Invalid registration token')
              ) {
                this.logger.warn(`🗑️ Removing invalid FCM token for user ${userId}`);
                user.expoToken = null;
                await this.userRepo.save(user);
                this.logger.log(`✅ Removed invalid FCM token for user ${userId}`);
              } else {
                // Log other FCM errors for debugging
                this.logger.error(`FCM error details:`, {
                  code: fcmError.code,
                  message: fcmError.message,
                  errorInfo: fcmError.errorInfo,
                });
              }
            }
          } else if (isExpoToken) {
            // Send Expo push token via Expo service
            this.logger.log(`📤 Sending Expo push notification to user ${userId}`, {
              token: user.expoToken.substring(0, 20) + '...',
              title,
              message,
              url: notificationUrl,
            });

            const messages: ExpoPushMessage[] = [
              {
                to: user.expoToken,
                sound: 'default',
                title,
                body: message,
                data: {
                  ...(data || {}),
                  url: notificationUrl,
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
                this.logger.error(`Expo push error: ${ticket.message}`, ticket.details);
                if (
                  ticket.details?.error === 'DeviceNotRegistered' ||
                  ticket.details?.error === 'InvalidCredentials' ||
                  ticket.message?.includes('Invalid token')
                ) {
                  user.expoToken = null;
                  await this.userRepo.save(user);
                  this.logger.log(`Removed invalid Expo token for user ${userId}`);
                }
              } else {
                notificationSent = true;
                platform = 'expo';
                this.logger.log(`✅ Expo notification sent successfully to user ${userId}`);
              }
            }
          } else {
            // Unknown token format - try Expo first, then FCM if available
            this.logger.warn(`Unknown token format for user ${userId}. Token: ${user.expoToken.substring(0, 30)}...`);
            
            // Try Expo service first
            try {
              const messages: ExpoPushMessage[] = [
                {
                  to: user.expoToken,
                  sound: 'default',
                  title,
                  body: message,
                  data: {
                    ...(data || {}),
                    url: notificationUrl,
                  },
                },
              ];
              const chunks = this.expo.chunkPushNotifications(messages);
              for (const chunk of chunks) {
                const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
                for (const ticket of ticketChunk) {
                  if (ticket.status === 'ok') {
                    notificationSent = true;
                    platform = 'expo';
                    this.logger.log(`✅ Push notification sent (Expo fallback) to user ${userId}`);
                    return; // Success, exit early
                  }
                }
              }
            } catch (expoError) {
              this.logger.warn(`Expo service failed, trying FCM:`, expoError);
            }

            // If Expo failed and FCM is available, try FCM
            if (!notificationSent && this.firebaseApp) {
              try {
                const fcmMessage: admin.messaging.Message = {
                  token: user.expoToken,
                  notification: { title, body: message },
                  data: {
                    ...(data || {}),
                    url: notificationUrl,
                    ...Object.fromEntries(
                      Object.entries(data || {}).map(([key, value]) => [
                        key,
                        typeof value === 'string' ? value : JSON.stringify(value),
                      ])
                    ),
                  },
                };
                await admin.messaging().send(fcmMessage);
                notificationSent = true;
                platform = 'expo';
                this.logger.log(`✅ Push notification sent (FCM fallback) to user ${userId}`);
              } catch (fcmError) {
                this.logger.error(`Both Expo and FCM failed for user ${userId}:`, fcmError);
              }
            }
          }
        } catch (error) {
          this.logger.error(`Failed to send push notification to user ${userId}:`, error);
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
        recipientType: 'user',
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

    // Log token registration for debugging
    const isExpoToken = Expo.isExpoPushToken(token);
    const tokenStr = String(token); // Ensure it's a string
    const isFCMToken =
      !isExpoToken &&
      tokenStr.length > 100 &&
      !tokenStr.includes('ExponentPushToken') &&
      // FCM registration tokens commonly contain ':' and sometimes '.'
      /^[A-Za-z0-9:._-]+$/.test(tokenStr);
    
    this.logger.log(`📝 Registering push token for user ${userId}:`, {
      tokenType: isExpoToken ? 'Expo' : isFCMToken ? 'FCM' : 'Unknown',
      tokenLength: tokenStr.length,
      tokenPreview: tokenStr.substring(0, 30) + '...',
      hasFirebaseApp: !!this.firebaseApp,
    });

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
    const notifications = await this.notificationRepo.find({
      where: [
        { userId, recipientType: 'user' },
      ],
      order: { createdAt: 'DESC' },
      take: 50,
    });
    
    this.logger.log(`📬 Found ${notifications.length} notifications for user ${userId}`);
    return notifications;
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
        // Properties list - route to property tab in mobile app
        return '/properties';
      case 'property-detail':
        if (!propertyId) {
          throw new Error('propertyId is required for property-detail category');
        }
        // Property detail - route to specific property screen
        // Mobile app uses /property/{id}, web uses /properties/{id}
        // We'll use /properties/{id} and handle both in mobile app
        return `/properties/${propertyId}`;
      case 'portfolio':
        // Portfolio - route to portfolio tab
        return '/portfolio';
      case 'wallet':
        // Wallet - route to wallet tab
        return '/wallet';
      case 'notifications':
        // Notifications - route to notifications page
        return '/notifications';
      case 'custom':
        if (!customUrl) {
          throw new Error('customUrl is required for custom category');
        }
        // Custom URL - can be external (http/https) or internal
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

  /**
   * Send notification to organization admin (web push only)
   */
  async sendNotificationToOrgAdmin(
    organizationAdminId: string,
    title: string,
    message: string,
    data?: any,
  ): Promise<void> {
    try {
      this.logger.log(`Sending notification to organization admin ${organizationAdminId}`);
      
      // Fetch organization admin with web push subscription
      const orgAdmin = await this.orgAdminRepo.findOne({
        where: { id: organizationAdminId },
        select: ['id', 'webPushSubscription', 'email'],
      });

      if (!orgAdmin) {
        this.logger.warn(`Organization admin ${organizationAdminId} not found`);
        return;
      }

      let notificationSent = false;
      let platform: 'web' | null = null;

      // Send Web Push notification
      if (orgAdmin.webPushSubscription) {
        try {
          const subscription = JSON.parse(orgAdmin.webPushSubscription);
          const payload = JSON.stringify({
            title,
            message,
            data: data || {},
          });

          await webPush.sendNotification(subscription, payload);
          notificationSent = true;
          platform = 'web';
          this.logger.log(`Web push notification sent to organization admin ${organizationAdminId}`);
        } catch (error: any) {
          this.logger.error(`Failed to send Web push to organization admin ${organizationAdminId}:`, error);
          if (error.statusCode === 410 || error.statusCode === 404) {
            orgAdmin.webPushSubscription = null;
            await this.orgAdminRepo.save(orgAdmin);
            this.logger.log(`Removed invalid Web Push subscription for organization admin ${organizationAdminId}`);
          }
        }
      } else {
        this.logger.warn(`Organization admin ${organizationAdminId} has no web push subscription registered`);
      }

      // Save notification record - ALWAYS save even if web push failed
      const savedNotification = await this.notificationRepo.save({
        organizationAdminId,
        recipientType: 'org_admin',
        title,
        message,
        data: data || null,
        status: notificationSent ? 'sent' : 'failed',
        platform,
        read: false, // Ensure it's marked as unread
      });
      
      this.logger.log(`✅ Notification record saved for org admin ${organizationAdminId}, notification ID: ${savedNotification.id}, status: ${savedNotification.status}`);

      if (!notificationSent) {
        this.logger.warn(`No notification sent to organization admin ${organizationAdminId} - no valid subscription found`);
      }
    } catch (error) {
      this.logger.error(`Error sending notification to organization admin ${organizationAdminId}:`, error);
      throw error;
    }
  }

  /**
   * Send notification to Blocks admin (super admin)
   */
  async sendNotificationToBlocksAdmin(
    title: string,
    message: string,
    data?: any,
  ): Promise<void> {
    try {
      this.logger.log('Sending notification to Blocks admin');
      
      // Find Blocks admin account (separate from end users)
      const blocksAdmin = await this.blocksAdminRepo.findOne({
        where: { isActive: true },
        order: { createdAt: 'ASC' },
        select: ['id', 'email', 'webPushSubscription', 'isActive'],
      });

      if (!blocksAdmin) {
        this.logger.warn('Blocks admin not found - no active blocks admin accounts');
        return;
      }

      this.logger.log(`Found Blocks admin: ${blocksAdmin.email} (id: ${blocksAdmin.id})`);

      let notificationSent = false;
      let platform: 'web' | null = null;

      // Send Web Push notification
      if (blocksAdmin.webPushSubscription) {
        try {
          const subscription = JSON.parse(blocksAdmin.webPushSubscription);
          const payload = JSON.stringify({
            title,
            message,
            data: data || {},
          });

          await webPush.sendNotification(subscription, payload);
          notificationSent = true;
          platform = 'web';
          this.logger.log(`Web push notification sent to Blocks admin (${blocksAdmin.email})`);
        } catch (error: any) {
          this.logger.error(`Failed to send Web push to Blocks admin:`, error);
          if (error.statusCode === 410 || error.statusCode === 404) {
            blocksAdmin.webPushSubscription = null;
            await this.blocksAdminRepo.save(blocksAdmin);
            this.logger.log(`Removed invalid Web Push subscription for Blocks admin`);
          }
        }
      } else {
        this.logger.warn(`Blocks admin (${blocksAdmin.email}) has no web push subscription registered`);
      }

      // Save notification record - ALWAYS save even if web push failed
      const savedNotification = await this.notificationRepo.save({
        blocksAdminId: blocksAdmin.id,
        recipientType: 'blocks_admin',
        title,
        message,
        data: data || null,
        status: notificationSent ? 'sent' : 'failed',
        platform,
        read: false, // Ensure it's marked as unread
      });
      
      this.logger.log(`✅ Notification record saved for Blocks admin ${blocksAdmin.id} (${blocksAdmin.email}), notification ID: ${savedNotification.id}, status: ${savedNotification.status}`);

      if (!notificationSent) {
        this.logger.warn(`No notification sent to Blocks admin - no valid subscription found`);
      }
    } catch (error) {
      this.logger.error(`Error sending notification to Blocks admin:`, error);
      throw error;
    }
  }

  /**
   * Register web push subscription for organization admin
   */
  async registerOrgAdminWebPush(organizationAdminId: string, subscription: any): Promise<OrganizationAdmin> {
    const orgAdmin = await this.orgAdminRepo.findOne({ 
      where: { id: organizationAdminId },
      select: ['id', 'organizationId', 'email', 'webPushSubscription'],
    });
    if (!orgAdmin) {
      throw new NotFoundException('Organization admin not found');
    }

    orgAdmin.webPushSubscription = JSON.stringify(subscription);
    return this.orgAdminRepo.save(orgAdmin);
  }

  /**
   * Get notifications for organization admin
   */
  async getOrgAdminNotifications(organizationAdminId: string): Promise<Notification[]> {
    this.logger.log(`Fetching notifications for org admin ${organizationAdminId}`);
    const notifications = await this.notificationRepo.find({
      where: { organizationAdminId, recipientType: 'org_admin' },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    this.logger.log(`Found ${notifications.length} notifications for org admin ${organizationAdminId}`);
    return notifications;
  }

  /**
   * Get notifications for Blocks admin
   */
  async getBlocksAdminNotifications(): Promise<Notification[]> {
    const blocksAdmin = await this.blocksAdminRepo.findOne({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
      select: ['id', 'email', 'isActive'],
    });

    if (!blocksAdmin) {
      this.logger.warn('Blocks admin not found when fetching notifications');
      return [];
    }

    this.logger.log(`Fetching notifications for Blocks admin: ${blocksAdmin.id} (${blocksAdmin.email})`);

    const notifications = await this.notificationRepo.find({
      where: { blocksAdminId: blocksAdmin.id, recipientType: 'blocks_admin' },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    
    this.logger.log(`Found ${notifications.length} notifications for Blocks admin ${blocksAdmin.id}`);
    return notifications;
  }
}
