import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BankTransfersService } from './bank-transfers.service';
import { CreateBankTransferRequestDto } from './dto/create-bank-transfer-request.dto';
import { ReviewBankTransferDto } from './dto/review-bank-transfer.dto';
import { JwtAuthGuard } from '../mobile-auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../admin/entities/user.entity';
import { Public } from '../common/decorators/public.decorator';
import { Headers } from '@nestjs/common';

@Controller('api/mobile/bank-transfers')
export class BankTransfersController {
  private readonly logger = new Logger(BankTransfersController.name);

  constructor(private readonly bankTransfersService: BankTransfersService) {}

  /**
   * Get bank account details (public - users need this to make transfers)
   */
  @Get('bank-details')
  @Public()
  async getBankDetails() {
    const details = await this.bankTransfersService.getBankAccountDetails();
    return {
      success: true,
      data: details,
    };
  }

  /**
   * Create bank transfer request (mobile, JWT auth)
   * Accepts proofImageUrl as base64 data URL or Supabase URL
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async createRequest(
    @CurrentUser() user: User,
    @Body() dto: CreateBankTransferRequestDto,
  ) {
    const proofUrl = dto.proofImageUrl;

    // If proofImageUrl is a base64 data URL, upload it to Supabase first
    if (proofUrl && proofUrl.startsWith('data:image/')) {
      try {
        // Extract base64 data and content type
        const matches = proofUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
          throw new Error('Invalid base64 data URL format');
        }

        const [, contentType, base64Data] = matches;
        const fileBuffer = Buffer.from(base64Data, 'base64');

        // Create request first to get ID for file naming
        const tempRequest = await this.bankTransfersService.createRequest(user.id, {
          amountUSDT: dto.amountUSDT,
          proofImageUrl: '', // Temporary, will be updated below
        });

        // Upload proof to Supabase
        const uploadedUrl = await this.bankTransfersService.uploadProof(
          user.id,
          tempRequest.id,
          fileBuffer,
          `image/${contentType}`,
        );

        // Return the request with updated proof URL
        const updatedRequest = await this.bankTransfersService.getRequestById(tempRequest.id);
        return {
          success: true,
          data: updatedRequest,
          message: 'Bank transfer request created successfully',
        };
      } catch (error) {
        this.logger.error('Failed to upload base64 proof:', error);
        throw new Error(`Failed to upload proof image: ${error.message}`);
      }
    }

    // If proofImageUrl is already a URL, create request normally
    const request = await this.bankTransfersService.createRequest(user.id, dto);
    return {
      success: true,
      data: request,
      message: 'Bank transfer request created successfully',
    };
  }

  /**
   * Upload proof image (mobile, JWT auth)
   */
  @Post('upload-proof')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadProof(
    @CurrentUser() user: User,
    @Body('requestId') requestId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /(jpeg|jpg|png|webp)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!requestId) {
      throw new Error('requestId is required');
    }

    const imageUrl = await this.bankTransfersService.uploadProof(
      user.id,
      requestId,
      file.buffer,
      file.mimetype,
    );

    return {
      success: true,
      data: { imageUrl },
      message: 'Proof uploaded successfully',
    };
  }

  /**
   * Get user's bank transfer requests (mobile, JWT auth)
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserRequests(@CurrentUser() user: User) {
    const requests = await this.bankTransfersService.getUserRequests(user.id);
    return {
      success: true,
      data: requests,
    };
  }

  /**
   * Get single request by ID (mobile, JWT auth)
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getRequest(@Param('id') id: string, @CurrentUser() user: User) {
    const request = await this.bankTransfersService.getRequestById(id);

    // Verify user owns this request (unless admin)
    if (request.userId !== user.id) {
      throw new Error('Unauthorized: You can only view your own requests');
    }

    return {
      success: true,
      data: request,
    };
  }

  /**
   * Get signed URL for proof image (mobile, JWT auth)
   */
  @Get(':id/proof-url')
  @UseGuards(JwtAuthGuard)
  async getProofUrl(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Query('expiresIn') expiresIn?: string,
  ) {
    const request = await this.bankTransfersService.getRequestById(id);

    // Verify user owns this request
    if (request.userId !== user.id) {
      throw new Error('Unauthorized: You can only view your own requests');
    }

    if (!request.proofImageUrl) {
      throw new Error('Proof image not found');
    }

    const signedUrl = await this.bankTransfersService.getProofSignedUrl(
      request.proofImageUrl,
      expiresIn ? parseInt(expiresIn) : 3600,
    );

    return {
      success: true,
      data: { signedUrl },
    };
  }
}

/**
 * Admin endpoints for reviewing bank transfer requests
 */
@Controller('admin/bank-transfers')
export class AdminBankTransfersController {
  private readonly logger = new Logger(AdminBankTransfersController.name);

  constructor(private readonly bankTransfersService: BankTransfersService) {
    this.logger.log('AdminBankTransfersController initialized');
  }

  /**
   * Test endpoint to verify route registration
   */
  @Get('test')
  @Public()
  testRoute() {
    return {
      success: true,
      message: 'Admin bank transfers route is working',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get all bank transfer requests (admin)
   */
  @Get()
  async getAllRequests(
    @Query('status') status?: 'pending' | 'approved' | 'rejected',
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const requests = await this.bankTransfersService.getAllRequests({
      status,
      userId,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    return {
      success: true,
      data: requests,
      count: requests.length,
    };
  }

  /**
   * Review (approve/reject) bank transfer request (admin)
   * Works without JWT/session - just requires adminId in body or header
   * Can be called from Postman/curl directly
   * IMPORTANT: This route must come BEFORE @Get(':id') to avoid route conflicts
   */
  @Patch(':id/review')
  @Public() // No JWT required - works with just adminId
  async reviewRequest(
    @Param('id') id: string,
    @Body() body: ReviewBankTransferDto & { adminId?: string },
    @Headers('x-admin-id') adminIdHeader?: string,
  ) {
    this.logger.log(`Review request called: id=${id}, adminId=${adminIdHeader || body.adminId}, status=${body.status}`);
    
    // Get admin ID from header or body (similar to property-requests)
    const adminId = adminIdHeader || body.adminId;
    
    if (!adminId) {
      this.logger.error('adminId is missing in request');
      throw new Error('adminId is required (in header x-admin-id or request body)');
    }

    // Extract DTO without adminId
    const dto: ReviewBankTransferDto = {
      status: body.status,
      rejectionReason: body.rejectionReason,
    };

    if (!dto.status) {
      this.logger.error('status is missing in request body');
      throw new Error('status is required in request body (approved or rejected)');
    }

    try {
      const request = await this.bankTransfersService.reviewRequest(id, adminId, dto);
      this.logger.log(`Request ${id} ${dto.status} successfully by admin ${adminId}`);

      return {
        success: true,
        data: request,
        message: `Request ${dto.status} successfully`,
      };
    } catch (error) {
      this.logger.error(`Error reviewing request ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get signed URL for proof image (admin)
   * IMPORTANT: This route must come AFTER @Patch(':id/review') to avoid route conflicts
   */
  @Get(':id/proof-url')
  async getProofUrl(
    @Param('id') id: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    const request = await this.bankTransfersService.getRequestById(id);

    if (!request.proofImageUrl) {
      throw new Error('Proof image not found');
    }

    // If it's a base64 data URL, return it as-is
    if (request.proofImageUrl.startsWith('data:image/')) {
      return {
        success: true,
        data: { signedUrl: request.proofImageUrl },
      };
    }

    try {
      const signedUrl = await this.bankTransfersService.getProofSignedUrl(
        request.proofImageUrl,
        expiresIn ? parseInt(expiresIn) : 3600,
      );

      return {
        success: true,
        data: { signedUrl },
      };
    } catch (error) {
      this.logger.error(`Failed to get signed URL for request ${id}:`, error);
      // If signed URL generation fails, return the original URL (might be public)
      return {
        success: true,
        data: { signedUrl: request.proofImageUrl },
      };
    }
  }

  /**
   * Get single request by ID (admin)
   * IMPORTANT: This catch-all route must come LAST to avoid route conflicts
   */
  @Get(':id')
  async getRequest(@Param('id') id: string) {
    const request = await this.bankTransfersService.getRequestById(id);
    return {
      success: true,
      data: request,
    };
  }
}


