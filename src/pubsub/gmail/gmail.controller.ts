import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { GmailService } from './gmail.service';
import { PubSubMessageDto } from './dto/pubsub-message.dto';

@Controller('api/pubsub')
export class GmailController {
  private readonly logger = new Logger(GmailController.name);

  constructor(private readonly gmailService: GmailService) {}

  @Post('gmail')
  @Public() // Public endpoint - no authentication required for Pub/Sub webhooks
  @HttpCode(HttpStatus.OK)
  async handleGmailWebhook(@Body() body: PubSubMessageDto) {
    // Enhanced logging to debug webhook issues
    console.log('📩 ========== GMAIL WEBHOOK HIT ==========');
    console.log('📩 Gmail Push Received:', JSON.stringify(body, null, 2));
    this.logger.log('📩 ========== GMAIL WEBHOOK HIT ==========');
    this.logger.log('📩 Gmail Push Received (raw):', JSON.stringify(body, null, 2));
    this.logger.log('📩 Body type:', typeof body);
    this.logger.log('📩 Has message?', !!body.message);
    this.logger.log('📩 Has message.data?', !!body.message?.data);
    this.logger.log('📩 Subscription:', body.subscription);

    try {
      // Process the Pub/Sub message
      this.logger.log('📩 Starting to process Pub/Sub message...');
      const gmailEvent = await this.gmailService.processPubSubMessage(body);
      this.logger.log('📩 Processing completed. Result:', gmailEvent ? 'SUCCESS' : 'FAILED');

      // Always return 200 to acknowledge receipt (even if processing failed)
      // This prevents Pub/Sub from retrying the message
      return {
        success: true,
        message: gmailEvent ? 'Gmail event processed successfully' : 'Message received but processing failed',
        received: true,
      };
    } catch (error) {
      // Log error but still return 200 to prevent Pub/Sub retries
      this.logger.error('❌ Error handling Gmail webhook:', error);
      this.logger.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return {
        success: false,
        message: 'Error processing webhook, but message acknowledged',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

@Controller('api/gmail')
export class GmailWatchController {
  private readonly logger = new Logger(GmailWatchController.name);

  constructor(private readonly gmailService: GmailService) {}

  @Post('watch/renew')
  @Public() // Make public for testing (can be secured later if needed)
  @HttpCode(HttpStatus.OK)
  async renewGmailWatch(@Body() body?: any) {
    // Body is optional - endpoint doesn't require any input
    this.logger.log('🔄 Renewing Gmail watch...');

    try {
      const result = await this.gmailService.startGmailWatch();

      if (result.success) {
        return {
          success: true,
          message: 'Gmail watch started/renewed successfully',
          expiration: result.expiration,
          historyId: result.historyId,
        };
      } else {
        return {
          success: false,
          message: 'Failed to start/renew Gmail watch',
          error: result.error,
        };
      }
    } catch (error) {
      this.logger.error('Error renewing Gmail watch:', error);
      return {
        success: false,
        message: 'Error renewing Gmail watch',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Post('fetch-recent')
  @Public() // Make public for testing
  @HttpCode(HttpStatus.OK)
  async fetchRecentEmails(@Body() body?: any) {
    this.logger.log('🔍 Manually fetching and processing recent emails...');

    try {
      const result = await this.gmailService.fetchAndProcessRecentEmails();

      if (result.success) {
        return {
          success: true,
          message: `Successfully processed ${result.processed} email(s)`,
          processed: result.processed,
        };
      } else {
        return {
          success: false,
          message: 'Failed to fetch recent emails',
          error: result.error,
          processed: result.processed,
        };
      }
    } catch (error) {
      this.logger.error('Error fetching recent emails:', error);
      return {
        success: false,
        message: 'Error fetching recent emails',
        error: error instanceof Error ? error.message : 'Unknown error',
        processed: 0,
      };
    }
  }
}

