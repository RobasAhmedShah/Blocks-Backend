import { Controller, Get, Patch, Post, Body, UseGuards, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { MobileProfileService } from './mobile-profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../mobile-auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../admin/entities/user.entity';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('api/mobile/profile')
@UseGuards(JwtAuthGuard)
export class MobileProfileController {
  constructor(
    private readonly mobileProfileService: MobileProfileService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get()
  async getProfile(@CurrentUser() user: User) {
    return this.mobileProfileService.getProfile(user.id);
  }

  @Patch()
  async updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.mobileProfileService.updateProfile(user.id, dto);
  }

  /**
   * Upload profile image
   * POST /api/mobile/profile/upload-image
   * Accepts JSON body with base64 file data (for React Native compatibility)
   * Body: { fileData: string (base64), fileName: string, mimeType: string }
   */
  @Post('upload-image')
  @HttpCode(HttpStatus.OK)
  async uploadProfileImage(
    @CurrentUser() user: User,
    @Body() body: { fileData: string; fileName: string; mimeType: string },
  ) {
    try {
      const { fileData, fileName, mimeType } = body;

      // Validate required fields
      if (!fileData) {
        throw new BadRequestException('No file data provided');
      }

      if (!mimeType || !mimeType.startsWith('image/')) {
        throw new BadRequestException('Invalid file type. Only images are allowed');
      }

      // Validate file type (images only)
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(mimeType)) {
        throw new BadRequestException('Only JPEG, PNG, and WebP images are allowed');
      }

      // Decode base64 to buffer
      let buffer: Buffer;
      try {
        // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
        const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
        buffer = Buffer.from(base64Data, 'base64');
      } catch (error) {
        throw new BadRequestException('Invalid base64 file data');
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (buffer.length > maxSize) {
        throw new BadRequestException('File size exceeds 5MB limit');
      }

      // Upload to Supabase
      const result = await this.supabaseService.uploadProfileImage(
        user.id,
        buffer,
        mimeType,
      );

      // Update user's profileImage in database
      await this.mobileProfileService.updateProfile(user.id, {
        profileImage: result.publicUrl,
      });

      return {
        success: true,
        message: 'Profile image uploaded successfully',
        url: result.publicUrl,
        path: result.path,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to upload profile image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

