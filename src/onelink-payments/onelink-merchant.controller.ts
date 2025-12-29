import {
  Controller,
  Post,
  Get,
  Body,
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
import { OneLinkMerchantService } from './onelink-merchant.service';
import {
  CreateMerchantProfileDto,
  UpdateMerchantProfileDto,
  GetMerchantProfileQueryDto,
  NotifyMerchantDto,
  PaymentNotificationDto,
} from './dto/merchant-profile.dto';

@Controller('api/payments/1link/merchant')
export class OneLinkMerchantController {
  private readonly logger = new Logger(OneLinkMerchantController.name);

  constructor(private readonly merchantService: OneLinkMerchantService) {}

  /**
   * Create Merchant Profile
   * 
   * POST /api/payments/1link/merchant/profile
   * 
   * Creates a new merchant profile in 1LINK system.
   * This is a prerequisite for P2M (Person-to-Merchant) QR code generation.
   * 
   * Request Body:
   * {
   *   "merchantDetails": {
   *     "dbaName": "My Business Name",
   *     "merchantName": "My Merchant Name",
   *     "iban": "PK36SCBL0000001123456702",
   *     "bankBic": "SCBLPK",
   *     "merchantCategoryCode": "0010",
   *     "merchantID": "MERCHANT001",
   *     "accountTitle": "My Account Title",
   *     "postalAddress": {
   *       "townName": "Karachi",
   *       "addressLine": "123 Main Street"
   *     },
   *     "contactDetails": {
   *       "phoneNo": "02112345678",
   *       "mobileNo": "03001234567",
   *       "email": "merchant@example.com",
   *       "dept": "Sales",
   *       "website": "https://example.com"
   *     },
   *     "paymentDetails": {
   *       "feeType": "F",
   *       "feeValue": 15
   *     }
   *   }
   * }
   * 
   * Response:
   * {
   *   "responseCode": "00",
   *   "responseDescription": "Processed OK",
   *   "merchantProfile": { ... }
   * }
   */
  @Post('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createMerchantProfile(
    @CurrentUser() user: User,
    @Body() dto: CreateMerchantProfileDto,
  ) {
    this.logger.log(`Creating merchant profile: ${dto.merchantDetails.merchantID} by user ${user.id}`);

    try {
      const result = await this.merchantService.createMerchantProfile(dto);
      this.logger.log(`Merchant profile created successfully: ${dto.merchantDetails.merchantID}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create merchant profile: ${error.message}`, error.stack);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        'Failed to create merchant profile. Please try again later.'
      );
    }
  }

  /**
   * Update Merchant Profile
   * 
   * POST /api/payments/1link/merchant/profile/update
   * 
   * Updates an existing merchant profile in 1LINK system.
   * 
   * Request Body:
   * {
   *   "merchantDetails": {
   *     "merchantStatus": "00",
   *     "reasonCode": "Optional reason",
   *     "dbaName": "Updated Business Name",
   *     "merchantName": "Updated Merchant Name",
   *     "iban": "PK36SCBL0000001123456702",
   *     "bankBic": "SCBLPK",
   *     "merchantCategoryCode": "0010",
   *     "merchantID": "MERCHANT001",
   *     "accountTitle": "Updated Account Title"
   *   }
   * }
   * 
   * Response:
   * {
   *   "responseCode": "00",
   *   "responseDescription": "Processed OK",
   *   "merchantProfile": { ... }
   * }
   */
  @Post('profile/update')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateMerchantProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateMerchantProfileDto,
  ) {
    this.logger.log(`Updating merchant profile: ${dto.merchantDetails.merchantID} by user ${user.id}`);

    try {
      const result = await this.merchantService.updateMerchantProfile(dto);
      this.logger.log(`Merchant profile updated successfully: ${dto.merchantDetails.merchantID}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to update merchant profile: ${error.message}`, error.stack);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        'Failed to update merchant profile. Please try again later.'
      );
    }
  }

  /**
   * Get Merchant Profile
   * 
   * GET /api/payments/1link/merchant/profile?merchantID=MERCHANT001
   * 
   * Retrieves merchant profile information from 1LINK system.
   * 
   * Query Parameters:
   * - merchantID: Required - The merchant ID to retrieve
   * 
   * Response:
   * {
   *   "responseCode": "00",
   *   "responseDescription": "Processed OK",
   *   "merchantProfile": { ... }
   * }
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getMerchantProfile(
    @CurrentUser() user: User,
    @Query() query: GetMerchantProfileQueryDto,
  ) {
    this.logger.log(`Getting merchant profile: ${query.merchantID} by user ${user.id}`);

    if (!query.merchantID) {
      throw new BadRequestException('merchantID query parameter is required');
    }

    try {
      const result = await this.merchantService.getMerchantProfile(query.merchantID);
      return result;
    } catch (error) {
      this.logger.error(`Failed to get merchant profile: ${error.message}`, error.stack);
      
      throw new InternalServerErrorException(
        'Failed to get merchant profile. Please try again later.'
      );
    }
  }

  /**
   * Create Merchant Profile Version 2
   * 
   * POST /api/payments/1link/merchant/profile/v2
   * 
   * Creates a new merchant profile using version 2 of the API.
   * Same payload structure as v1, but may include additional features.
   * 
   * Request Body: Same as createMerchantProfile
   * Response: Same as createMerchantProfile
   */
  @Post('profile/v2')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createMerchantProfileVersion2(
    @CurrentUser() user: User,
    @Body() dto: CreateMerchantProfileDto,
  ) {
    this.logger.log(`Creating merchant profile (v2): ${dto.merchantDetails.merchantID} by user ${user.id}`);

    try {
      const result = await this.merchantService.createMerchantProfileVersion2(dto);
      this.logger.log(`Merchant profile created successfully (v2): ${dto.merchantDetails.merchantID}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create merchant profile (v2): ${error.message}`, error.stack);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        'Failed to create merchant profile. Please try again later.'
      );
    }
  }

  /**
   * Create Test Merchant Profile (Sandbox Mode - Bypasses 1LINK API)
   * 
   * POST /api/payments/1link/merchant/profile/test
   * 
   * This endpoint creates a merchant profile locally without calling 1LINK API.
   * Useful for testing and development when you don't have real merchant data.
   * 
   * Request Body: Same as Create Merchant Profile
   * Response: Same as Create Merchant Profile (with responseCode: "00")
   */
  @Post('profile/test')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createTestMerchantProfile(
    @CurrentUser() user: User,
    @Body() dto: CreateMerchantProfileDto,
  ) {
    this.logger.log(`Creating TEST merchant profile: ${dto.merchantDetails.merchantID} by user ${user.id}`);

    try {
      const result = await this.merchantService.createTestMerchantProfile(dto);
      this.logger.log(`Test merchant profile created successfully: ${dto.merchantDetails.merchantID}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create test merchant profile: ${error.message}`, error.stack);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        'Failed to create test merchant profile. Please try again later.'
      );
    }
  }

  /**
   * List All Merchant Profiles (from database)
   * 
   * GET /api/payments/1link/merchant/profiles
   * 
   * Retrieves all merchant profiles stored in the local database.
   * This is a convenience endpoint to view all registered merchants.
   * 
   * Response:
   * [
   *   {
   *     "id": "uuid",
   *     "merchantID": "MERCHANT001",
   *     "dbaName": "My Business",
   *     ...
   *   },
   *   ...
   * ]
   */
  @Get('profiles')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async listMerchantProfiles(@CurrentUser() user: User) {
    this.logger.log(`Listing merchant profiles by user ${user.id}`);

    try {
      const profiles = await this.merchantService.listMerchantProfiles();
      return {
        success: true,
        count: profiles.length,
        profiles,
      };
    } catch (error) {
      this.logger.error(`Failed to list merchant profiles: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to list merchant profiles');
    }
  }

  /**
   * Notify Merchant (Webhook endpoint - called by 1LINK)
   * 
   * POST /api/payments/1link/merchant/notify
   * 
   * This endpoint receives transaction status notifications from 1LINK.
   * It should be configured as a webhook URL in your 1LINK merchant dashboard.
   * 
   * Note: This endpoint does NOT require authentication as it's called by 1LINK.
   * You may want to add IP whitelisting or signature verification for security.
   * 
   * Request Body:
   * {
   *   "info": {
   *     "rrn": "123456789012",
   *     "stan": "123456",
   *     "dateTime": "2025-01-12T10:00:00Z"
   *   },
   *   "messageInfo": {
   *     "merchantID": "MERCHANT001",
   *     "subDept": "Optional",
   *     "status": "ACCP"
   *   }
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Notification received and processed"
   * }
   */
  @Post('notify')
  @HttpCode(HttpStatus.OK)
  async notifyMerchant(@Body() dto: NotifyMerchantDto) {
    this.logger.log(`Received merchant notification: ${dto.messageInfo.merchantID}, status: ${dto.messageInfo.status}`);

    try {
      const result = await this.merchantService.handleNotifyMerchant(dto);
      return result;
    } catch (error) {
      this.logger.error(`Failed to process merchant notification: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to process notification');
    }
  }

  /**
   * Payment Notification (Webhook endpoint - called by 1LINK)
   * 
   * POST /api/payments/1link/merchant/payment-notification
   * 
   * This endpoint receives payment notifications from 1LINK for instant settlement.
   * It should be configured as a webhook URL in your 1LINK merchant dashboard.
   * 
   * Note: This endpoint does NOT require authentication as it's called by 1LINK.
   * You may want to add IP whitelisting or signature verification for security.
   * 
   * Request Body:
   * {
   *   "info": {
   *     "rrn": "123456789012",
   *     "stan": "123456",
   *     "dateTime": "2025-01-12T10:00:00Z"
   *   },
   *   "messageInfo": {
   *     "merchantID": "MERCHANT001",
   *     "subDept": "Optional",
   *     "status": "ACCP",
   *     "orginalInstructedAmount": "1000.00",
   *     "netAmount": "985.00"
   *   }
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Payment notification received and processed"
   * }
   */
  @Post('payment-notification')
  @HttpCode(HttpStatus.OK)
  async paymentNotification(@Body() dto: PaymentNotificationDto) {
    this.logger.log(`Received payment notification: ${dto.messageInfo.merchantID}, status: ${dto.messageInfo.status}`);

    try {
      const result = await this.merchantService.handlePaymentNotification(dto);
      return result;
    } catch (error) {
      this.logger.error(`Failed to process payment notification: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to process payment notification');
    }
  }
}

