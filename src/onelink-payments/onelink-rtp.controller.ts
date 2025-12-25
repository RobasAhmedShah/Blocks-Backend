import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../mobile-auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../admin/entities/user.entity';
import { OneLinkRtpService } from './onelink-rtp.service';
import {
  TitleFetchDto,
  AliasFetchDto,
  CreateRtpDto,
  RtpStatusDto,
} from './dto/rtp.dto';

@Controller('api/payments/1link/rtp')
@UseGuards(JwtAuthGuard)
export class OneLinkRtpController {
  private readonly logger = new Logger(OneLinkRtpController.name);

  constructor(private readonly rtpService: OneLinkRtpService) {}

  // ============================================
  // Pre-RTP Title Fetch
  // POST /api/payments/1link/rtp/title-fetch
  // ============================================
  
  /**
   * Validate IBAN and get account title + rtpId for RTP request
   * 
   * Request Body:
   * {
   *   "iban": "PK36SCBL0000001123456702",
   *   "bankBic": "SCBLPKKA"
   * }
   */
  @Post('title-fetch')
  @HttpCode(HttpStatus.OK)
  async titleFetch(
    @CurrentUser() user: User,
    @Body() dto: TitleFetchDto,
  ) {
    const userId = user?.id;
    this.logger.log(`Pre-RTP Title Fetch for IBAN: ${dto.iban.substring(0, 8)}...`);

    try {
      const result = await this.rtpService.preRtpTitleFetch(dto, userId);
      
      return {
        success: result.responseCode === '00',
        responseCode: result.responseCode,
        responseDescription: result.responseDescription,
        data: {
          rtpId: result.rtpId,
          accountTitle: result.title,
          iban: result.iban || dto.iban,
          transactionId: result.rtpTransaction.id,
        },
      };
    } catch (error) {
      this.logger.error(`Pre-RTP Title Fetch failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch account details. Please try again.');
    }
  }

  // ============================================
  // Pre-RTP Alias Inquiry
  // POST /api/payments/1link/rtp/alias-inquiry
  // ============================================
  
  /**
   * Validate mobile number and get account details + rtpId for RTP request
   * 
   * Request Body:
   * {
   *   "mobileNumber": "03001234567"
   * }
   */
  @Post('alias-inquiry')
  @HttpCode(HttpStatus.OK)
  async aliasInquiry(
    @CurrentUser() user: User,
    @Body() dto: AliasFetchDto,
  ) {
    const userId = user?.id;
    this.logger.log(`Pre-RTP Alias Inquiry for mobile: ${dto.mobileNumber.substring(0, 5)}...`);

    try {
      const result = await this.rtpService.preRtpAliasInquiry(dto, userId);
      
      return {
        success: result.responseCode === '00',
        responseCode: result.responseCode,
        responseDescription: result.responseDescription,
        data: {
          rtpId: result.rtpId,
          accountTitle: result.title,
          iban: result.iban,
          transactionId: result.rtpTransaction.id,
        },
      };
    } catch (error) {
      this.logger.error(`Pre-RTP Alias Inquiry failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to fetch account details. Please try again.');
    }
  }

  // ============================================
  // RTP Now (Merchant)
  // POST /api/payments/1link/rtp/now/merchant
  // ============================================
  
  /**
   * Create an immediate RTP request (Merchant mode)
   * 
   * Request Body:
   * {
   *   "amountPkr": 5000,
   *   "rtpId": "rtp-id-from-pre-rtp",
   *   "billNo": "INV-001",
   *   "expiryMinutes": 30
   * }
   */
  @Post('now/merchant')
  @HttpCode(HttpStatus.OK)
  async rtpNowMerchant(
    @CurrentUser() user: User,
    @Body() dto: CreateRtpDto,
  ) {
    const userId = user?.id || dto.userId;
    
    if (!dto.rtpId) {
      throw new BadRequestException('rtpId is required. Get it from title-fetch or alias-inquiry first.');
    }
    
    if (dto.amountPkr < 1 || dto.amountPkr > 10000000) {
      throw new BadRequestException('Amount must be between 1 and 10,000,000 PKR');
    }

    this.logger.log(`RTP Now Merchant: ${dto.amountPkr} PKR, rtpId: ${dto.rtpId}`);

    try {
      const result = await this.rtpService.rtpNowMerchant(dto, userId);
      
      return {
        success: result.responseCode === '00',
        responseCode: result.responseCode,
        responseDescription: result.responseDescription,
        data: {
          rtpId: dto.rtpId,
          transactionId: result.rtpTransaction.id,
          displayCode: result.rtpTransaction.displayCode,
          amount: dto.amountPkr,
          currency: 'PKR',
          status: result.rtpTransaction.status,
          expiryDateTime: result.rtpTransaction.expiryDateTime,
        },
      };
    } catch (error) {
      this.logger.error(`RTP Now Merchant failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to create payment request. Please try again.');
    }
  }

  // ============================================
  // RTP Now (Aggregator)
  // POST /api/payments/1link/rtp/now/aggregator
  // ============================================
  
  /**
   * Create an immediate RTP request (Aggregator mode)
   * 
   * Request Body:
   * {
   *   "amountPkr": 5000,
   *   "rtpId": "rtp-id-from-pre-rtp",
   *   "billNo": "INV-001",
   *   "expiryMinutes": 30
   * }
   */
  @Post('now/aggregator')
  @HttpCode(HttpStatus.OK)
  async rtpNowAggregator(
    @CurrentUser() user: User,
    @Body() dto: CreateRtpDto,
  ) {
    const userId = user?.id || dto.userId;
    
    if (!dto.rtpId) {
      throw new BadRequestException('rtpId is required. Get it from title-fetch or alias-inquiry first.');
    }
    
    if (dto.amountPkr < 1 || dto.amountPkr > 10000000) {
      throw new BadRequestException('Amount must be between 1 and 10,000,000 PKR');
    }

    this.logger.log(`RTP Now Aggregator: ${dto.amountPkr} PKR, rtpId: ${dto.rtpId}`);

    try {
      const result = await this.rtpService.rtpNowAggregator(dto, userId);
      
      return {
        success: result.responseCode === '00',
        responseCode: result.responseCode,
        responseDescription: result.responseDescription,
        data: {
          rtpId: dto.rtpId,
          transactionId: result.rtpTransaction.id,
          displayCode: result.rtpTransaction.displayCode,
          amount: dto.amountPkr,
          currency: 'PKR',
          status: result.rtpTransaction.status,
          expiryDateTime: result.rtpTransaction.expiryDateTime,
        },
      };
    } catch (error) {
      this.logger.error(`RTP Now Aggregator failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to create payment request. Please try again.');
    }
  }

  // ============================================
  // RTP Later (Merchant)
  // POST /api/payments/1link/rtp/later/merchant
  // ============================================
  
  /**
   * Create a scheduled RTP request (Merchant mode)
   * 
   * Request Body:
   * {
   *   "amountPkr": 5000,
   *   "rtpId": "rtp-id-from-pre-rtp",
   *   "billNo": "INV-001",
   *   "expiryMinutes": 1440,
   *   "executionDateTime": "2024-01-15T14:30:00"
   * }
   */
  @Post('later/merchant')
  @HttpCode(HttpStatus.OK)
  async rtpLaterMerchant(
    @CurrentUser() user: User,
    @Body() dto: CreateRtpDto & { executionDateTime?: string },
  ) {
    const userId = user?.id || dto.userId;
    
    if (!dto.rtpId) {
      throw new BadRequestException('rtpId is required. Get it from title-fetch or alias-inquiry first.');
    }
    
    if (dto.amountPkr < 1 || dto.amountPkr > 10000000) {
      throw new BadRequestException('Amount must be between 1 and 10,000,000 PKR');
    }

    this.logger.log(`RTP Later Merchant: ${dto.amountPkr} PKR, rtpId: ${dto.rtpId}`);

    try {
      const result = await this.rtpService.rtpLaterMerchant(dto, userId);
      
      return {
        success: result.responseCode === '00',
        responseCode: result.responseCode,
        responseDescription: result.responseDescription,
        data: {
          rtpId: dto.rtpId,
          transactionId: result.rtpTransaction.id,
          displayCode: result.rtpTransaction.displayCode,
          amount: dto.amountPkr,
          currency: 'PKR',
          status: result.rtpTransaction.status,
          expiryDateTime: result.rtpTransaction.expiryDateTime,
          executionDateTime: result.rtpTransaction.executionDateTime,
        },
      };
    } catch (error) {
      this.logger.error(`RTP Later Merchant failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to create scheduled payment request. Please try again.');
    }
  }

  // ============================================
  // RTP Later (Aggregator)
  // POST /api/payments/1link/rtp/later/aggregator
  // ============================================
  
  /**
   * Create a scheduled RTP request (Aggregator mode)
   * 
   * Request Body:
   * {
   *   "amountPkr": 5000,
   *   "rtpId": "rtp-id-from-pre-rtp",
   *   "billNo": "INV-001",
   *   "expiryMinutes": 1440,
   *   "executionDateTime": "2024-01-15T14:30:00",
   *   "transactionType": "001"
   * }
   */
  @Post('later/aggregator')
  @HttpCode(HttpStatus.OK)
  async rtpLaterAggregator(
    @CurrentUser() user: User,
    @Body() dto: CreateRtpDto & { executionDateTime?: string; transactionType: string },
  ) {
    const userId = user?.id || dto.userId;
    
    if (!dto.rtpId) {
      throw new BadRequestException('rtpId is required. Get it from title-fetch or alias-inquiry first.');
    }
    
    if (!dto.transactionType) {
      throw new BadRequestException('transactionType is required for aggregator later flow');
    }
    
    if (dto.amountPkr < 1 || dto.amountPkr > 10000000) {
      throw new BadRequestException('Amount must be between 1 and 10,000,000 PKR');
    }

    this.logger.log(`RTP Later Aggregator: ${dto.amountPkr} PKR, rtpId: ${dto.rtpId}`);

    try {
      const result = await this.rtpService.rtpLaterAggregator(dto, userId);
      
      return {
        success: result.responseCode === '00',
        responseCode: result.responseCode,
        responseDescription: result.responseDescription,
        data: {
          rtpId: dto.rtpId,
          transactionId: result.rtpTransaction.id,
          displayCode: result.rtpTransaction.displayCode,
          amount: dto.amountPkr,
          currency: 'PKR',
          status: result.rtpTransaction.status,
          expiryDateTime: result.rtpTransaction.expiryDateTime,
          executionDateTime: result.rtpTransaction.executionDateTime,
        },
      };
    } catch (error) {
      this.logger.error(`RTP Later Aggregator failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to create scheduled payment request. Please try again.');
    }
  }

  // ============================================
  // Status Inquiry
  // POST /api/payments/1link/rtp/status
  // ============================================
  
  /**
   * Check status of an RTP request
   * 
   * Request Body:
   * {
   *   "rtpId": "rtp-id-to-check"
   * }
   */
  @Post('status')
  @HttpCode(HttpStatus.OK)
  async statusInquiry(
    @CurrentUser() user: User,
    @Body() dto: RtpStatusDto,
  ) {
    const userId = user?.id;
    
    if (!dto.rtpId) {
      throw new BadRequestException('rtpId is required');
    }

    this.logger.log(`RTP Status Inquiry for rtpId: ${dto.rtpId}`);

    try {
      const result = await this.rtpService.statusInquiry(dto, userId);
      
      return {
        success: result.responseCode === '00',
        responseCode: result.responseCode,
        responseDescription: result.responseDescription,
        data: {
          rtpId: dto.rtpId,
          transactionId: result.rtpTransaction.id,
          ...result,
        },
      };
    } catch (error) {
      this.logger.error(`RTP Status Inquiry failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to get payment status. Please try again.');
    }
  }

  // ============================================
  // RTP Cancellation
  // POST /api/payments/1link/rtp/cancel
  // ============================================
  
  /**
   * Cancel an RTP request
   * 
   * Request Body:
   * {
   *   "rtpId": "rtp-id-to-cancel"
   * }
   */
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  async rtpCancellation(
    @CurrentUser() user: User,
    @Body() dto: RtpStatusDto,
  ) {
    const userId = user?.id;
    
    if (!dto.rtpId) {
      throw new BadRequestException('rtpId is required');
    }

    this.logger.log(`RTP Cancellation for rtpId: ${dto.rtpId}`);

    try {
      const result = await this.rtpService.rtpCancellation(dto, userId);
      
      return {
        success: result.responseCode === '00',
        responseCode: result.responseCode,
        responseDescription: result.responseDescription,
        data: {
          rtpId: dto.rtpId,
          transactionId: result.rtpTransaction.id,
          cancelled: result.responseCode === '00',
        },
      };
    } catch (error) {
      this.logger.error(`RTP Cancellation failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to cancel payment request. Please try again.');
    }
  }

  // ============================================
  // Get User RTP Transactions
  // GET /api/payments/1link/rtp/transactions
  // ============================================
  
  /**
   * Get RTP transaction history for the authenticated user
   */
  @Get('transactions')
  async getUserTransactions(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
  ) {
    const userId = user?.id;
    
    if (!userId) {
      throw new BadRequestException('User authentication required');
    }

    const transactions = await this.rtpService.getUserRtpTransactions(
      userId, 
      limit ? parseInt(limit, 10) : 50
    );
    
    return {
      success: true,
      data: transactions.map(txn => ({
        id: txn.id,
        displayCode: txn.displayCode,
        operationType: txn.operationType,
        rtpId: txn.rtpId,
        amount: txn.amount,
        currency: txn.currency,
        status: txn.status,
        responseCode: txn.responseCode,
        responseDescription: txn.responseDescription,
        payerTitle: txn.payerTitle,
        createdAt: txn.createdAt,
        expiryDateTime: txn.expiryDateTime,
      })),
      count: transactions.length,
    };
  }

  // ============================================
  // Get Single RTP Transaction by rtpId
  // GET /api/payments/1link/rtp/transactions/:rtpId
  // ============================================
  
  /**
   * Get details of a specific RTP transaction
   */
  @Get('transactions/:rtpId')
  async getTransactionByRtpId(
    @CurrentUser() user: User,
    @Param('rtpId') rtpId: string,
  ) {
    if (!rtpId) {
      throw new BadRequestException('rtpId is required');
    }

    const transaction = await this.rtpService.getRtpTransactionByRtpId(rtpId);
    
    if (!transaction) {
      return {
        success: false,
        message: 'Transaction not found',
      };
    }

    // Check if user owns this transaction (if authenticated)
    if (user?.id && transaction.userId && transaction.userId !== user.id) {
      throw new BadRequestException('Transaction not found');
    }
    
    return {
      success: true,
      data: {
        id: transaction.id,
        displayCode: transaction.displayCode,
        operationType: transaction.operationType,
        rtpId: transaction.rtpId,
        stan: transaction.stan,
        rrn: transaction.rrn,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        responseCode: transaction.responseCode,
        responseDescription: transaction.responseDescription,
        payerTitle: transaction.payerTitle,
        payerIban: transaction.payerIban,
        payerMobile: transaction.payerMobile,
        billNo: transaction.billNo,
        expiryDateTime: transaction.expiryDateTime,
        executionDateTime: transaction.executionDateTime,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
      },
    };
  }
}

