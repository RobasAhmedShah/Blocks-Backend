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
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../mobile-auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../admin/entities/user.entity';
import { OneLinkQrService } from './onelink-qr.service';
import { OneLinkP2MQrService } from './onelink-p2m-qr.service';
import { GenerateQrDto, GenerateQrResponseDto } from './dto/generate-qr.dto';
import { GenerateP2MQrSimpleDto, GenerateP2MQrResponseDto } from './dto/p2m-qr.dto';

@Controller('api/payments/1link')
@UseGuards(JwtAuthGuard)
export class OneLinkPaymentsController {
  private readonly logger = new Logger(OneLinkPaymentsController.name);

  constructor(
    private readonly qrService: OneLinkQrService,
    private readonly p2mQrService: OneLinkP2MQrService,
  ) {}

  /**
   * Generate a 1LINK 1QR code for wallet deposit
   * 
   * This endpoint is ACTIVE and ready to use.
   * 
   * POST /api/payments/1link/1qr
   * 
   * Request Body (Simple payload - complex 1LINK payload is built internally):
   * {
   *   "amountPkr": 2500,              // Required: Amount in PKR (1-500,000)
   *   "userId": "user-uuid-here",     // Optional: Uses authenticated user if not provided
   *   "purpose": "Wallet Top Up"      // Optional: Purpose of transaction
   * }
   * 
   * Response:
   * {
   *   "depositId": "DEP-1234567890-abc123",
   *   "referenceId": "REF-1234567890-xyz",
   *   "amountPkr": "2500",
   *   "qrCodeBase64": "<BASE64_PNG_STRING>",
   *   "qrCodeDataUri": "data:image/png;base64,<BASE64_PNG_STRING>",
   *   "currency": "PKR"
   * }
   * 
   * Note: The service internally builds the full 1LINK payload structure with:
   * - InitiationMethod, MerchantAccountInformation, MCC, CurrencyCode, etc.
   * - All fields are configured via environment variables
   * - See docs/ONELINK_1QR_INTEGRATION.md for full payload structure
   */
  @Post('1qr')
  @HttpCode(HttpStatus.OK)
  async generateQr(
    @CurrentUser() user: User,
    @Body() dto: Partial<GenerateQrDto>,
  ): Promise<GenerateQrResponseDto> {
    // Use authenticated user ID if not provided
    const userId = dto.userId || user?.id;
    
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    
    if (!dto.amountPkr) {
      throw new BadRequestException('Amount in PKR is required');
    }
    
    // Validate amount
    if (dto.amountPkr < 1) {
      throw new BadRequestException('Amount must be at least 1 PKR');
    }
    
    if (dto.amountPkr > 500000) {
      throw new BadRequestException('Amount cannot exceed 500,000 PKR');
    }

    this.logger.log(`Generating 1LINK QR for user ${userId}, amount: ${dto.amountPkr} PKR`);

    try {
      const result = await this.qrService.generateQr({
        amountPkr: dto.amountPkr,
        userId,
        purpose: dto.purpose,
      } as GenerateQrDto);

      this.logger.log(`1LINK QR generated successfully: ${result.depositId}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to generate 1LINK QR: ${error.message}`, error.stack);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      // Check for authentication errors
      if (error.message?.includes('authentication') || error.message?.includes('OAuth')) {
        throw new InternalServerErrorException('Authentication with payment provider failed');
      }
      
      throw new InternalServerErrorException(
        'Failed to generate QR code. Please try again later.'
      );
    }
  }

  /**
   * Debug endpoint to verify QR payload structure and configuration
   * 
   * GET /api/payments/1link/1qr/debug?amount=100
   * 
   * This endpoint helps identify issues with:
   * - Account number format
   * - Payload structure
   * - Environment variable configuration
   * - Validation issues
   * 
   * Response includes:
   * - Complete payload that would be sent to 1LINK
   * - Environment configuration values
   * - Validation results and issues
   * - Recommendations for fixes
   */
  @Get('1qr/debug')
  @HttpCode(HttpStatus.OK)
  async debugQrPayload(
    @CurrentUser() user: User,
    @Query('amount') amount?: string,
  ) {
    const testAmount = amount ? parseFloat(amount) : 100;
    
    if (isNaN(testAmount) || testAmount < 1) {
      throw new BadRequestException('Amount must be a valid number >= 1');
    }

    this.logger.log(`Debug QR payload requested by user ${user.id}, test amount: ${testAmount} PKR`);

    try {
      const debugInfo = this.qrService.getDebugInfo(testAmount);
      
      return {
        success: true,
        message: 'QR payload debug information',
        testAmount: testAmount,
        ...debugInfo,
        note: 'This shows what payload would be sent to 1LINK API. Check validation.issues for problems.',
      };
    } catch (error) {
      this.logger.error(`Failed to get debug info: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to generate debug information');
    }
  }

  /**
   * Generate a P2M (Person-to-Merchant) Dynamic QR code
   * 
   * POST /api/payments/1link/p2m/qr
   * 
   * This endpoint generates a dynamic P2M QR code for merchant payments.
   * Requires a merchant profile to be created first.
   * 
   * Request Body:
   * {
   *   "merchantID": "MERCHANT001",        // Required: Merchant ID from merchant profile
   *   "amountPkr": 2500,                  // Required: Amount in PKR (1-500,000)
   *   "referenceId": "ORDER-12345",       // Optional: Order/invoice reference
   *   "purpose": "Payment for Order",     // Optional: Purpose of payment
   *   "transactionType": "PURCHASE",      // Optional: Transaction type (default: "PURCHASE")
   *   "expiryMinutes": 30,                // Optional: QR expiry in minutes (default: 30)
   *   "subDept": "0001",                  // Optional: Terminal ID (default: "0001")
   *   "loyaltyNo": "LOYALTY123",          // Optional: Loyalty number
   *   "customerLabel": "VIP Customer"     // Optional: Customer label
   * }
   * 
   * Response:
   * {
   *   "qrCodeId": "P2M-1234567890-abc123",
   *   "merchantID": "MERCHANT001",
   *   "referenceId": "ORDER-12345",
   *   "amountPkr": "2500",
   *   "qrCodeBase64": "<BASE64_PNG_STRING>",
   *   "qrCodeDataUri": "data:image/png;base64,<BASE64_PNG_STRING>",
   *   "qrData": "<QR_DATA_STRING>",
   *   "expiryDateTime": "2025-01-12T10:30:00",
   *   "currency": "PKR",
   *   "stan": "123456",
   *   "rrn": "250112123456"
   * }
   */
  @Post('p2m/qr')
  @HttpCode(HttpStatus.OK)
  async generateP2MQr(
    @CurrentUser() user: User,
    @Body() dto: GenerateP2MQrSimpleDto,
  ): Promise<GenerateP2MQrResponseDto> {
    if (!dto.merchantID) {
      throw new BadRequestException('merchantID is required');
    }
    
    if (!dto.amountPkr) {
      throw new BadRequestException('amountPkr is required');
    }
    
    // Validate amount
    if (dto.amountPkr < 1) {
      throw new BadRequestException('Amount must be at least 1 PKR');
    }
    
    if (dto.amountPkr > 500000) {
      throw new BadRequestException('Amount cannot exceed 500,000 PKR');
    }

    this.logger.log(`Generating P2M QR for merchant ${dto.merchantID}, amount: ${dto.amountPkr} PKR by user ${user.id}`);

    try {
      const result = await this.p2mQrService.generateP2MQrMerchant(dto);

      this.logger.log(`P2M QR generated successfully: ${result.qrCodeId}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to generate P2M QR: ${error.message}`, error.stack);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      // Check for authentication errors
      if (error.message?.includes('authentication') || error.message?.includes('OAuth')) {
        throw new InternalServerErrorException('Authentication with payment provider failed');
      }
      
      throw new InternalServerErrorException(
        'Failed to generate P2M QR code. Please try again later.'
      );
    }
  }

  /**
   * Generate a P2M (Person-to-Merchant) Dynamic QR code - Aggregator Mode
   * 
   * POST /api/payments/1link/p2m/qr/aggregator
   * 
   * This endpoint generates a dynamic P2M QR code using aggregator mode.
   * Requires less merchant details (only merchantID and subDept).
   * 
   * Request Body: Same as /p2m/qr
   * Response: Same as /p2m/qr
   */
  @Post('p2m/qr/aggregator')
  @HttpCode(HttpStatus.OK)
  async generateP2MQrAggregator(
    @CurrentUser() user: User,
    @Body() dto: GenerateP2MQrSimpleDto,
  ): Promise<GenerateP2MQrResponseDto> {
    if (!dto.merchantID) {
      throw new BadRequestException('merchantID is required');
    }
    
    if (!dto.amountPkr) {
      throw new BadRequestException('amountPkr is required');
    }
    
    // Validate amount
    if (dto.amountPkr < 1) {
      throw new BadRequestException('Amount must be at least 1 PKR');
    }
    
    if (dto.amountPkr > 500000) {
      throw new BadRequestException('Amount cannot exceed 500,000 PKR');
    }

    this.logger.log(`Generating P2M QR (Aggregator) for merchant ${dto.merchantID}, amount: ${dto.amountPkr} PKR by user ${user.id}`);

    try {
      const result = await this.p2mQrService.generateP2MQrAggregator(dto);

      this.logger.log(`P2M QR (Aggregator) generated successfully: ${result.qrCodeId}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to generate P2M QR (Aggregator): ${error.message}`, error.stack);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      // Check for authentication errors
      if (error.message?.includes('authentication') || error.message?.includes('OAuth')) {
        throw new InternalServerErrorException('Authentication with payment provider failed');
      }
      
      throw new InternalServerErrorException(
        'Failed to generate P2M QR code. Please try again later.'
      );
    }
  }
}

