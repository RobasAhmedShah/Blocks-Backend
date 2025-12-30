import { Injectable, Logger } from '@nestjs/common';
import { PubSubMessageDto, GmailEventDto } from './dto/pubsub-message.dto';

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  /**
   * Process Pub/Sub message from Google Cloud
   * @param pubSubMessage The Pub/Sub message payload
   * @returns Processed Gmail event data
   */
  async processPubSubMessage(pubSubMessage: PubSubMessageDto): Promise<GmailEventDto | null> {
    try {
      // Check if message exists
      if (!pubSubMessage.message) {
        this.logger.warn('Pub/Sub message missing message field');
        return null;
      }

      // Extract base64 encoded data
      const data = pubSubMessage.message.data;
      
      if (!data) {
        this.logger.warn('Pub/Sub message missing data field');
        return null;
      }

      // Decode base64 to string
      const decodedData = Buffer.from(data, 'base64').toString('utf-8');
      this.logger.debug(`Decoded Pub/Sub data: ${decodedData}`);

      // Parse JSON
      const gmailEvent: GmailEventDto = JSON.parse(decodedData);

      // Validate required fields
      if (!gmailEvent.emailAddress || !gmailEvent.historyId) {
        this.logger.warn('Gmail event missing required fields', gmailEvent);
        return null;
      }

      // Log the event
      this.logger.log('Gmail event received:', {
        emailAddress: gmailEvent.emailAddress,
        historyId: gmailEvent.historyId,
        messageId: pubSubMessage.message.messageId,
        publishTime: pubSubMessage.message.publishTime,
        subscription: pubSubMessage.subscription,
      });

      return gmailEvent;
    } catch (error) {
      // Log error but don't throw - we still want to return 200 to prevent retries
      this.logger.error('Error processing Pub/Sub message:', error);
      return null;
    }
  }
}

