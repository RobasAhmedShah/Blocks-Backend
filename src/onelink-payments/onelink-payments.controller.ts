import { 
  Controller, 
  Post, 
  Body, 
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
import { OneLinkQrService } from './onelink-qr.service';
import { GenerateQrDto, GenerateQrResponseDto } from './dto/generate-qr.dto';

@Controller('api/payments/1link')
@UseGuards(JwtAuthGuard)
export class OneLinkPaymentsController {
  private readonly logger = new Logger(OneLinkPaymentsController.name);

  constructor(private readonly qrService: OneLinkQrService) {}

  /**
   * Generate a 1LINK 1QR code for wallet deposit
   * 
   * POST /api/payments/1link/1qr
   * 
   * Request Body:
   * {
   *   "amountPkr": 2500,
   *   "userId": "user-uuid-here"  // Optional if using JWT auth
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
}

