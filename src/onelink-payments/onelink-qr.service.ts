import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OneLinkOAuthService } from './onelink-oauth.service';
import { 
  GenerateQrDto, 
  GenerateQrResponseDto, 
  OneLinkQrRequest, 
  OneLinkQrResponse 
} from './dto/generate-qr.dto';

@Injectable()
export class OneLinkQrService {
  private readonly logger = new Logger(OneLinkQrService.name);
  
  // Retry configuration
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 1000;
  
  constructor(
    private readonly configService: ConfigService,
    private readonly oauthService: OneLinkOAuthService,
  ) {}
  
  /**
   * Generate a 1LINK QR code for deposit
   */
  async generateQr(dto: GenerateQrDto): Promise<GenerateQrResponseDto> {
    // Validate amount
    if (dto.amountPkr < 1 || dto.amountPkr > 500000) {
      throw new BadRequestException('Amount must be between 1 and 500,000 PKR');
    }
    
    // Generate unique IDs
    const timestamp = Date.now();
    const shortUserId = dto.userId.substring(0, 8).toUpperCase();
    const depositId = `DEP-${timestamp}-${this.generateRandomString(6)}`;
    const referenceId = this.truncateString(`DEP-${shortUserId}-${timestamp}`, 25); // Max 25 chars
    
    // Build QR request payload
    const qrPayload = this.buildQrPayload(dto.amountPkr, referenceId, dto.purpose);
    
    // Call 1LINK API with retry logic
    const qrResponse = await this.callQrApiWithRetry(qrPayload);
    
    // Validate response
    if (qrResponse.ResponseCode !== '0000') {
      this.logger.error(`1LINK QR generation failed: ${qrResponse.ResponseCode} - ${qrResponse.ResponseDetail}`);
      throw new InternalServerErrorException(`QR generation failed: ${qrResponse.ResponseDetail}`);
    }
    
    if (!qrResponse.QRCode) {
      throw new InternalServerErrorException('QR code not returned from 1LINK');
    }
    
    return {
      depositId,
      referenceId,
      amountPkr: dto.amountPkr.toString(),
      qrCodeBase64: qrResponse.QRCode,
      qrCodeDataUri: `data:image/png;base64,${qrResponse.QRCode}`,
      currency: 'PKR',
    };
  }
  
  /**
   * Build the QR request payload according to 1LINK specs
   */
  private buildQrPayload(amountPkr: number, referenceId: string, purpose?: string): OneLinkQrRequest {
    const merchantName = this.truncateString(
      this.configService.get<string>('ONELINK_MERCHANT_NAME', 'Blocks'),
      25
    );
    const merchantCity = this.truncateString(
      this.configService.get<string>('ONELINK_MERCHANT_CITY', 'Karachi'),
      15
    );
    
    // Format amount: clean numeric string (no zero-padding needed)
    const formattedAmount = this.formatAmount(amountPkr);
    
    return {
      // "12" = Dynamic QR (with specific amount)
      InitiationMethod: '12',
      
      MerchantAccountInformationPayee: {
        GloballyUniqueIdentifier: this.configService.get<string>('ONELINK_PAYEE_GUID', 'A000000736'),
        PayeeBankIMD: this.configService.get<string>('ONELINK_PAYEE_BANK_IMD', '435345'),
        PayeeAccountNumber: this.configService.get<string>('ONELINK_PAYEE_ACCOUNT_NUMBER', 'IBAN220011194544555666'),
      },
      
      MerchantAccountInformationProduct: {
        GloballyUniqueIdentifier: this.configService.get<string>('ONELINK_PRODUCT_GUID', 'A00000736'),
        ProductCode: this.configService.get<string>('ONELINK_PRODUCT_CODE', '000081'),
      },
      
      // MCC must be exactly 4 digits
      MCC: this.configService.get<string>('ONELINK_MCC', '0010'),
      
      // "586" = PKR currency code
      CurrencyCode: '586',
      
      TransactionAmount: formattedAmount,
      
      // "PK" = Pakistan
      CountryCode: 'PK',
      
      MerchantName: merchantName,
      MerchantCity: merchantCity,
      
      AdditionalData: {
        ReferenceID: referenceId,
        Purpose: this.truncateString(purpose || 'Wallet Top Up', 25),
      },
    };
  }
  
  /**
   * Call 1LINK QR API with retry logic
   */
  private async callQrApiWithRetry(payload: OneLinkQrRequest, attempt: number = 1): Promise<OneLinkQrResponse> {
    try {
      return await this.callQrApi(payload);
    } catch (error) {
      if (attempt < this.MAX_RETRIES) {
        this.logger.warn(`1LINK QR API call failed (attempt ${attempt}), retrying...`);
        
        // Wait before retry
        await this.delay(this.RETRY_DELAY_MS);
        
        // Invalidate token on auth errors
        if (error.message?.includes('401') || error.message?.includes('authentication')) {
          this.oauthService.invalidateToken();
        }
        
        return this.callQrApiWithRetry(payload, attempt + 1);
      }
      
      this.logger.error(`1LINK QR API call failed after ${this.MAX_RETRIES} attempts`, error);
      throw error;
    }
  }
  
  /**
   * Make the actual API call to 1LINK
   */
  private async callQrApi(payload: OneLinkQrRequest): Promise<OneLinkQrResponse> {
    const accessToken = await this.oauthService.getAccessToken();
    const qrApiUrl = this.configService.get<string>('ONELINK_QR_API_URL');
    const ibmClientId = this.configService.get<string>('ONELINK_IBM_CLIENT_ID');
    
    if (!qrApiUrl || !ibmClientId) {
      throw new InternalServerErrorException('1LINK API configuration missing');
    }
    
    const fullUrl = `${qrApiUrl}/getQRCode`;
    
    this.logger.debug(`Calling 1LINK QR API: ${fullUrl}`);
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
      this.logger.debug(`1LINK QR API response: ${response.status} - ${responseText}`);
      
      if (!response.ok) {
        throw new Error(`1LINK API error: ${response.status} - ${responseText}`);
      }
      
      const responseData: OneLinkQrResponse = JSON.parse(responseText);
      return responseData;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new InternalServerErrorException('Invalid response from 1LINK API');
      }
      throw error;
    }
  }
  
  /**
   * Format amount according to 1LINK specs
   * Clean numeric string, max 13 chars, max 2 decimals
   */
  private formatAmount(amount: number): string {
    // Round to 2 decimal places
    const rounded = Math.round(amount * 100) / 100;
    
    // Convert to string without unnecessary decimals
    if (Number.isInteger(rounded)) {
      return rounded.toString();
    }
    
    return rounded.toFixed(2);
  }
  
  /**
   * Truncate string to max length
   */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength);
  }
  
  /**
   * Generate random alphanumeric string
   */
  private generateRandomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

