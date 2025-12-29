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
    // ReferenceID must be max 25 chars to fit in AdditionalData (99 char limit)
    const timestamp = Date.now();
    const shortUserId = dto.userId.substring(0, 6).toUpperCase(); // Reduced from 8 to 6
    const depositId = `DEP-${timestamp}-${this.generateRandomString(6)}`;
    // Format: DEP-XXXXXX-TIMESTAMP (max 25 chars)
    // Example: DEP-9F130E-176673702835 = 25 chars exactly
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
    
    // Format amount: zero-padded to 12 digits (e.g., "000000345634")
    const formattedAmount = this.formatAmount(amountPkr);
    
    // Get optional convenience fee settings
    const convenienceInd = this.configService.get<string>('ONELINK_CONVENIENCE_IND');
    const convenienceFeeValue = this.configService.get<string>('ONELINK_CONVENIENCE_FEE_VALUE');
    const convenienceFeePercentage = this.configService.get<string>('ONELINK_CONVENIENCE_FEE_PERCENTAGE');
    const postalCode = this.configService.get<string>('ONELINK_POSTAL_CODE');
    
    // Build AdditionalData - MUST stay under 99 characters when encoded (EMV QR Tag 62 limit)
    // When 1LINK encodes this to EMV format, each field adds overhead (tag + length)
    // Priority: ReferenceID and Purpose are essential, others are optional
    
    // Truncate ReferenceID to max 25 chars (per 1LINK spec)
    const truncatedReferenceId = this.truncateString(referenceId, 25);
    const truncatedPurpose = this.truncateString(purpose || 'Wallet Top Up', 20); // Reduced to 20 for safety
    
    const additionalData: OneLinkQrRequest['AdditionalData'] = {
      ReferenceID: truncatedReferenceId,
      Purpose: truncatedPurpose,
    };
    
    // Add optional AdditionalData fields conservatively
    // EMV encoding adds ~6-10 chars overhead per field (tag + length + separators)
    // Conservative estimate: keep total field values under ~70 chars to stay within 99 char limit
    
    const terminalId = this.configService.get<string>('ONELINK_TERMINAL_ID');
    const billNumber = this.configService.get<string>('ONELINK_BILL_NUMBER');
    const mobileNumber = this.configService.get<string>('ONELINK_MOBILE_NUMBER');
    
    // TerminalID is most important for transaction tracking
    if (terminalId) {
      additionalData.TerminalID = this.truncateString(terminalId, 8);
    }
    
    // Add only 1-2 more short fields to stay within limit
    // BillNumber is useful for invoice tracking
    if (billNumber && billNumber.length <= 8) {
      additionalData.BillNumber = billNumber;
    } else if (mobileNumber && mobileNumber.length <= 11) {
      // Or use MobileNumber if BillNumber not available
      additionalData.MobileNumber = mobileNumber;
    }
    
    // Skip other optional fields (StoreID, LoyaltyNumber, ConsumerID, AdditionalConsumerDataRequest)
    // to ensure we stay well under the 99 character limit
    // These can be added later if needed, but must be carefully validated
    
    // Build MerchantLanguageInfoTemplate if configured
    let merchantLanguageInfo: OneLinkQrRequest['MerchantLanguageInfoTemplate'] | undefined;
    const languagePreference = this.configService.get<string>('ONELINK_LANGUAGE_PREFERENCE');
    const merchantNameAlt = this.configService.get<string>('ONELINK_MERCHANT_NAME_ALT');
    const merchantCityAlt = this.configService.get<string>('ONELINK_MERCHANT_CITY_ALT');
    const rfuForEMVCo = this.configService.get<string>('ONELINK_RFU_FOR_EMVCO');
    
    if (languagePreference || merchantNameAlt || merchantCityAlt || rfuForEMVCo) {
      merchantLanguageInfo = {};
      if (languagePreference) merchantLanguageInfo.LanguagePreference = languagePreference;
      if (merchantNameAlt) merchantLanguageInfo.MerchantNameAlternateLanguage = merchantNameAlt;
      if (merchantCityAlt) merchantLanguageInfo.MerchantCityAlternateLanguage = merchantCityAlt;
      if (rfuForEMVCo) merchantLanguageInfo.RFUforEMVCo = rfuForEMVCo;
    }
    
    const payload: OneLinkQrRequest = {
      // "11" = Static QR (based on provided payload structure)
      InitiationMethod: this.configService.get<string>('ONELINK_INITIATION_METHOD', '11'),
      
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
      
      AdditionalData: additionalData,
    };
    
    // Add optional fields if configured
    if (convenienceInd) payload.ConvenienceInd = convenienceInd;
    if (convenienceFeeValue) payload.ConvenienceFeeValue = convenienceFeeValue;
    if (convenienceFeePercentage) payload.ConvenienceFeePercentage = convenienceFeePercentage;
    if (postalCode) payload.PostalCode = postalCode;
    if (merchantLanguageInfo) payload.MerchantLanguageInfoTemplate = merchantLanguageInfo;
    
    return payload;
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
    // Use ONELINK_CLIENT_ID for X-IBM-Client-Id header (same as OAuth client ID)
    const ibmClientId = this.configService.get<string>('ONELINK_CLIENT_ID') || 
                       this.configService.get<string>('ONELINK_IBM_CLIENT_ID');
    
    if (!qrApiUrl || !ibmClientId) {
      throw new InternalServerErrorException('1LINK API configuration missing. Required: ONELINK_QR_API_URL, ONELINK_CLIENT_ID');
    }
    
    const fullUrl = `${qrApiUrl}/getQRCode`;
    
    this.logger.debug(`Calling 1LINK QR API: ${fullUrl}`);
    this.logger.debug(`X-IBM-Client-Id: ${ibmClientId}`);
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
      this.logger.debug(`1LINK QR API response: ${response.status} - ${responseText.substring(0, 500)}`);
      
      if (!response.ok) {
        throw new Error(`1LINK API error: ${response.status} - ${responseText}`);
      }
      
      const responseData: OneLinkQrResponse = JSON.parse(responseText);
      return responseData;
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.logger.error(`Failed to parse 1LINK API response: ${error.message}`);
        throw new InternalServerErrorException('Invalid response from 1LINK API');
      }
      throw error;
    }
  }
  
  /**
   * Format amount according to 1LINK specs
   * Zero-padded to 12 digits (e.g., "000000345634" for 3456.34)
   * Amount is in smallest currency unit (paisa for PKR)
   */
  private formatAmount(amountPkr: number): string {
    // Convert PKR to paisa (smallest unit) - multiply by 100
    const paisa = Math.round(amountPkr * 100);
    
    // Zero-pad to 12 digits
    return paisa.toString().padStart(12, '0');
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

  /**
   * Debug method to verify QR payload structure and configuration
   * This helps identify issues with account numbers, format, etc.
   */
  getDebugInfo(testAmount: number = 100): {
    payload: OneLinkQrRequest;
    environmentConfig: Record<string, string | undefined>;
    validation: {
      accountNumber: string;
      accountNumberLength: number;
      isIbanFormat: boolean;
      hasIbanPrefix: boolean;
      startsWithPK: boolean;
      transactionAmount: string;
      transactionAmountLength: number;
      isAmount12Digits: boolean;
      referenceId: string;
      referenceIdLength: number;
      issues: string[];
    };
    recommendations: string[];
  } {
    const testReferenceId = `DEP-TEST-${Date.now()}`.substring(0, 25);
    const payload = this.buildQrPayload(testAmount, testReferenceId, 'Test Purpose');
    
    const accountNumber = this.configService.get<string>('ONELINK_PAYEE_ACCOUNT_NUMBER', 'IBAN220011194544555666');
    const formattedAmount = this.formatAmount(testAmount);
    
    // Validation checks
    const isIbanFormat = /^PK\d{2}[A-Z]{4}\d{16}$/.test(accountNumber);
    const hasIbanPrefix = accountNumber.startsWith('IBAN');
    const startsWithPK = accountNumber.startsWith('PK');
    const isAmount12Digits = formattedAmount.length === 12;
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check account number issues
    if (hasIbanPrefix) {
      issues.push('Account number has "IBAN" prefix - should be full IBAN starting with "PK"');
      recommendations.push('Remove "IBAN" prefix from ONELINK_PAYEE_ACCOUNT_NUMBER. Use full IBAN format: PK36SCBL0000001123456702');
    }
    
    if (!startsWithPK) {
      issues.push('Account number does not start with "PK" - must be a valid Pakistani IBAN');
      recommendations.push('Account number must be a valid Pakistani IBAN starting with "PK"');
    }
    
    if (accountNumber.length !== 24) {
      issues.push(`Account number length is ${accountNumber.length}, should be exactly 24 characters`);
      recommendations.push('IBAN must be exactly 24 characters: PK + 2-digit check + 4-letter bank code + 16-digit account');
    }
    
    if (!isIbanFormat) {
      issues.push('Account number does not match Pakistani IBAN format');
      recommendations.push('Format: PK + 2-digit check + 4-letter bank code + 16-digit account (e.g., PK36SCBL0000001123456702)');
    }
    
    if (!isAmount12Digits) {
      issues.push(`Transaction amount length is ${formattedAmount.length}, should be 12 digits`);
    }
    
    // Check if account might not be registered
    if (issues.length === 0) {
      recommendations.push('Account number format looks correct. If banking apps show "invalid QR", ensure:');
      recommendations.push('1. Account is registered with 1LINK');
      recommendations.push('2. Account is enabled for 1QR payments');
      recommendations.push('3. Bank IMD (ONELINK_PAYEE_BANK_IMD) matches your bank');
    }
    
    return {
      payload,
      environmentConfig: {
        payeeAccountNumber: this.configService.get<string>('ONELINK_PAYEE_ACCOUNT_NUMBER'),
        payeeBankIMD: this.configService.get<string>('ONELINK_PAYEE_BANK_IMD'),
        payeeGuid: this.configService.get<string>('ONELINK_PAYEE_GUID'),
        productGuid: this.configService.get<string>('ONELINK_PRODUCT_GUID'),
        productCode: this.configService.get<string>('ONELINK_PRODUCT_CODE'),
        merchantName: this.configService.get<string>('ONELINK_MERCHANT_NAME'),
        merchantCity: this.configService.get<string>('ONELINK_MERCHANT_CITY'),
        mcc: this.configService.get<string>('ONELINK_MCC'),
        initiationMethod: this.configService.get<string>('ONELINK_INITIATION_METHOD'),
        clientId: this.configService.get<string>('ONELINK_CLIENT_ID') ? '***configured***' : undefined,
        qrApiUrl: this.configService.get<string>('ONELINK_QR_API_URL'),
      },
      validation: {
        accountNumber,
        accountNumberLength: accountNumber.length,
        isIbanFormat,
        hasIbanPrefix,
        startsWithPK,
        transactionAmount: formattedAmount,
        transactionAmountLength: formattedAmount.length,
        isAmount12Digits,
        referenceId: testReferenceId,
        referenceIdLength: testReferenceId.length,
        issues,
      },
      recommendations,
    };
  }
}

