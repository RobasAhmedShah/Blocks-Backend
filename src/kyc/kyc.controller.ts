import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Body, 
  Param, 
  Query, 
  HttpCode, 
  HttpStatus,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { KycService } from './kyc.service';
import { CreateKycDto } from './dto/create-kyc.dto';
import { UpdateKycDto } from './dto/update-kyc.dto';
import { UploadKycDocumentDto } from './dto/upload-kyc-document.dto';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('kyc')
export class KycController {
  constructor(
    private readonly kycService: KycService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createKycDto: CreateKycDto) {
    return this.kycService.create(createKycDto);
  }

  @Get()
  findAll() {
    return this.kycService.findAll();
  }

  @Get('user/:userId')
  findByUserId(@Param('userId') userId: string) {
    return this.kycService.findByUserId(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.kycService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateKycDto: UpdateKycDto) {
    return this.kycService.update(id, updateKycDto);
  }

  /**
   * Upload KYC document (front, back, or selfie)
   * POST /kyc/upload-document
   * Using Fastify's native multipart handling
   */
  @Post('upload-document')
  @HttpCode(HttpStatus.OK)
  async uploadDocument(
    @Req() request: FastifyRequest,
    @Body() dto: UploadKycDocumentDto,
  ) {
    try {
      if (!request.isMultipart()) {
        throw new BadRequestException('Request is not multipart/form-data');
      }

      const data = await request.file();
      
      if (!data) {
        throw new BadRequestException('No file uploaded');
      }

      // Read file buffer
      const buffer = await data.toBuffer();

      // Validate file type (images only)
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!data.mimetype || !allowedMimeTypes.includes(data.mimetype)) {
        throw new BadRequestException('Only JPEG and PNG images are allowed');
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (buffer.length > maxSize) {
        throw new BadRequestException('File size exceeds 5MB limit');
      }

      // Get userId from DTO (for non-authenticated uploads)
      if (!dto.userId) {
        throw new BadRequestException('userId is required');
      }

      // Upload to Supabase
      const result = await this.supabaseService.uploadKycDocument(
        dto.userId,
        buffer,
        dto.documentType,
        data.mimetype,
      );

      return {
        success: true,
        message: 'Document uploaded successfully',
        documentType: dto.documentType,
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
   * Get signed URL for KYC document (for viewing)
   * GET /kyc/documents/:path/signed-url
   */
  @Get('documents/:path/signed-url')
  async getSignedUrl(@Param('path') path: string) {
    const signedUrl = await this.supabaseService.getKycDocumentSignedUrl(
      decodeURIComponent(path),
    );
    return { signedUrl };
  }
}


