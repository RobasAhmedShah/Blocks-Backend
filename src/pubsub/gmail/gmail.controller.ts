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
    try {
      // Process the Pub/Sub message
      const gmailEvent = await this.gmailService.processPubSubMessage(body);

      // Always return 200 to acknowledge receipt (even if processing failed)
      // This prevents Pub/Sub from retrying the message
      return {
        success: true,
        message: gmailEvent ? 'Gmail event processed successfully' : 'Message received but processing failed',
      };
    } catch (error) {
      // Log error but still return 200 to prevent Pub/Sub retries
      this.logger.error('Error handling Gmail webhook:', error);
      return {
        success: false,
        message: 'Error processing webhook, but message acknowledged',
      };
    }
  }
}

