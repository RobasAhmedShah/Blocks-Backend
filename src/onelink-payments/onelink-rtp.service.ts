import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OneLinkOAuthService } from './onelink-oauth.service';
import { RtpTransaction, RtpOperationType, RtpStatus } from './entities/rtp-transaction.entity';
import {
  TitleFetchDto,
  AliasFetchDto,
  CreateRtpDto,
  RtpStatusDto,
  RtpApiResponse,
  PreRtpTitleFetchRequestDto,
  PreRtpAliasInquiryRequestDto,
  RtpNowMerchantRequestDto,
  RtpNowAggregatorRequestDto,
  RtpLaterMerchantRequestDto,
  RtpLaterAggregatorRequestDto,
  StatusInquiryRequestDto,
  RtpCancellationRequestDto,
} from './dto/rtp.dto';

@Injectable()
export class OneLinkRtpService {
  private readonly logger = new Logger(OneLinkRtpService.name);
  
  // Retry configuration
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 1000;
  
  // STAN counter for uniqueness within process
  private stanCounter = 0;
  
  constructor(
    private readonly configService: ConfigService,
    private readonly oauthService: OneLinkOAuthService,
    @InjectRepository(RtpTransaction)
    private readonly rtpRepo: Repository<RtpTransaction>,
  ) {}

  // ============================================
  // Pre-RTP Title Fetch
  // ============================================
  
  async preRtpTitleFetch(dto: TitleFetchDto, userId?: string): Promise<RtpApiResponse & { rtpTransaction: RtpTransaction }> {
    const stan = this.generateStan();
    const rrn = this.generateRrn();
    
    const payload: PreRtpTitleFetchRequestDto = {
      customerDetails: {
        memberid: dto.bankBic,
        iban: dto.iban,
      },
      info: {
        rrn,
        stan,
      },
    };
    
    // Create audit record
    const rtpTxn = await this.createRtpTransaction({
      userId,
      operationType: 'PRE_RTP_TITLE_FETCH',
      stan,
      rrn,
      payerIban: dto.iban,
      requestPayload: payload as unknown as Record<string, unknown>,
    });
    
    try {
      const response = await this.callRtpApiWithRetry('/preRTPTitleFetch', payload, rtpTxn);
      
      // Update transaction with response
      rtpTxn.responseCode = response.responseCode;
      rtpTxn.responseDescription = response.responseDescription;
      rtpTxn.responsePayload = response as unknown as Record<string, unknown>;
      rtpTxn.rtpId = response.rtpId;
      rtpTxn.payerTitle = response.title;
      rtpTxn.status = response.responseCode === '00' ? 'COMPLETED' : 'FAILED';
      await this.rtpRepo.save(rtpTxn);
      
      return { ...response, rtpTransaction: rtpTxn };
    } catch (error) {
      rtpTxn.status = 'FAILED';
      rtpTxn.errorMessage = error.message;
      await this.rtpRepo.save(rtpTxn);
      throw error;
    }
  }

  // ============================================
  // Pre-RTP Alias Inquiry
  // ============================================
  
  async preRtpAliasInquiry(dto: AliasFetchDto, userId?: string): Promise<RtpApiResponse & { rtpTransaction: RtpTransaction }> {
    const stan = this.generateStan();
    const rrn = this.generateRrn();
    
    // Clean mobile number (remove leading 0 or +92)
    let mobile = dto.mobileNumber.replace(/\D/g, '');
    if (mobile.startsWith('92')) {
      mobile = '0' + mobile.substring(2);
    } else if (!mobile.startsWith('0')) {
      mobile = '0' + mobile;
    }
    
    const payload: PreRtpAliasInquiryRequestDto = {
      alias: {
        type: 'MOBILE',
        value: mobile,
      },
      info: {
        rrn,
        stan,
      },
    };
    
    // Create audit record
    const rtpTxn = await this.createRtpTransaction({
      userId,
      operationType: 'PRE_RTP_ALIAS_INQUIRY',
      stan,
      rrn,
      payerMobile: mobile,
      requestPayload: payload as unknown as Record<string, unknown>,
    });
    
    try {
      const response = await this.callRtpApiWithRetry('/preRTPAliasInquiry', payload, rtpTxn);
      
      // Update transaction with response
      rtpTxn.responseCode = response.responseCode;
      rtpTxn.responseDescription = response.responseDescription;
      rtpTxn.responsePayload = response as unknown as Record<string, unknown>;
      rtpTxn.rtpId = response.rtpId;
      rtpTxn.payerTitle = response.title;
      rtpTxn.payerIban = response.iban;
      rtpTxn.status = response.responseCode === '00' ? 'COMPLETED' : 'FAILED';
      await this.rtpRepo.save(rtpTxn);
      
      return { ...response, rtpTransaction: rtpTxn };
    } catch (error) {
      rtpTxn.status = 'FAILED';
      rtpTxn.errorMessage = error.message;
      await this.rtpRepo.save(rtpTxn);
      throw error;
    }
  }

  // ============================================
  // RTP Now (Merchant)
  // ============================================
  
  async rtpNowMerchant(dto: CreateRtpDto, userId?: string): Promise<RtpApiResponse & { rtpTransaction: RtpTransaction }> {
    const stan = this.generateStan();
    const rrn = this.generateRrn();
    const expiryDateTime = this.calculateExpiry(dto.expiryMinutes || 30);
    
    const merchantConfig = this.getMerchantConfig();
    
    const payload: RtpNowMerchantRequestDto = {
      merchantDetails: {
        merchantID: merchantConfig.merchantId,
        merchantName: merchantConfig.merchantName,
        dbaName: merchantConfig.dbaName,
        iban: merchantConfig.iban,
        bankBic: merchantConfig.bankBic,
        merchantCategoryCode: merchantConfig.mcc,
        postalAddress: {
          townName: merchantConfig.city,
          subDept: merchantConfig.terminalId,
          addressLine: merchantConfig.address,
        },
        contactDetails: {
          email: merchantConfig.email,
          mobileNo: merchantConfig.mobile,
        },
      },
      paymentDetails: {
        instructedAmount: dto.amountPkr.toString(),
        expiryDateTime,
        rtpId: dto.rtpId,
        billNo: dto.billNo,
      },
      info: {
        stan,
        rrn,
      },
    };
    
    // Create audit record
    const rtpTxn = await this.createRtpTransaction({
      userId,
      operationType: 'RTP_NOW_MERCHANT',
      stan,
      rrn,
      rtpId: dto.rtpId,
      merchantId: merchantConfig.merchantId,
      amount: dto.amountPkr,
      billNo: dto.billNo,
      expiryDateTime: new Date(expiryDateTime),
      requestPayload: payload as unknown as Record<string, unknown>,
    });
    
    try {
      const response = await this.callRtpApiWithRetry('/rtpNowMerchant', payload, rtpTxn);
      
      // Update transaction with response
      rtpTxn.responseCode = response.responseCode;
      rtpTxn.responseDescription = response.responseDescription;
      rtpTxn.responsePayload = response as unknown as Record<string, unknown>;
      rtpTxn.status = response.responseCode === '00' ? 'SENT' : 'FAILED';
      await this.rtpRepo.save(rtpTxn);
      
      return { ...response, rtpTransaction: rtpTxn };
    } catch (error) {
      rtpTxn.status = 'FAILED';
      rtpTxn.errorMessage = error.message;
      await this.rtpRepo.save(rtpTxn);
      throw error;
    }
  }

  // ============================================
  // RTP Now (Aggregator)
  // ============================================
  
  async rtpNowAggregator(dto: CreateRtpDto, userId?: string): Promise<RtpApiResponse & { rtpTransaction: RtpTransaction }> {
    const stan = this.generateStan();
    const rrn = this.generateRrn();
    const expiryDateTime = this.calculateExpiry(dto.expiryMinutes || 30);
    
    const merchantConfig = this.getMerchantConfig();
    
    const payload: RtpNowAggregatorRequestDto = {
      merchantDetails: {
        merchantId: merchantConfig.merchantId,
        subDept: merchantConfig.terminalId,
      },
      contactDetails: {
        merchantChannelId: merchantConfig.channelId,
      },
      paymentDetails: {
        instructedAmount: dto.amountPkr,
        expiryDateTime,
        rtpId: dto.rtpId,
        billNo: dto.billNo,
      },
      info: {
        stan,
        rrn,
      },
    };
    
    // Create audit record
    const rtpTxn = await this.createRtpTransaction({
      userId,
      operationType: 'RTP_NOW_AGGREGATOR',
      stan,
      rrn,
      rtpId: dto.rtpId,
      merchantId: merchantConfig.merchantId,
      amount: dto.amountPkr,
      billNo: dto.billNo,
      expiryDateTime: new Date(expiryDateTime),
      requestPayload: payload as unknown as Record<string, unknown>,
    });
    
    try {
      const response = await this.callRtpApiWithRetry('/rtpNowAggregator', payload, rtpTxn);
      
      // Update transaction with response
      rtpTxn.responseCode = response.responseCode;
      rtpTxn.responseDescription = response.responseDescription;
      rtpTxn.responsePayload = response as unknown as Record<string, unknown>;
      rtpTxn.status = response.responseCode === '00' ? 'SENT' : 'FAILED';
      await this.rtpRepo.save(rtpTxn);
      
      return { ...response, rtpTransaction: rtpTxn };
    } catch (error) {
      rtpTxn.status = 'FAILED';
      rtpTxn.errorMessage = error.message;
      await this.rtpRepo.save(rtpTxn);
      throw error;
    }
  }

  // ============================================
  // RTP Later (Merchant)
  // ============================================
  
  async rtpLaterMerchant(dto: CreateRtpDto & { executionDateTime?: string }, userId?: string): Promise<RtpApiResponse & { rtpTransaction: RtpTransaction }> {
    const stan = this.generateStan();
    const rrn = this.generateRrn();
    const expiryDateTime = this.calculateExpiry(dto.expiryMinutes || 1440); // Default 24 hours for later
    
    const merchantConfig = this.getMerchantConfig();
    
    const payload: RtpLaterMerchantRequestDto = {
      merchantDetails: {
        merchantID: merchantConfig.merchantId,
        merchantName: merchantConfig.merchantName,
        dbaName: merchantConfig.dbaName,
        iban: merchantConfig.iban,
        bankBic: merchantConfig.bankBic,
        merchantCategoryCode: merchantConfig.mcc,
        postalAddress: {
          townName: merchantConfig.city,
          subDept: merchantConfig.terminalId,
          addressLine: merchantConfig.address,
        },
      },
      paymentDetails: {
        instructedAmount: dto.amountPkr.toString(),
        expiryDateTime,
        executionDateTime: dto.executionDateTime,
        rtpId: dto.rtpId,
        billNo: dto.billNo,
      },
      info: {
        stan,
        rrn,
      },
    };
    
    // Create audit record
    const rtpTxn = await this.createRtpTransaction({
      userId,
      operationType: 'RTP_LATER_MERCHANT',
      stan,
      rrn,
      rtpId: dto.rtpId,
      merchantId: merchantConfig.merchantId,
      amount: dto.amountPkr,
      billNo: dto.billNo,
      expiryDateTime: new Date(expiryDateTime),
      executionDateTime: dto.executionDateTime ? new Date(dto.executionDateTime) : undefined,
      requestPayload: payload as unknown as Record<string, unknown>,
    });
    
    try {
      const response = await this.callRtpApiWithRetry('/rtpLaterMerchant', payload, rtpTxn);
      
      // Update transaction with response
      rtpTxn.responseCode = response.responseCode;
      rtpTxn.responseDescription = response.responseDescription;
      rtpTxn.responsePayload = response as unknown as Record<string, unknown>;
      rtpTxn.status = response.responseCode === '00' ? 'PENDING' : 'FAILED';
      await this.rtpRepo.save(rtpTxn);
      
      return { ...response, rtpTransaction: rtpTxn };
    } catch (error) {
      rtpTxn.status = 'FAILED';
      rtpTxn.errorMessage = error.message;
      await this.rtpRepo.save(rtpTxn);
      throw error;
    }
  }

  // ============================================
  // RTP Later (Aggregator)
  // ============================================
  
  async rtpLaterAggregator(dto: CreateRtpDto & { executionDateTime?: string; transactionType: string }, userId?: string): Promise<RtpApiResponse & { rtpTransaction: RtpTransaction }> {
    const stan = this.generateStan();
    const rrn = this.generateRrn();
    const expiryDateTime = this.calculateExpiry(dto.expiryMinutes || 1440);
    
    const merchantConfig = this.getMerchantConfig();
    
    const payload: RtpLaterAggregatorRequestDto = {
      merchantDetails: {
        merchantId: merchantConfig.merchantId,
        subDept: merchantConfig.terminalId,
      },
      contactDetails: {
        merchantChannelId: merchantConfig.channelId,
      },
      paymentDetails: {
        instructedAmount: dto.amountPkr,
        expiryDateTime,
        executionDateTime: dto.executionDateTime,
        rtpId: dto.rtpId,
        billNo: dto.billNo,
        transactionType: dto.transactionType,
      },
      info: {
        stan,
        rrn,
      },
    };
    
    // Create audit record
    const rtpTxn = await this.createRtpTransaction({
      userId,
      operationType: 'RTP_LATER_AGGREGATOR',
      stan,
      rrn,
      rtpId: dto.rtpId,
      merchantId: merchantConfig.merchantId,
      amount: dto.amountPkr,
      billNo: dto.billNo,
      expiryDateTime: new Date(expiryDateTime),
      executionDateTime: dto.executionDateTime ? new Date(dto.executionDateTime) : undefined,
      requestPayload: payload as unknown as Record<string, unknown>,
    });
    
    try {
      const response = await this.callRtpApiWithRetry('/rtpLaterAggregator', payload, rtpTxn);
      
      // Update transaction with response
      rtpTxn.responseCode = response.responseCode;
      rtpTxn.responseDescription = response.responseDescription;
      rtpTxn.responsePayload = response as unknown as Record<string, unknown>;
      rtpTxn.status = response.responseCode === '00' ? 'PENDING' : 'FAILED';
      await this.rtpRepo.save(rtpTxn);
      
      return { ...response, rtpTransaction: rtpTxn };
    } catch (error) {
      rtpTxn.status = 'FAILED';
      rtpTxn.errorMessage = error.message;
      await this.rtpRepo.save(rtpTxn);
      throw error;
    }
  }

  // ============================================
  // Status Inquiry
  // ============================================
  
  async statusInquiry(dto: RtpStatusDto, userId?: string): Promise<RtpApiResponse & { rtpTransaction: RtpTransaction }> {
    const stan = this.generateStan();
    const merchantConfig = this.getMerchantConfig();
    
    const payload: StatusInquiryRequestDto = {
      info: {
        stan,
        rtpId: dto.rtpId,
        merchantID: merchantConfig.merchantId,
      },
    };
    
    // Create audit record
    const rtpTxn = await this.createRtpTransaction({
      userId,
      operationType: 'STATUS_INQUIRY',
      stan,
      rtpId: dto.rtpId,
      merchantId: merchantConfig.merchantId,
      requestPayload: payload as unknown as Record<string, unknown>,
    });
    
    try {
      const response = await this.callRtpApiWithRetry('/statusInquiry', payload, rtpTxn);
      
      // Update transaction with response
      rtpTxn.responseCode = response.responseCode;
      rtpTxn.responseDescription = response.responseDescription;
      rtpTxn.responsePayload = response as unknown as Record<string, unknown>;
      rtpTxn.status = response.responseCode === '00' ? 'COMPLETED' : 'FAILED';
      await this.rtpRepo.save(rtpTxn);
      
      // Also update the original RTP transaction status if found
      if (response.responseCode === '00') {
        await this.updateOriginalRtpStatus(dto.rtpId, response);
      }
      
      return { ...response, rtpTransaction: rtpTxn };
    } catch (error) {
      rtpTxn.status = 'FAILED';
      rtpTxn.errorMessage = error.message;
      await this.rtpRepo.save(rtpTxn);
      throw error;
    }
  }

  // ============================================
  // RTP Cancellation
  // ============================================
  
  async rtpCancellation(dto: RtpStatusDto, userId?: string): Promise<RtpApiResponse & { rtpTransaction: RtpTransaction }> {
    const stan = this.generateStan();
    const merchantConfig = this.getMerchantConfig();
    
    const payload: RtpCancellationRequestDto = {
      info: {
        stan,
        rtpId: dto.rtpId,
        merchantID: merchantConfig.merchantId,
      },
    };
    
    // Create audit record
    const rtpTxn = await this.createRtpTransaction({
      userId,
      operationType: 'RTP_CANCELLATION',
      stan,
      rtpId: dto.rtpId,
      merchantId: merchantConfig.merchantId,
      requestPayload: payload as unknown as Record<string, unknown>,
    });
    
    try {
      const response = await this.callRtpApiWithRetry('/rtpCancellation', payload, rtpTxn);
      
      // Update transaction with response
      rtpTxn.responseCode = response.responseCode;
      rtpTxn.responseDescription = response.responseDescription;
      rtpTxn.responsePayload = response as unknown as Record<string, unknown>;
      rtpTxn.status = response.responseCode === '00' ? 'COMPLETED' : 'FAILED';
      await this.rtpRepo.save(rtpTxn);
      
      // Also update the original RTP transaction status if cancelled
      if (response.responseCode === '00') {
        await this.rtpRepo.update(
          { rtpId: dto.rtpId, operationType: 'RTP_NOW_MERCHANT' as RtpOperationType },
          { status: 'CANCELLED' as RtpStatus }
        );
        await this.rtpRepo.update(
          { rtpId: dto.rtpId, operationType: 'RTP_NOW_AGGREGATOR' as RtpOperationType },
          { status: 'CANCELLED' as RtpStatus }
        );
      }
      
      return { ...response, rtpTransaction: rtpTxn };
    } catch (error) {
      rtpTxn.status = 'FAILED';
      rtpTxn.errorMessage = error.message;
      await this.rtpRepo.save(rtpTxn);
      throw error;
    }
  }

  // ============================================
  // Get RTP Transactions (for user)
  // ============================================
  
  async getUserRtpTransactions(userId: string, limit = 50): Promise<RtpTransaction[]> {
    return this.rtpRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getRtpTransactionByRtpId(rtpId: string): Promise<RtpTransaction | null> {
    return this.rtpRepo.findOne({
      where: { rtpId },
      order: { createdAt: 'DESC' },
    });
  }

  // ============================================
  // Private Helper Methods
  // ============================================
  
  private async createRtpTransaction(data: Partial<RtpTransaction>): Promise<RtpTransaction> {
    // Generate display code
    const timestamp = Date.now();
    const displayCode = `RTP-${timestamp.toString(36).toUpperCase()}`;
    
    const rtpTxn = this.rtpRepo.create({
      ...data,
      displayCode,
      status: 'PENDING' as RtpStatus,
    });
    
    return this.rtpRepo.save(rtpTxn);
  }

  private async updateOriginalRtpStatus(rtpId: string, response: RtpApiResponse): Promise<void> {
    // Map response to status
    const statusMap: Record<string, RtpStatus> = {
      'ACCP': 'ACCEPTED',
      'RJCT': 'REJECTED',
      'PDNG': 'PENDING',
      'ACTC': 'SENT',
      'ACSC': 'COMPLETED',
      'CANC': 'CANCELLED',
    };
    
    const rtpStatus = (response as Record<string, unknown>)['rtpStatus'] as string;
    if (rtpStatus && statusMap[rtpStatus]) {
      await this.rtpRepo.update(
        { rtpId, operationType: 'RTP_NOW_MERCHANT' as RtpOperationType },
        { status: statusMap[rtpStatus] }
      );
      await this.rtpRepo.update(
        { rtpId, operationType: 'RTP_NOW_AGGREGATOR' as RtpOperationType },
        { status: statusMap[rtpStatus] }
      );
    }
  }

  private getMerchantConfig() {
    return {
      merchantId: this.configService.get<string>('ONELINK_RTP_MERCHANT_ID', 'BLOCKS001'),
      merchantName: this.configService.get<string>('ONELINK_MERCHANT_NAME', 'Blocks'),
      dbaName: this.configService.get<string>('ONELINK_DBA_NAME', 'Blocks Digital'),
      iban: this.configService.get<string>('ONELINK_MERCHANT_IBAN', 'PK36SCBL0000001123456702'),
      bankBic: this.configService.get<string>('ONELINK_BANK_BIC', 'SCBLPKKA'),
      mcc: this.configService.get<string>('ONELINK_MCC', '0010'),
      city: this.configService.get<string>('ONELINK_MERCHANT_CITY', 'Karachi'),
      address: this.configService.get<string>('ONELINK_MERCHANT_ADDRESS', 'DHA Phase 6'),
      terminalId: this.configService.get<string>('ONELINK_TERMINAL_ID', '0001'),
      channelId: this.configService.get<string>('ONELINK_CHANNEL_ID', 'BLOCKS'),
      email: this.configService.get<string>('ONELINK_MERCHANT_EMAIL', 'support@blocks.pk'),
      mobile: this.configService.get<string>('ONELINK_MERCHANT_MOBILE', '03001234567'),
    };
  }

  private generateStan(): string {
    // 6-digit unique number
    this.stanCounter = (this.stanCounter + 1) % 1000000;
    const timestamp = Date.now() % 1000000;
    const combined = (this.stanCounter + timestamp) % 1000000;
    return combined.toString().padStart(6, '0');
  }

  private generateRrn(): string {
    // 12-digit unique number
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${timestamp}${random}`.slice(-12).padStart(12, '0');
  }

  private calculateExpiry(minutes: number): string {
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + minutes);
    // Format: 2024-01-15T14:30:00
    return expiry.toISOString().slice(0, 19);
  }

  private async callRtpApiWithRetry(
    endpoint: string, 
    payload: unknown, 
    rtpTxn: RtpTransaction,
    attempt = 1
  ): Promise<RtpApiResponse> {
    try {
      return await this.callRtpApi(endpoint, payload);
    } catch (error) {
      if (attempt < this.MAX_RETRIES) {
        this.logger.warn(`1LINK RTP API call to ${endpoint} failed (attempt ${attempt}), retrying...`);
        
        // Update retry count
        rtpTxn.retryCount = attempt;
        await this.rtpRepo.save(rtpTxn);
        
        // Wait before retry
        await this.delay(this.RETRY_DELAY_MS);
        
        // Invalidate token on auth errors
        if (error.message?.includes('401') || error.message?.includes('authentication')) {
          this.oauthService.invalidateToken();
        }
        
        return this.callRtpApiWithRetry(endpoint, payload, rtpTxn, attempt + 1);
      }
      
      this.logger.error(`1LINK RTP API call to ${endpoint} failed after ${this.MAX_RETRIES} attempts`, error);
      throw error;
    }
  }

  private async callRtpApi(endpoint: string, payload: unknown): Promise<RtpApiResponse> {
    const accessToken = await this.oauthService.getAccessToken();
    const baseUrl = this.configService.get<string>('ONELINK_RTP_API_URL', 'https://sandboxapi.1link.net.pk/uat-1link/sandbox/1Link');
    const ibmClientId = this.configService.get<string>('ONELINK_IBM_CLIENT_ID');
    
    if (!ibmClientId) {
      throw new InternalServerErrorException('1LINK API configuration missing');
    }
    
    const fullUrl = `${baseUrl}${endpoint}`;
    
    this.logger.debug(`Calling 1LINK RTP API: ${fullUrl}`);
    this.logger.debug(`Payload: ${JSON.stringify(payload, null, 2)}`);
    
    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-IBM-Client-Id': ibmClientId,
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      
      const responseText = await response.text();
      this.logger.debug(`1LINK RTP API response: ${response.status} - ${responseText}`);
      
      if (response.status === 401) {
        // Invalidate token and throw to trigger retry
        this.oauthService.invalidateToken();
        throw new Error('401 Unauthorized - Token expired');
      }
      
      if (!response.ok) {
        throw new Error(`1LINK RTP API error: ${response.status} - ${responseText}`);
      }
      
      const responseData: RtpApiResponse = JSON.parse(responseText);
      return responseData;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new InternalServerErrorException('Invalid response from 1LINK RTP API');
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

