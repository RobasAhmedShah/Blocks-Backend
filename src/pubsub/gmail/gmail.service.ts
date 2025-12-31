import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import Decimal from 'decimal.js';
import { PubSubMessageDto, GmailEventDto } from './dto/pubsub-message.dto';
import { GmailSync } from './entities/gmail-sync.entity';
import { WalletService } from '../../wallet/wallet.service';
import { User } from '../../admin/entities/user.entity';
import { Wallet } from '../../wallet/entities/wallet.entity';

interface ParsedTransaction {
  amount: Decimal;
  accountLast4: string;
  transactionRef: string;
  isCredit: boolean;
  emailSubject: string;
  emailFrom: string;
}

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private gmail: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(GmailSync)
    private readonly gmailSyncRepo: Repository<GmailSync>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly walletService: WalletService,
  ) {
    this.initializeGmailClient();
  }

  private initializeGmailClient() {
    try {
      // Try OAuth2 first (for personal Gmail accounts)
      const clientId = this.configService.get<string>('GMAIL_CLIENT_ID');
      const clientSecret = this.configService.get<string>('GMAIL_CLIENT_SECRET');
      const refreshToken = this.configService.get<string>('GMAIL_REFRESH_TOKEN');

      if (clientId && clientSecret && refreshToken) {
        // Use OAuth2 for personal Gmail accounts
        const oauth2Client = new google.auth.OAuth2(
          clientId,
          clientSecret,
          'urn:ietf:wg:oauth:2.0:oob' // Redirect URI for installed apps
        );

        oauth2Client.setCredentials({
          refresh_token: refreshToken,
        });

        this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        this.logger.log('✅ Gmail API client initialized (OAuth2)');
        return;
      }

      // Fallback to service account (for Workspace accounts with domain-wide delegation)
      const credentialsJson = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON');
      const userEmail = this.configService.get<string>('GMAIL_WATCHED_EMAIL');

      if (!credentialsJson || !userEmail) {
        this.logger.warn('Gmail API credentials not configured. Email processing will be disabled.');
        this.logger.warn('Required env vars: Either (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN) OR (GOOGLE_SERVICE_ACCOUNT_JSON, GMAIL_WATCHED_EMAIL)');
        return;
      }

      const credentials = JSON.parse(credentialsJson);
      
      // Create JWT client for service account
      const auth = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.modify', // Needed for watch
        ],
        subject: userEmail, // Impersonate the user (requires domain-wide delegation)
      });

      this.gmail = google.gmail({ version: 'v1', auth });
      this.logger.log('✅ Gmail API client initialized (Service Account)');
    } catch (error) {
      this.logger.error('Failed to initialize Gmail API client:', error);
    }
  }

  /**
   * Start or renew Gmail watch
   * Gmail watches expire after 7 days, so this should be called periodically
   * @returns Watch response with expiration timestamp
   */
  async startGmailWatch(): Promise<{ success: boolean; expiration?: string; historyId?: string; error?: string }> {
    try {
      if (!this.gmail) {
        this.logger.error('Gmail API client not initialized');
        return {
          success: false,
          error: 'Gmail API client not initialized. Check GOOGLE_SERVICE_ACCOUNT_JSON and GMAIL_WATCHED_EMAIL env vars.',
        };
      }

      const userEmail = this.configService.get<string>('GMAIL_WATCHED_EMAIL');
      // Support both GMAIL_PUBSUB_TOPIC and GMAIL_TOPIC_NAME for backward compatibility
      const pubSubTopic = this.configService.get<string>('GMAIL_PUBSUB_TOPIC') || 
                         this.configService.get<string>('GMAIL_TOPIC_NAME');

      if (!userEmail) {
        return {
          success: false,
          error: 'GMAIL_WATCHED_EMAIL not configured',
        };
      }

      if (!pubSubTopic) {
        return {
          success: false,
          error: 'GMAIL_PUBSUB_TOPIC or GMAIL_TOPIC_NAME not configured. Format: projects/{project-id}/topics/{topic-name}',
        };
      }

      this.logger.log(`Starting Gmail watch for ${userEmail} on topic ${pubSubTopic}`);

      // Get current historyId before starting watch (to know where to start from)
      const profile = await this.gmail.users.getProfile({ userId: 'me' });
      const currentHistoryId = profile.data.historyId;

      // Start watch - watches all labels by default (can specify labelIds: ['INBOX'] to watch only inbox)
      const watchResponse = await this.gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: pubSubTopic,
          labelIds: ['INBOX'], // Only watch INBOX label (optional, remove to watch all)
        },
      });

      const expiration = watchResponse.data.expiration;
      const expirationDate = expiration ? new Date(parseInt(expiration)).toISOString() : undefined;

      this.logger.log(`✅ Gmail watch started successfully`);
      this.logger.log(`   Expiration: ${expirationDate || 'Not provided'}`);
      this.logger.log(`   Current History ID: ${currentHistoryId}`);

      return {
        success: true,
        expiration: expirationDate,
        historyId: currentHistoryId,
      };
    } catch (error: any) {
      this.logger.error('Failed to start Gmail watch:', error);
      
      let errorMessage = 'Unknown error';
      if (error.response?.data?.error) {
        errorMessage = `${error.response.data.error.message || error.response.data.error}`;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Process Pub/Sub message from Google Cloud
   */
  async processPubSubMessage(pubSubMessage: PubSubMessageDto): Promise<GmailEventDto | null> {
    try {
      this.logger.log('🔍 ========== PROCESSING PUB/SUB MESSAGE ==========');
      this.logger.log('🔍 Raw Pub/Sub message:', JSON.stringify(pubSubMessage, null, 2));

      let gmailEvent: GmailEventDto;

      // Gmail Watch sends DIRECT payload: {emailAddress, historyId}
      // NOT wrapped in message.data like standard Pub/Sub
      if ('emailAddress' in pubSubMessage && 'historyId' in pubSubMessage) {
        this.logger.log('🔍 Direct Gmail Watch event detected');
        gmailEvent = {
          emailAddress: (pubSubMessage as any).emailAddress,
          historyId: String((pubSubMessage as any).historyId),
        };
      } 
      // Fallback: Handle standard Pub/Sub format (for testing/manual calls)
      else if (pubSubMessage.message?.data) {
        this.logger.log('🔍 Standard Pub/Sub format detected, decoding base64...');
        const decodedData = Buffer.from(pubSubMessage.message.data, 'base64').toString('utf-8');
        this.logger.log('🔍 Decoded data:', decodedData);
        gmailEvent = JSON.parse(decodedData);
      } 
      else {
        this.logger.error('❌ Invalid message format');
        this.logger.error('❌ Expected: {emailAddress, historyId} OR {message: {data: "base64..."}}');
        this.logger.error('❌ Received:', JSON.stringify(pubSubMessage, null, 2));
        return null;
      }

      this.logger.log('🔍 Parsed Gmail event:', JSON.stringify(gmailEvent, null, 2));

      if (!gmailEvent.emailAddress || !gmailEvent.historyId) {
        this.logger.error('❌ Gmail event missing required fields');
        this.logger.error('❌ emailAddress:', gmailEvent.emailAddress);
        this.logger.error('❌ historyId:', gmailEvent.historyId);
        return null;
      }

      this.logger.log('✅ Gmail event received:', {
        emailAddress: gmailEvent.emailAddress,
        historyId: gmailEvent.historyId,
      });

      // Process the Gmail event (fetch history, parse emails, credit wallets)
      this.logger.log('🔍 Starting to process Gmail event...');
      await this.processGmailEvent(gmailEvent);
      this.logger.log('✅ Gmail event processing completed');

      return gmailEvent;
    } catch (error) {
      this.logger.error('❌ Error processing Pub/Sub message:', error);
      this.logger.error('❌ Error details:', error instanceof Error ? error.stack : 'No stack trace');
      return null;
    }
  }

  /**
   * Manually fetch and process recent emails (for testing)
   * Fetches emails from the last processed historyId to current, or recent messages if no historyId
   */
  async fetchAndProcessRecentEmails(): Promise<{ success: boolean; processed: number; error?: string }> {
    if (!this.gmail) {
      return {
        success: false,
        processed: 0,
        error: 'Gmail API not initialized',
      };
    }

    try {
      const userEmail = this.configService.get<string>('GMAIL_WATCHED_EMAIL') || 'me';
      
      // Get current profile to get latest historyId
      const profile = await this.gmail.users.getProfile({ userId: 'me' });
      const currentHistoryId = profile.data.historyId;

      // Get sync record
      let sync = await this.gmailSyncRepo.findOne({ where: { emailAddress: userEmail } });
      const lastHistoryId = sync?.lastHistoryId;

      let messageIds: string[] = [];
      let useHistoryApi = false;

      if (lastHistoryId && lastHistoryId !== '0') {
        // Use history API if we have a valid lastHistoryId
        this.logger.log(`🔍 Fetching emails from historyId ${lastHistoryId} to ${currentHistoryId}`);
        
        try {
          const historyResponse = await this.gmail.users.history.list({
            userId: 'me',
            startHistoryId: lastHistoryId,
            historyTypes: ['messageAdded'],
          });

          const history = historyResponse.data.history || [];
          for (const entry of history) {
            if (entry.messagesAdded) {
              for (const msg of entry.messagesAdded) {
                if (msg.message?.id) {
                  messageIds.push(msg.message.id);
                }
              }
            }
          }
          useHistoryApi = true;
        } catch (error: any) {
          // If history API fails (e.g., historyId too old), fall back to fetching recent messages
          this.logger.warn(`History API failed: ${error.message}. Falling back to recent messages.`);
          useHistoryApi = false;
        }
      }

      // If no historyId or history API failed, fetch recent messages directly
      if (!useHistoryApi || messageIds.length === 0) {
        this.logger.log(`🔍 Fetching recent messages directly (no valid historyId)`);
        
        // Fetch last 10 messages from INBOX
        const messagesResponse = await this.gmail.users.messages.list({
          userId: 'me',
          labelIds: ['INBOX'],
          maxResults: 10,
        });

        const messages = messagesResponse.data.messages || [];
        messageIds = messages.map((msg: any) => msg.id);
        this.logger.log(`Found ${messageIds.length} recent messages`);
      }

      // Process each message
      let processedCount = 0;
      for (const messageId of messageIds) {
        try {
          await this.processEmailMessage(messageId);
          processedCount++;
        } catch (error) {
          this.logger.error(`Error processing message ${messageId}:`, error);
        }
      }

      // Update last processed history ID
      if (!sync) {
        sync = this.gmailSyncRepo.create({
          emailAddress: userEmail,
          lastHistoryId: currentHistoryId,
        });
      } else {
        sync.lastHistoryId = currentHistoryId;
      }
      await this.gmailSyncRepo.save(sync);

      return {
        success: true,
        processed: processedCount,
      };
    } catch (error: any) {
      this.logger.error('Error fetching recent emails:', error);
      return {
        success: false,
        processed: 0,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Process Gmail event: fetch history, get emails, parse transactions
   */
  private async processGmailEvent(event: GmailEventDto): Promise<void> {
    if (!this.gmail) {
      this.logger.warn('Gmail API not initialized. Skipping email processing.');
      return;
    }

    try {
      // Get or create sync record
      let sync = await this.gmailSyncRepo.findOne({ where: { emailAddress: event.emailAddress } });
      const lastHistoryId = sync?.lastHistoryId || '0';

      this.logger.log(`🔍 Fetching Gmail history from ${lastHistoryId} to ${event.historyId}`);

      // Fetch Gmail history
      let historyResponse;
      try {
        historyResponse = await this.gmail.users.history.list({
          userId: 'me',
          startHistoryId: lastHistoryId,
          historyTypes: ['messageAdded'],
        });
      } catch (error: any) {
        // If historyId is too old or invalid, try without startHistoryId
        if (error.code === 404 || error.message?.includes('not found')) {
          this.logger.warn(`⚠️  History API failed with startHistoryId ${lastHistoryId}, trying without it`);
          historyResponse = await this.gmail.users.history.list({
            userId: 'me',
            historyTypes: ['messageAdded'],
            maxResults: 10, // Limit to recent 10 messages
          });
        } else {
          throw error;
        }
      }

      const history = historyResponse.data.history || [];
      this.logger.log(`📋 Found ${history.length} history entries`);

      // Collect all new message IDs
      const messageIds: string[] = [];
      for (const entry of history) {
        if (entry.messagesAdded) {
          for (const msg of entry.messagesAdded) {
            if (msg.message?.id) {
              messageIds.push(msg.message.id);
            }
          }
        }
      }

      this.logger.log(`📨 Found ${messageIds.length} new message(s) to process`);

      // Process each message
      for (const messageId of messageIds) {
        await this.processEmailMessage(messageId);
      }

      // Update last processed history ID
      if (!sync) {
        sync = this.gmailSyncRepo.create({
          emailAddress: event.emailAddress,
          lastHistoryId: event.historyId,
        });
      } else {
        sync.lastHistoryId = event.historyId;
      }
      await this.gmailSyncRepo.save(sync);

      this.logger.log(`✅ Processed Gmail history up to ${event.historyId}`);
    } catch (error) {
      this.logger.error('Error processing Gmail event:', error);
      throw error;
    }
  }

  /**
   * Process a single email message
   */
  private async processEmailMessage(messageId: string): Promise<void> {
    try {
      this.logger.debug(`Fetching email message: ${messageId}`);

      // Get full message
      const messageResponse = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = messageResponse.data;
      const headers = message.payload?.headers || [];
      
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';

      this.logger.log(`📧 Email received - From: ${from}, Subject: ${subject}`);

      // Classify email (ignore if not from Allied Bank or is debit)
      // TEMPORARY: Disabled for testing - set ENABLE_BANK_FILTER=true to re-enable
      const enableBankFilter = this.configService.get<string>('ENABLE_BANK_FILTER') === 'true';
      if (enableBankFilter && !this.isAlliedBankEmail(from, subject)) {
        this.logger.debug(`Ignoring email - not from Allied Bank or is debit`);
        return;
      } else if (!enableBankFilter) {
        this.logger.log(`⚠️  Bank filter disabled for testing - processing all emails`);
      }

      // Parse email body
      const body = this.extractEmailBody(message.payload);
      this.logger.log(`📄 Email body extracted (${body.length} chars)`);
      this.logger.log(`📄 Email body content (first 500 chars): ${body.substring(0, 500)}`);

      // Parse transaction details
      const transaction = this.parseTransaction(body, subject, from);
      if (!transaction) {
        this.logger.warn('❌ Failed to parse transaction from email');
        this.logger.warn(`   Subject: ${subject}`);
        this.logger.warn(`   From: ${from}`);
        this.logger.warn(`   Body preview: ${body.substring(0, 200)}`);
        return;
      }

      // ALWAYS skip debit transactions - only process credit (received) emails
      if (!transaction.isCredit) {
        this.logger.log(`⚠️  Skipping debit transaction - only processing credit (received) emails`);
        this.logger.log(`   Email subject: ${subject}`);
        this.logger.log(`   Email indicates: sent from account (debit)`);
        return;
      }
      
      this.logger.log(`✅ Credit transaction detected - email indicates: received in account`);

      this.logger.log(`💰 Transaction parsed successfully:`);
      this.logger.log(`   Amount: PKR ${transaction.amount}`);
      this.logger.log(`   Account Last 4: ***${transaction.accountLast4}`);
      this.logger.log(`   Transaction Ref: ${transaction.transactionRef}`);
      this.logger.log(`   Is Credit: ${transaction.isCredit}`);
      this.logger.log(`   Email From: ${transaction.emailFrom}`);
      this.logger.log(`   Email Subject: ${transaction.emailSubject}`);

      // TEMPORARY: Skip wallet crediting - bank account feature not integrated yet
      // When bank account feature is added, uncomment the creditUserWallet call below
      this.logger.log(`⚠️  WALLET CREDITING DISABLED: Bank account feature not yet integrated`);
      this.logger.log(`📊 Would credit wallet:`);
      this.logger.log(`   - User match: bankAccountLast4 = ***${transaction.accountLast4}`);
      this.logger.log(`   - Amount: PKR ${transaction.amount}`);
      this.logger.log(`   - Transaction Ref: ${transaction.transactionRef}`);
      this.logger.log(`   - Email Message ID: ${messageId}`);
      this.logger.log(`   ✅ When bank accounts are integrated, this will automatically credit the wallet`);
      
      // TODO: Uncomment when bank account feature is integrated:
      // await this.creditUserWallet(transaction, messageId);

    } catch (error) {
      this.logger.error(`Error processing email message ${messageId}:`, error);
    }
  }

  /**
   * Check if email is from Allied Bank and is a credit transaction
   */
  private isAlliedBankEmail(from: string, subject: string): boolean {
    // Check if from Allied Bank
    if (!from.toLowerCase().includes('myabl@abl.com')) {
      return false;
    }

    // Ignore debit emails (sent from your account)
    if (subject.toLowerCase().includes('sent from your account') || 
        subject.toLowerCase().includes('debit')) {
      return false;
    }

    return true;
  }

  /**
   * Extract email body text
   */
  private extractEmailBody(payload: any): string {
    let body = '';

    if (payload.body?.data) {
      // Simple text body
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts) {
      // Multipart message
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        } else if (part.mimeType === 'text/html' && part.body?.data && !body) {
          // Fallback to HTML if no plain text
          const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
          // Simple HTML tag removal (basic)
          body = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
      }
    }

    return body;
  }

  /**
   * Parse transaction details from email body
   */
  private parseTransaction(body: string, subject: string, from: string): ParsedTransaction | null {
    try {
      // Extract amount (PKR 2,100.00 format)
      const amountMatch = body.match(/PKR\s*([\d,]+\.?\d*)/i) || 
                         body.match(/Rs\.?\s*([\d,]+\.?\d*)/i) ||
                         body.match(/([\d,]+\.?\d*)\s*PKR/i);
      
      if (!amountMatch) {
        this.logger.warn('Could not find amount in email body');
        return null;
      }

      const amountStr = amountMatch[1].replace(/,/g, '');
      const amount = new Decimal(amountStr);

      // Extract account last 4 digits (***0018 format)
      const accountMatch = body.match(/\*\*\*(\d{4})/) || 
                          body.match(/Account\s*[:\-]?\s*\*\*\*(\d{4})/i) ||
                          body.match(/A\/C\s*[:\-]?\s*\*\*\*(\d{4})/i);
      
      if (!accountMatch) {
        this.logger.warn('Could not find account last 4 in email body');
        return null;
      }

      const accountLast4 = accountMatch[1];

      // Extract transaction reference (for idempotency)
      // Look for "Transaction Reference : 24594" format (must come after "Transaction Reference")
      // Priority: Full phrase first, then shorter patterns
      let refMatch = body.match(/Transaction\s+Reference\s*[:\-]?\s*([A-Z0-9]+)/i);
      if (!refMatch) {
        refMatch = body.match(/Transaction\s+Ref\s*[:\-]?\s*([A-Z0-9]+)/i);
      }
      if (!refMatch) {
        // Avoid matching "Reference" in the middle of "Transaction Reference"
        refMatch = body.match(/(?<!Transaction\s)Reference\s*[:\-]?\s*([A-Z0-9]+)/i);
      }
      if (!refMatch) {
        refMatch = body.match(/Ref[:\-]?\s*([A-Z0-9]+)/i);
      }
      if (!refMatch) {
        refMatch = body.match(/Txn[:\-]?\s*([A-Z0-9]+)/i);
      }
      
      const transactionRef = refMatch ? refMatch[1].trim() : `EMAIL_${Date.now()}`;

      // Determine if credit (received) or debit (sent)
      // Credit: "PKR 5,000.00 has been received in your Account No: ***0018"
      // Debit: "PKR 5,000.00 have been sent from your Account No: ***0012"
      const lowerBody = body.toLowerCase();
      const isCredit = lowerBody.includes('has been received') ||
                       lowerBody.includes('have been received') ||
                       lowerBody.includes('received in your account') ||
                       (lowerBody.includes('received') && 
                        !lowerBody.includes('sent from your account') &&
                        !lowerBody.includes('have been sent'));

      return {
        amount,
        accountLast4,
        transactionRef,
        isCredit,
        emailSubject: subject,
        emailFrom: from,
      };
    } catch (error) {
      this.logger.error('Error parsing transaction:', error);
      return null;
    }
  }

  /**
   * Match user by account last 4 and credit wallet
   */
  private async creditUserWallet(transaction: ParsedTransaction, messageId: string): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      // Find users with matching bank account last 4
      // Note: You'll need to add a bankAccountLast4 field to User entity
      const users = await manager.find(User, {
        where: { bankAccountLast4: transaction.accountLast4 },
      });

      if (users.length === 0) {
        this.logger.warn(`No user found with account last 4: ${transaction.accountLast4}`);
        return;
      }

      if (users.length > 1) {
        this.logger.error(`Multiple users found with account last 4: ${transaction.accountLast4}. Cannot credit wallet.`);
        return;
      }

      const user = users[0];
      this.logger.log(`✅ Matched user: ${user.email} (${user.displayCode})`);

      // Check for duplicate transaction (idempotency)
      const existingTxn = await manager.query(
        `SELECT id FROM transactions WHERE "referenceId" = $1 AND type = 'deposit'`,
        [transaction.transactionRef]
      );

      if (existingTxn.length > 0) {
        this.logger.warn(`Transaction ${transaction.transactionRef} already processed. Skipping.`);
        return;
      }

      // Credit wallet using wallet service
      await this.walletService.deposit({
        userId: user.id,
        amountUSDT: transaction.amount.toNumber(),
      });

      this.logger.log(`✅ Credited PKR ${transaction.amount} to user ${user.displayCode} from bank email`);
    });
  }
}
