import { Injectable, Logger, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OneLinkOAuthService } from './onelink-oauth.service';
import { OneLinkMerchantService } from './onelink-merchant.service';
import {
  GenerateP2MQrSimpleDto,
  GenerateP2MQrMerchantRequest,
  GenerateP2MQrAggregatorRequest,
  P2MQrApiResponse,
  GenerateP2MQrResponseDto,
} from './dto/p2m-qr.dto';

@Injectable()
export class OneLinkP2MQrService {
  private readonly logger = new Logger(OneLinkP2MQrService.name);
  
  // Retry configuration
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 1000;
  
  // STAN counter for uniqueness within process
  private stanCounter = 0;
  
  constructor(
    private readonly configService: ConfigService,
    private readonly oauthService: OneLinkOAuthService,
    private readonly merchantService: OneLinkMerchantService,
  ) {}

  // ============================================
  // Generate P2M QR Code - Merchant
  // ============================================
  
  async generateP2MQrMerchant(dto: GenerateP2MQrSimpleDto): Promise<GenerateP2MQrResponseDto> {
    this.logger.log(`Generating P2M QR code for merchant: ${dto.merchantID}, amount: ${dto.amountPkr} PKR`);
    
    // Get merchant profile from database
    const merchantProfile = await this.merchantService.getMerchantProfileFromDb(dto.merchantID);
    
    if (!merchantProfile) {
      throw new NotFoundException(`Merchant profile with ID ${dto.merchantID} not found. Please create merchant profile first.`);
    }
    
    if (merchantProfile.merchantStatus !== '00') {
      throw new BadRequestException(`Merchant profile ${dto.merchantID} is not active (status: ${merchantProfile.merchantStatus})`);
    }
    
    // Generate STAN and RRN
    const stan = this.generateStan();
    const rrn = this.generateRrn();
    
    // Calculate expiry date/time (default: 30 minutes from now)
    const expiryMinutes = dto.expiryMinutes || 30;
    const now = new Date();
    const expiryDateTime = new Date(now.getTime() + expiryMinutes * 60 * 1000);
    
    // Format dates (ISO 8601 format, max 20 chars)
    const executionDateTime = this.formatDateTime(now);
    const expiryDateTimeStr = this.formatDateTime(expiryDateTime);
    
    // Convert amount to smallest currency unit (PKR has 2 decimal places, so multiply by 100)
    // Example: 2500.50 PKR = 250050 (smallest currency unit)
    const instructedAmount = Math.round(dto.amountPkr * 100);
    
    // Generate reference ID if not provided
    const referenceId = dto.referenceId || `REF-${Date.now()}-${this.generateRandomString(6)}`;
    
    // Build request payload
    const requestPayload: GenerateP2MQrMerchantRequest = {
      merchantDetails: {
        dbaName: merchantProfile.dbaName,
        merchantName: merchantProfile.merchantName,
        iban: merchantProfile.iban,
        bankBic: merchantProfile.bankBic,
        merchantCategoryCode: merchantProfile.merchantCategoryCode,
        merchantID: merchantProfile.merchantID,
      },
      paymentDetails: {
        executionDateTime: executionDateTime, // Include even though optional
        expiryDateTime: expiryDateTimeStr,
        instructedAmount,
        transactionType: this.getTransactionTypeCode(dto.transactionType).toString(),
      },
      info: {
        stan,
        rrn,
      },
    };
    
    // Add postal address (required for merchant mode)
    // postalAddress is required with townName, addressLine, and subDept
    requestPayload.merchantDetails.postalAddress = {
      townName: merchantProfile.townName || 'Karachi',
      addressLine: merchantProfile.addressLine || 'Address Not Provided',
      subDept: dto.subDept || '0001', // Terminal ID, default to "0001"
    };
    
    // Add optional contact details if available
    if (merchantProfile.phoneNo || merchantProfile.mobileNo || merchantProfile.email) {
      // Format phone numbers to international format
      let phoneNo = merchantProfile.phoneNo;
      let mobileNo = merchantProfile.mobileNo;
      
      if (phoneNo && !phoneNo.startsWith('+')) {
        phoneNo = phoneNo.replace(/^0/, '+92');
      }
      if (mobileNo && !mobileNo.startsWith('+')) {
        mobileNo = mobileNo.replace(/^0/, '+92');
      }
      
      requestPayload.merchantDetails.contactDetails = {
        phoneNo: phoneNo || undefined,
        mobileNo: mobileNo || undefined,
        email: merchantProfile.email || undefined,
        dept: merchantProfile.dept || undefined,
        website: merchantProfile.website || undefined,
      };
    }
    
    // Add optional payer details
    if (dto.additionalRequiredDetails || dto.loyaltyNo || dto.customerLabel) {
      requestPayload.payerDetails = {
        additionalRequiredDetails: dto.additionalRequiredDetails,
        identificationDetails: {
          loyaltyNo: dto.loyaltyNo,
          customerLabel: dto.customerLabel,
        },
      };
    }
    
    try {
      // Call 1LINK API
      const response = await this.callP2MQrApiWithRetry('/generateDQRCMerchant', requestPayload);
      
      // Validate response
      if (!response.responseCode || response.responseCode !== '00') {
        const errorMsg = response.responseDescription || response.responseCode || 'Unknown error';
        this.logger.error(`1LINK P2M QR generation failed (Merchant): ${response.responseCode || 'NO_CODE'} - ${errorMsg}`);
        this.logger.error(`Full response: ${JSON.stringify(response, null, 2)}`);
        throw new InternalServerErrorException(`P2M QR generation failed: ${errorMsg}`);
      }
      
      // Generate QR code ID
      const qrCodeId = `P2M-${Date.now()}-${this.generateRandomString(6)}`;
      
      return {
        qrCodeId,
        merchantID: dto.merchantID,
        referenceId,
        amountPkr: dto.amountPkr.toString(),
        qrCodeBase64: response.qrCode,
        qrCodeDataUri: response.qrCode ? `data:image/png;base64,${response.qrCode}` : undefined,
        qrData: response.qrData,
        expiryDateTime: expiryDateTimeStr,
        currency: 'PKR',
        stan,
        rrn,
      };
    } catch (error) {
      this.logger.error(`Failed to generate P2M QR code: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ============================================
  // Generate P2M QR Code - Aggregator
  // ============================================
  
  async generateP2MQrAggregator(dto: GenerateP2MQrSimpleDto): Promise<GenerateP2MQrResponseDto> {
    this.logger.log(`Generating P2M QR code (Aggregator) for merchant: ${dto.merchantID}, amount: ${dto.amountPkr} PKR`);
    
    // Get merchant profile from database
    const merchantProfile = await this.merchantService.getMerchantProfileFromDb(dto.merchantID);
    
    if (!merchantProfile) {
      throw new NotFoundException(`Merchant profile with ID ${dto.merchantID} not found. Please create merchant profile first.`);
    }
    
    if (merchantProfile.merchantStatus !== '00') {
      throw new BadRequestException(`Merchant profile ${dto.merchantID} is not active (status: ${merchantProfile.merchantStatus})`);
    }
    
    // Generate STAN and RRN
    const stan = this.generateStan();
    const rrn = this.generateRrn();
    
    // Calculate expiry date/time (default: 30 minutes from now)
    const expiryMinutes = dto.expiryMinutes || 30;
    const now = new Date();
    const expiryDateTime = new Date(now.getTime() + expiryMinutes * 60 * 1000);
    
    // Format dates (ISO 8601 format, max 20 chars)
    const executionDateTime = this.formatDateTime(now);
    const expiryDateTimeStr = this.formatDateTime(expiryDateTime);
    
    // Convert amount to smallest currency unit
    const instructedAmount = Math.round(dto.amountPkr * 100);
    
    // Generate reference ID if not provided
    const referenceId = dto.referenceId || `REF-${Date.now()}-${this.generateRandomString(6)}`;
    
    // Build request payload
    // Per documentation, aggregator has paymentDetails and info nested inside payerDetails
    // However, payerDetails itself must exist even if empty
    const requestPayload: any = {
      merchantDetails: {
        merchantID: merchantProfile.merchantID,
        subDept: dto.subDept || '0001', // Terminal ID, default to "0001"
      },
      payerDetails: {
        paymentDetails: {
          executionDateTime: executionDateTime, // Include even though optional
          expiryDateTime: expiryDateTimeStr,
          instructedAmount: instructedAmount.toString(), // Aggregator requires string
          transactionType: this.getTransactionTypeCode(dto.transactionType),
        },
        info: {
          stan,
          rrn,
        },
      },
    };
    
    // Add optional contact details
    if (merchantProfile.dept) {
      requestPayload.contactDetails = {
        merchantChannelId: merchantProfile.dept,
      };
    }
    
    // Add optional payer identification details
    if (dto.additionalRequiredDetails || dto.loyaltyNo || dto.customerLabel) {
      requestPayload.payerDetails.additionalRequiredDetails = dto.additionalRequiredDetails;
      requestPayload.payerDetails.identificationDetails = {
        loyaltyNo: dto.loyaltyNo,
        customerLabel: dto.customerLabel,
      };
    }
    
    try {
      // Call 1LINK API
      const response = await this.callP2MQrApiWithRetry('/generateDQRCAggregator', requestPayload);
      
      // Validate response
      if (!response.responseCode || response.responseCode !== '00') {
        const errorMsg = response.responseDescription || response.responseCode || 'Unknown error';
        this.logger.error(`1LINK P2M QR generation failed (Aggregator): ${response.responseCode || 'NO_CODE'} - ${errorMsg}`);
        this.logger.error(`Full response: ${JSON.stringify(response, null, 2)}`);
        throw new InternalServerErrorException(`P2M QR generation failed: ${errorMsg}`);
      }
      
      // Generate QR code ID
      const qrCodeId = `P2M-AGG-${Date.now()}-${this.generateRandomString(6)}`;
      
      return {
        qrCodeId,
        merchantID: dto.merchantID,
        referenceId,
        amountPkr: dto.amountPkr.toString(),
        qrCodeBase64: response.qrCode,
        qrCodeDataUri: response.qrCode ? `data:image/png;base64,${response.qrCode}` : undefined,
        qrData: response.qrData,
        expiryDateTime: expiryDateTimeStr,
        currency: 'PKR',
        stan,
        rrn,
      };
    } catch (error) {
      this.logger.error(`Failed to generate P2M QR code (Aggregator): ${error.message}`, error.stack);
      throw error;
    }
  }

  // ============================================
  // Helper Methods
  // ============================================
  
  /**
   * Generate STAN (System Trace Audit Number) - 6 digits
   */
  private generateStan(): string {
    this.stanCounter = (this.stanCounter + 1) % 1000000;
    return this.stanCounter.toString().padStart(6, '0');
  }
  
  /**
   * Generate RRN (Retrieval Reference Number) - 12 digits
   * Format: YYMMDD + 6 digit sequence
   */
  private generateRrn(): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const sequence = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `${year}${month}${day}${sequence}`;
  }
  
  /**
   * Format date to ISO 8601 with milliseconds and Z
   * Format: YYYY-MM-DDTHH:MM:SS.000Z
   * Example: "2022-07-08T12:46:49.000Z"
   */
  private formatDateTime(date: Date): string {
    return date.toISOString();
  }
  
  /**
   * Get transaction type code (TTC) number
   * Default: 38 (PURCHASE)
   */
  private getTransactionTypeCode(transactionType?: string): number {
    // Map transaction types to TTC codes
    const typeMap: Record<string, number> = {
      'PURCHASE': 38,
      'REFUND': 20,
      'CASHBACK': 21,
      'ADJUSTMENT': 22,
    };
    
    if (transactionType && typeMap[transactionType.toUpperCase()]) {
      return typeMap[transactionType.toUpperCase()];
    }
    
    // If it's already a number, parse it
    const parsed = parseInt(transactionType || '38', 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
    
    // Default to 38 (PURCHASE)
    return 38;
  }
  
  /**
   * Generate random string
   */
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  /**
   * Call 1LINK P2M QR API with retry logic
   */
  private async callP2MQrApiWithRetry(
    endpoint: string,
    payload: GenerateP2MQrMerchantRequest | GenerateP2MQrAggregatorRequest,
    attempt: number = 1,
  ): Promise<P2MQrApiResponse> {
    try {
      return await this.callP2MQrApi(endpoint, payload);
    } catch (error) {
      if (attempt < this.MAX_RETRIES) {
        this.logger.warn(`1LINK P2M QR API call failed (attempt ${attempt}), retrying...`);
        
        // Wait before retry
        await this.delay(this.RETRY_DELAY_MS);
        
        // Invalidate token on auth errors
        if (error.message?.includes('401') || error.message?.includes('authentication')) {
          this.oauthService.invalidateToken();
        }
        
        return this.callP2MQrApiWithRetry(endpoint, payload, attempt + 1);
      }
      
      this.logger.error(`1LINK P2M QR API call failed after ${this.MAX_RETRIES} attempts`, error);
      throw error;
    }
  }
  
  /**
   * Make the actual API call to 1LINK P2M QR API
   */
  private async callP2MQrApi(
    endpoint: string,
    payload: GenerateP2MQrMerchantRequest | GenerateP2MQrAggregatorRequest,
  ): Promise<P2MQrApiResponse> {
    const accessToken = await this.oauthService.getAccessToken();
    const apiBaseUrl = this.configService.get<string>('ONELINK_RTP_API_URL') || 
                      this.configService.get<string>('ONELINK_MERCHANT_API_URL') ||
                      'https://sandboxapi.1link.net.pk/uat-1link/sandbox/1Link';
    const ibmClientId = this.configService.get<string>('ONELINK_CLIENT_ID');
    
    if (!ibmClientId) {
      throw new InternalServerErrorException('1LINK API configuration missing. Required: ONELINK_CLIENT_ID');
    }
    
    const fullUrl = `${apiBaseUrl}${endpoint}`;
    
    this.logger.debug(`Calling 1LINK P2M QR API: POST ${fullUrl}`);
    this.logger.debug(`X-IBM-Client-Id: ${ibmClientId}`);
    this.logger.debug(`Payload: ${JSON.stringify(payload, null, 2)}`);
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-IBM-Client-Id': ibmClientId,
        'Authorization': `Bearer ${accessToken}`,
      };
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      const responseText = await response.text();
      this.logger.log(`1LINK P2M QR API response: ${response.status} - ${responseText.substring(0, 1000)}`);
      if (responseText.length > 1000) {
        this.logger.log(`... (truncated, full length: ${responseText.length})`);
      }
      
      if (!response.ok) {
        // Try to parse error response
        let errorMessage = `1LINK P2M QR API error: ${response.status}`;
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.responseDescription || errorData.message) {
            errorMessage += ` - ${errorData.responseDescription || errorData.message}`;
          } else {
            errorMessage += ` - ${responseText.substring(0, 200)}`;
          }
        } catch {
          errorMessage += ` - ${responseText.substring(0, 200)}`;
        }
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      
      // Try to parse response
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
        this.logger.debug(`Parsed 1LINK P2M QR API response: ${JSON.stringify(responseData, null, 2).substring(0, 1000)}`);
      } catch (parseError) {
        this.logger.error(`Failed to parse 1LINK P2M QR API response: ${responseText.substring(0, 500)}`);
        throw new Error(`Invalid JSON response from 1LINK P2M QR API: ${parseError.message}`);
      }
      
      // Normalize response structure (handle both camelCase and PascalCase)
      const normalizedResponse: P2MQrApiResponse = {
        responseCode: responseData.responseCode || responseData.ResponseCode || responseData.response_code || 'UNKNOWN',
        responseDescription: responseData.responseDescription || responseData.ResponseDescription || responseData.response_description || responseData.message || 'Unknown error',
      };
      
      // Check if QR code data is in response
      if (responseData.qrCode) {
        normalizedResponse.qrCode = responseData.qrCode;
      }
      if (responseData.qrData) {
        normalizedResponse.qrData = responseData.qrData;
      }
      if (responseData.QRCode) {
        normalizedResponse.qrCode = responseData.QRCode;
      }
      if (responseData.QRData) {
        normalizedResponse.qrData = responseData.QRData;
      }
      
      // Log if response code is not success
      if (normalizedResponse.responseCode !== '00' && normalizedResponse.responseCode !== 'UNKNOWN') {
        this.logger.warn(`1LINK P2M QR API returned non-success code: ${normalizedResponse.responseCode} - ${normalizedResponse.responseDescription}`);
      }
      
      return normalizedResponse;
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.logger.error(`Failed to parse 1LINK P2M QR API response: ${error.message}`);
        throw new InternalServerErrorException('Invalid response from 1LINK P2M QR API');
      }
      throw error;
    }
  }
  
  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

