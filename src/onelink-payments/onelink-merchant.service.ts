import { Injectable, Logger, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OneLinkOAuthService } from './onelink-oauth.service';
import { MerchantProfile } from './entities/merchant-profile.entity';
import {
  CreateMerchantProfileDto,
  UpdateMerchantProfileDto,
  GetMerchantProfileQueryDto,
  NotifyMerchantDto,
  PaymentNotificationDto,
  CreateMerchantProfileRequest,
  UpdateMerchantProfileRequest,
  MerchantProfileApiResponse,
} from './dto/merchant-profile.dto';

@Injectable()
export class OneLinkMerchantService {
  private readonly logger = new Logger(OneLinkMerchantService.name);
  
  // Retry configuration
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY_MS = 1000;
  
  constructor(
    private readonly configService: ConfigService,
    private readonly oauthService: OneLinkOAuthService,
    @InjectRepository(MerchantProfile)
    private readonly merchantProfileRepo: Repository<MerchantProfile>,
  ) {}

  // ============================================
  // Create Merchant Profile
  // ============================================
  
  async createMerchantProfile(dto: CreateMerchantProfileDto): Promise<MerchantProfileApiResponse & { merchantProfile?: MerchantProfile }> {
    this.logger.log(`Creating merchant profile: ${dto.merchantDetails.merchantID}`);
    
    // Check if merchant profile already exists
    const existing = await this.merchantProfileRepo.findOne({
      where: { merchantID: dto.merchantDetails.merchantID },
    });
    
    if (existing) {
      throw new BadRequestException(`Merchant profile with ID ${dto.merchantDetails.merchantID} already exists`);
    }
    
    // Build request payload
    const requestPayload: CreateMerchantProfileRequest = {
      merchantDetails: {
        dbaName: dto.merchantDetails.dbaName,
        merchantName: dto.merchantDetails.merchantName,
        iban: dto.merchantDetails.iban,
        bankBic: dto.merchantDetails.bankBic,
        merchantCategoryCode: dto.merchantDetails.merchantCategoryCode,
        merchantID: dto.merchantDetails.merchantID,
        accountTitle: dto.merchantDetails.accountTitle,
      },
    };
    
    // Add optional fields
    if (dto.merchantDetails.postalAddress) {
      requestPayload.merchantDetails.postalAddress = {
        townName: dto.merchantDetails.postalAddress.townName,
        addressLine: dto.merchantDetails.postalAddress.addressLine,
      };
    }
    
    if (dto.merchantDetails.contactDetails) {
      // Format phone numbers to international format if needed (13-15 digits)
      let phoneNo = dto.merchantDetails.contactDetails.phoneNo;
      let mobileNo = dto.merchantDetails.contactDetails.mobileNo;
      
      // Convert Pakistani numbers to international format if needed
      if (phoneNo && !phoneNo.startsWith('+')) {
        // Remove leading 0 and add +92
        phoneNo = phoneNo.replace(/^0/, '+92');
      }
      if (mobileNo && !mobileNo.startsWith('+')) {
        // Remove leading 0 and add +92
        mobileNo = mobileNo.replace(/^0/, '+92');
      }
      
      requestPayload.merchantDetails.contactDetails = {
        phoneNo,
        mobileNo,
        email: dto.merchantDetails.contactDetails.email,
        dept: dto.merchantDetails.contactDetails.dept,
        website: dto.merchantDetails.contactDetails.website,
      };
    }
    
    if (dto.merchantDetails.paymentDetails) {
      requestPayload.merchantDetails.paymentDetails = {
        feeType: dto.merchantDetails.paymentDetails.feeType,
        feeValue: dto.merchantDetails.paymentDetails.feeValue,
      };
    }
    
    try {
      // Call 1LINK API
      let response: MerchantProfileApiResponse;
      try {
        response = await this.callMerchantApiWithRetry('/createMerchantProfile', requestPayload);
      } catch (apiError) {
        this.logger.error(`1LINK API call failed: ${apiError.message}`, apiError.stack);
        // If API call fails, we still want to return a meaningful error
        throw new InternalServerErrorException(
          `Failed to create merchant profile in 1LINK: ${apiError.message}`
        );
      }
      
      // Save merchant profile to database
      const merchantProfile = this.merchantProfileRepo.create({
        merchantID: dto.merchantDetails.merchantID,
        dbaName: dto.merchantDetails.dbaName,
        merchantName: dto.merchantDetails.merchantName,
        iban: dto.merchantDetails.iban,
        bankBic: dto.merchantDetails.bankBic,
        merchantCategoryCode: dto.merchantDetails.merchantCategoryCode,
        accountTitle: dto.merchantDetails.accountTitle,
        merchantStatus: '00', // Active by default
        townName: dto.merchantDetails.postalAddress?.townName,
        addressLine: dto.merchantDetails.postalAddress?.addressLine,
        phoneNo: requestPayload.merchantDetails.contactDetails?.phoneNo,
        mobileNo: requestPayload.merchantDetails.contactDetails?.mobileNo,
        email: dto.merchantDetails.contactDetails?.email,
        dept: dto.merchantDetails.contactDetails?.dept,
        website: dto.merchantDetails.contactDetails?.website,
        feeType: dto.merchantDetails.paymentDetails?.feeType,
        feeValue: dto.merchantDetails.paymentDetails?.feeValue,
        lastRequestPayload: requestPayload as unknown as Record<string, unknown>,
        lastResponsePayload: response as unknown as Record<string, unknown>,
        lastResponseCode: response.responseCode,
        lastResponseDescription: response.responseDescription,
      });
      
      await this.merchantProfileRepo.save(merchantProfile);
      
      this.logger.log(`Merchant profile created successfully: ${dto.merchantDetails.merchantID}`);
      
      return { ...response, merchantProfile };
    } catch (error) {
      this.logger.error(`Failed to create merchant profile: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ============================================
  // Update Merchant Profile
  // ============================================
  
  async updateMerchantProfile(dto: UpdateMerchantProfileDto): Promise<MerchantProfileApiResponse & { merchantProfile?: MerchantProfile }> {
    this.logger.log(`Updating merchant profile: ${dto.merchantDetails.merchantID}`);
    
    // Find existing merchant profile
    const existing = await this.merchantProfileRepo.findOne({
      where: { merchantID: dto.merchantDetails.merchantID },
    });
    
    if (!existing) {
      throw new NotFoundException(`Merchant profile with ID ${dto.merchantDetails.merchantID} not found`);
    }
    
    // Build request payload
    const requestPayload: UpdateMerchantProfileRequest = {
      merchantDetails: {
        merchantStatus: dto.merchantDetails.merchantStatus,
        dbaName: dto.merchantDetails.dbaName,
        merchantName: dto.merchantDetails.merchantName,
        iban: dto.merchantDetails.iban,
        bankBic: dto.merchantDetails.bankBic,
        merchantCategoryCode: dto.merchantDetails.merchantCategoryCode,
        merchantID: dto.merchantDetails.merchantID,
        accountTitle: dto.merchantDetails.accountTitle,
      },
    };
    
    // Add reasonCode if provided
    if (dto.merchantDetails.reasonCode) {
      requestPayload.merchantDetails.reasonCode = dto.merchantDetails.reasonCode;
    }
    
    try {
      // Call 1LINK API
      let response: MerchantProfileApiResponse;
      try {
        response = await this.callMerchantApiWithRetry('/updateMerchantProfile', requestPayload);
      } catch (apiError) {
        this.logger.error(`1LINK API call failed: ${apiError.message}`, apiError.stack);
        throw new InternalServerErrorException(
          `Failed to update merchant profile in 1LINK: ${apiError.message}`
        );
      }
      
      // Update merchant profile in database
      existing.dbaName = dto.merchantDetails.dbaName;
      existing.merchantName = dto.merchantDetails.merchantName;
      existing.iban = dto.merchantDetails.iban;
      existing.bankBic = dto.merchantDetails.bankBic;
      existing.merchantCategoryCode = dto.merchantDetails.merchantCategoryCode;
      existing.accountTitle = dto.merchantDetails.accountTitle;
      existing.merchantStatus = dto.merchantDetails.merchantStatus;
      existing.reasonCode = dto.merchantDetails.reasonCode;
      existing.lastRequestPayload = requestPayload as unknown as Record<string, unknown>;
      existing.lastResponsePayload = response as unknown as Record<string, unknown>;
      existing.lastResponseCode = response.responseCode;
      existing.lastResponseDescription = response.responseDescription;
      
      await this.merchantProfileRepo.save(existing);
      
      this.logger.log(`Merchant profile updated successfully: ${dto.merchantDetails.merchantID}`);
      
      return { ...response, merchantProfile: existing };
    } catch (error) {
      this.logger.error(`Failed to update merchant profile: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ============================================
  // Get Merchant Profile
  // ============================================
  
  async getMerchantProfile(merchantID: string): Promise<MerchantProfileApiResponse & { merchantProfile?: MerchantProfile }> {
    this.logger.log(`Getting merchant profile: ${merchantID}`);
    
    try {
      // Call 1LINK API
      const response = await this.callMerchantApiWithRetry(`/getMerchantProfile?merchantID=${merchantID}`, null, 'GET');
      
      // Try to find in database
      const merchantProfile = await this.merchantProfileRepo.findOne({
        where: { merchantID },
      });
      
      return { ...response, merchantProfile: merchantProfile || undefined };
    } catch (error) {
      this.logger.error(`Failed to get merchant profile: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ============================================
  // Create Merchant Profile Version 2
  // ============================================
  
  async createMerchantProfileVersion2(dto: CreateMerchantProfileDto): Promise<MerchantProfileApiResponse & { merchantProfile?: MerchantProfile }> {
    this.logger.log(`Creating merchant profile (v2): ${dto.merchantDetails.merchantID}`);
    
    // Check if merchant profile already exists
    const existing = await this.merchantProfileRepo.findOne({
      where: { merchantID: dto.merchantDetails.merchantID },
    });
    
    if (existing) {
      throw new BadRequestException(`Merchant profile with ID ${dto.merchantDetails.merchantID} already exists`);
    }
    
    // Build request payload (same as v1 for now, but can be extended)
    const requestPayload: CreateMerchantProfileRequest = {
      merchantDetails: {
        dbaName: dto.merchantDetails.dbaName,
        merchantName: dto.merchantDetails.merchantName,
        iban: dto.merchantDetails.iban,
        bankBic: dto.merchantDetails.bankBic,
        merchantCategoryCode: dto.merchantDetails.merchantCategoryCode,
        merchantID: dto.merchantDetails.merchantID,
        accountTitle: dto.merchantDetails.accountTitle,
      },
    };
    
    // Add optional fields
    if (dto.merchantDetails.postalAddress) {
      requestPayload.merchantDetails.postalAddress = {
        townName: dto.merchantDetails.postalAddress.townName,
        addressLine: dto.merchantDetails.postalAddress.addressLine,
      };
    }
    
    if (dto.merchantDetails.contactDetails) {
      // Format phone numbers to international format if needed (13-15 digits)
      let phoneNo = dto.merchantDetails.contactDetails.phoneNo;
      let mobileNo = dto.merchantDetails.contactDetails.mobileNo;
      
      // Convert Pakistani numbers to international format if needed
      if (phoneNo && !phoneNo.startsWith('+')) {
        // Remove leading 0 and add +92
        phoneNo = phoneNo.replace(/^0/, '+92');
      }
      if (mobileNo && !mobileNo.startsWith('+')) {
        // Remove leading 0 and add +92
        mobileNo = mobileNo.replace(/^0/, '+92');
      }
      
      requestPayload.merchantDetails.contactDetails = {
        phoneNo,
        mobileNo,
        email: dto.merchantDetails.contactDetails.email,
        dept: dto.merchantDetails.contactDetails.dept,
        website: dto.merchantDetails.contactDetails.website,
      };
    }
    
    if (dto.merchantDetails.paymentDetails) {
      requestPayload.merchantDetails.paymentDetails = {
        feeType: dto.merchantDetails.paymentDetails.feeType,
        feeValue: dto.merchantDetails.paymentDetails.feeValue,
      };
    }
    
    try {
      // Call 1LINK API (v2 endpoint)
      const response = await this.callMerchantApiWithRetry('/createMerchantProfileVersion2', requestPayload);
      
      // Save merchant profile to database
      const merchantProfile = this.merchantProfileRepo.create({
        merchantID: dto.merchantDetails.merchantID,
        dbaName: dto.merchantDetails.dbaName,
        merchantName: dto.merchantDetails.merchantName,
        iban: dto.merchantDetails.iban,
        bankBic: dto.merchantDetails.bankBic,
        merchantCategoryCode: dto.merchantDetails.merchantCategoryCode,
        accountTitle: dto.merchantDetails.accountTitle,
        merchantStatus: '00', // Active by default
        townName: dto.merchantDetails.postalAddress?.townName,
        addressLine: dto.merchantDetails.postalAddress?.addressLine,
        phoneNo: requestPayload.merchantDetails.contactDetails?.phoneNo,
        mobileNo: requestPayload.merchantDetails.contactDetails?.mobileNo,
        email: dto.merchantDetails.contactDetails?.email,
        dept: dto.merchantDetails.contactDetails?.dept,
        website: dto.merchantDetails.contactDetails?.website,
        feeType: dto.merchantDetails.paymentDetails?.feeType,
        feeValue: dto.merchantDetails.paymentDetails?.feeValue,
        lastRequestPayload: requestPayload as unknown as Record<string, unknown>,
        lastResponsePayload: response as unknown as Record<string, unknown>,
        lastResponseCode: response.responseCode,
        lastResponseDescription: response.responseDescription,
      });
      
      await this.merchantProfileRepo.save(merchantProfile);
      
      this.logger.log(`Merchant profile created successfully (v2): ${dto.merchantDetails.merchantID}`);
      
      return { ...response, merchantProfile };
    } catch (error) {
      this.logger.error(`Failed to create merchant profile (v2): ${error.message}`, error.stack);
      throw error;
    }
  }

  // ============================================
  // Notify Merchant (Webhook handler - called by 1LINK)
  // ============================================
  
  async handleNotifyMerchant(dto: NotifyMerchantDto): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Received merchant notification: ${dto.messageInfo.merchantID}, status: ${dto.messageInfo.status}`);
    
    try {
      // Find merchant profile
      const merchantProfile = await this.merchantProfileRepo.findOne({
        where: { merchantID: dto.messageInfo.merchantID },
      });
      
      if (merchantProfile) {
        // Update status if needed
        // Status mapping: ACCP = Accepted, RJCT = Rejected, etc.
        this.logger.log(`Merchant notification processed: ${dto.messageInfo.merchantID}, RRN: ${dto.info.rrn}, STAN: ${dto.info.stan}`);
      } else {
        this.logger.warn(`Merchant profile not found for notification: ${dto.messageInfo.merchantID}`);
      }
      
      // TODO: Emit event or trigger business logic based on status
      // Example: If status is ACCP, credit wallet, etc.
      
      return {
        success: true,
        message: 'Notification received and processed',
      };
    } catch (error) {
      this.logger.error(`Failed to process merchant notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ============================================
  // Payment Notification (Webhook handler - called by 1LINK)
  // ============================================
  
  async handlePaymentNotification(dto: PaymentNotificationDto): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Received payment notification: ${dto.messageInfo.merchantID}, status: ${dto.messageInfo.status}`);
    this.logger.log(`Amount: ${dto.messageInfo.orginalInstructedAmount}, Net: ${dto.messageInfo.netAmount}`);
    
    try {
      // Find merchant profile
      const merchantProfile = await this.merchantProfileRepo.findOne({
        where: { merchantID: dto.messageInfo.merchantID },
      });
      
      if (merchantProfile) {
        this.logger.log(`Payment notification processed: ${dto.messageInfo.merchantID}, RRN: ${dto.info.rrn}, STAN: ${dto.info.stan}`);
        this.logger.log(`Original Amount: ${dto.messageInfo.orginalInstructedAmount}, Net Amount: ${dto.messageInfo.netAmount}`);
      } else {
        this.logger.warn(`Merchant profile not found for payment notification: ${dto.messageInfo.merchantID}`);
      }
      
      // TODO: Emit event or trigger business logic
      // Example: Credit wallet with netAmount, create transaction record, etc.
      
      return {
        success: true,
        message: 'Payment notification received and processed',
      };
    } catch (error) {
      this.logger.error(`Failed to process payment notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ============================================
  // Create Test Merchant Profile (Sandbox Mode)
  // ============================================
  
  async createTestMerchantProfile(dto: CreateMerchantProfileDto): Promise<MerchantProfileApiResponse & { merchantProfile?: MerchantProfile }> {
    this.logger.log(`Creating TEST merchant profile (bypassing 1LINK API): ${dto.merchantDetails.merchantID}`);
    
    // Check if merchant profile already exists
    const existing = await this.merchantProfileRepo.findOne({
      where: { merchantID: dto.merchantDetails.merchantID },
    });
    
    if (existing) {
      throw new BadRequestException(`Merchant profile with ID ${dto.merchantDetails.merchantID} already exists`);
    }
    
    // Format phone numbers to international format if needed (13-15 digits)
    let phoneNo = dto.merchantDetails.contactDetails?.phoneNo;
    let mobileNo = dto.merchantDetails.contactDetails?.mobileNo;
    
    // Convert Pakistani numbers to international format if needed
    if (phoneNo && !phoneNo.startsWith('+')) {
      // Remove leading 0 and add +92
      phoneNo = phoneNo.replace(/^0/, '+92');
    }
    if (mobileNo && !mobileNo.startsWith('+')) {
      // Remove leading 0 and add +92
      mobileNo = mobileNo.replace(/^0/, '+92');
    }
    
    // Create merchant profile directly in database (test mode)
    const merchantProfile = this.merchantProfileRepo.create({
      merchantID: dto.merchantDetails.merchantID,
      dbaName: dto.merchantDetails.dbaName,
      merchantName: dto.merchantDetails.merchantName,
      iban: dto.merchantDetails.iban,
      bankBic: dto.merchantDetails.bankBic,
      merchantCategoryCode: dto.merchantDetails.merchantCategoryCode,
      accountTitle: dto.merchantDetails.accountTitle,
      merchantStatus: '00', // Active
      townName: dto.merchantDetails.postalAddress?.townName,
      addressLine: dto.merchantDetails.postalAddress?.addressLine,
      phoneNo,
      mobileNo,
      email: dto.merchantDetails.contactDetails?.email,
      dept: dto.merchantDetails.contactDetails?.dept,
      website: dto.merchantDetails.contactDetails?.website,
      feeType: dto.merchantDetails.paymentDetails?.feeType,
      feeValue: dto.merchantDetails.paymentDetails?.feeValue,
      lastResponseCode: '00',
      lastResponseDescription: 'Test merchant profile created (sandbox mode)',
    });
    
    await this.merchantProfileRepo.save(merchantProfile);
    
    this.logger.log(`Test merchant profile created successfully: ${dto.merchantDetails.merchantID}`);
    
    return {
      responseCode: '00',
      responseDescription: 'Test merchant profile created (sandbox mode)',
      merchantProfile,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================
  
  /**
   * Call 1LINK Merchant API with retry logic
   */
  private async callMerchantApiWithRetry(
    endpoint: string,
    payload: CreateMerchantProfileRequest | UpdateMerchantProfileRequest | null,
    method: 'GET' | 'POST' = 'POST',
    attempt: number = 1,
  ): Promise<MerchantProfileApiResponse> {
    try {
      return await this.callMerchantApi(endpoint, payload, method);
    } catch (error) {
      if (attempt < this.MAX_RETRIES) {
        this.logger.warn(`1LINK Merchant API call failed (attempt ${attempt}), retrying...`);
        
        // Wait before retry
        await this.delay(this.RETRY_DELAY_MS);
        
        // Invalidate token on auth errors
        if (error.message?.includes('401') || error.message?.includes('authentication')) {
          this.oauthService.invalidateToken();
        }
        
        return this.callMerchantApiWithRetry(endpoint, payload, method, attempt + 1);
      }
      
      this.logger.error(`1LINK Merchant API call failed after ${this.MAX_RETRIES} attempts`, error);
      throw error;
    }
  }

  /**
   * Make the actual API call to 1LINK Merchant API
   */
  private async callMerchantApi(
    endpoint: string,
    payload: CreateMerchantProfileRequest | UpdateMerchantProfileRequest | null,
    method: 'GET' | 'POST' = 'POST',
  ): Promise<MerchantProfileApiResponse> {
    const accessToken = await this.oauthService.getAccessToken();
    // P2M Merchant APIs use the same base URL as RTP APIs
    const apiBaseUrl = this.configService.get<string>('ONELINK_RTP_API_URL') || 
                      this.configService.get<string>('ONELINK_MERCHANT_API_URL') ||
                      'https://sandboxapi.1link.net.pk/uat-1link/sandbox/1Link';
    const ibmClientId = this.configService.get<string>('ONELINK_CLIENT_ID');
    
    if (!ibmClientId) {
      throw new InternalServerErrorException('1LINK API configuration missing. Required: ONELINK_CLIENT_ID');
    }
    
    const fullUrl = `${apiBaseUrl}${endpoint}`;
    
    this.logger.debug(`Calling 1LINK Merchant API: ${method} ${fullUrl}`);
    this.logger.debug(`X-IBM-Client-Id: ${ibmClientId}`);
    if (payload) {
      this.logger.debug(`Payload: ${JSON.stringify(payload, null, 2)}`);
    }
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-IBM-Client-Id': ibmClientId,
        'Authorization': `Bearer ${accessToken}`,
      };
      
      const fetchOptions: RequestInit = {
        method,
        headers,
      };
      
      if (method === 'POST' && payload) {
        fetchOptions.body = JSON.stringify(payload);
      }
      
      const response = await fetch(fullUrl, fetchOptions);
      
      const responseText = await response.text();
      this.logger.debug(`1LINK Merchant API response: ${response.status} - ${responseText.substring(0, 500)}`);
      
      if (!response.ok) {
        // Try to parse error response
        let errorMessage = `1LINK API error: ${response.status}`;
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
      let responseData: MerchantProfileApiResponse;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        this.logger.error(`Failed to parse 1LINK API response: ${responseText.substring(0, 500)}`);
        throw new Error(`Invalid JSON response from 1LINK API: ${parseError.message}`);
      }
      
      // Log if response code is not success
      if (responseData.responseCode && responseData.responseCode !== '00') {
        this.logger.warn(`1LINK API returned non-success code: ${responseData.responseCode} - ${responseData.responseDescription}`);
      }
      
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
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get merchant profile from database
   */
  async getMerchantProfileFromDb(merchantID: string): Promise<MerchantProfile | null> {
    return this.merchantProfileRepo.findOne({
      where: { merchantID },
    });
  }

  /**
   * List all merchant profiles from database
   */
  async listMerchantProfiles(): Promise<MerchantProfile[]> {
    return this.merchantProfileRepo.find({
      order: { createdAt: 'DESC' },
    });
  }
}
