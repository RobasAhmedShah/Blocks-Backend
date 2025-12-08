import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../mobile-auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { KycService } from '../kyc/kyc.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateKycDto } from '../kyc/dto/create-kyc.dto';
import { User } from '../admin/entities/user.entity';

@Controller('api/mobile/kyc')
@UseGuards(JwtAuthGuard) // All endpoints require authentication
export class MobileKycController {
  constructor(
    private readonly kycService: KycService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Get current user's KYC status
   * GET /api/mobile/kyc/status
   */
  @Get('status')
  async getStatus(@CurrentUser() user: User) {
    const kyc = await this.kycService.findByUserId(user.id);
    
    if (!kyc) {
      return {
        status: 'not_submitted',
        message: 'No KYC submission found',
      };
    }

    return {
      id: kyc.id,
      type: kyc.type,
      status: kyc.status,
      submittedAt: kyc.submittedAt,
      reviewedAt: kyc.reviewedAt,
      rejectionReason: kyc.rejectionReason,
      hasDocuments: {
        front: !!kyc.documentFrontUrl,
        back: !!kyc.documentBackUrl,
        selfie: !!kyc.selfieUrl,
      },
    };
  }

  /**
   * Upload KYC document
   * POST /api/mobile/kyc/upload-document
   * Accepts JSON body with base64 file data (for React Native compatibility)
   * Body: { fileData: string (base64), fileName: string, mimeType: string, documentType: 'front' | 'back' | 'selfie' }
   */
  @Post('upload-document')
  @HttpCode(HttpStatus.OK)
  async uploadDocument(
    @CurrentUser() user: User,
    @Body() body: { fileData: string; fileName: string; mimeType: string; documentType: 'front' | 'back' | 'selfie' },
  ) {
    try {
      const { fileData, fileName, mimeType, documentType } = body;

      // Validate required fields
      if (!fileData) {
        throw new BadRequestException('No file data provided');
      }

      if (!documentType || !['front', 'back', 'selfie'].includes(documentType)) {
        throw new BadRequestException('Invalid or missing documentType. Must be: front, back, or selfie');
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!mimeType || !allowedTypes.includes(mimeType)) {
        throw new BadRequestException('Only JPEG and PNG images allowed');
      }

      // Decode base64 to buffer
      let buffer: Buffer;
      try {
        // Remove data URI prefix if present (data:image/png;base64,)
        const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
        buffer = Buffer.from(base64Data, 'base64');
      } catch (decodeError) {
        throw new BadRequestException('Invalid base64 file data');
      }

      // Validate file size (max 5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        throw new BadRequestException('File size exceeds 5MB');
      }

      if (buffer.length === 0) {
        throw new BadRequestException('File data is empty');
      }

      // Upload to Supabase
      const result = await this.supabaseService.uploadKycDocument(
        user.id,
        buffer,
        documentType,
        mimeType,
      );

      return {
        success: true,
        documentType,
        url: result.publicUrl,
        path: result.path,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to upload document: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Submit KYC verification
   * POST /api/mobile/kyc/submit
   */
  @Post('submit')
  @HttpCode(HttpStatus.CREATED)
  async submitKyc(
    @CurrentUser() user: User,
    @Body() dto: Omit<CreateKycDto, 'userId'>, // userId comes from JWT
  ) {
    // Add userId from JWT token
    const createDto: CreateKycDto = {
      ...dto,
      userId: user.id,
    };

    const kyc = await this.kycService.create(createDto);

    return {
      success: true,
      message: 'KYC submitted successfully',
      kyc: {
        id: kyc.id,
        type: kyc.type,
        status: kyc.status,
        submittedAt: kyc.submittedAt,
      },
    };
  }

  /**
   * Get KYC verification details
   * GET /api/mobile/kyc
   */
  @Get()
  async getKyc(@CurrentUser() user: User) {
    const kyc = await this.kycService.findByUserId(user.id);
    
    if (!kyc) {
      return null;
    }

    // Return document URLs (public URLs or signed URLs if private bucket)
    const documents = {
      front: kyc.documentFrontUrl,
      back: kyc.documentBackUrl,
      selfie: kyc.selfieUrl,
    };

    return {
      id: kyc.id,
      type: kyc.type,
      status: kyc.status,
      documents,
      reviewer: kyc.reviewer,
      rejectionReason: kyc.rejectionReason,
      submittedAt: kyc.submittedAt,
      reviewedAt: kyc.reviewedAt,
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
    };
  }
}

