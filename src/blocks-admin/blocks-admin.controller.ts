import { Body, Controller, Get, Post, Param, Headers, UnauthorizedException } from '@nestjs/common';
import { BlocksAdminService } from './blocks-admin.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('blocks-admin')
export class BlocksAdminController {
  constructor(private readonly blocksAdminService: BlocksAdminService) {}

  @Post('signup')
  @Public()
  async signup(@Body() dto: SignupDto) {
    const admin = await this.blocksAdminService.signup(dto);
    return {
      success: true,
      data: admin,
      message: 'Admin account created successfully',
    };
  }

  @Post('login')
  @Public()
  async login(@Body() dto: LoginDto) {
    const result = await this.blocksAdminService.login(dto);
    return {
      success: true,
      data: result.admin,
      message: result.message,
    };
  }

  @Get('me')
  @Public()
  async getMe(@Headers('x-admin-id') adminId?: string) {
    if (!adminId) {
      throw new UnauthorizedException('Admin ID is required');
    }

    const admin = await this.blocksAdminService.getAdminById(adminId);
    return {
      success: true,
      data: admin,
    };
  }

  @Get()
  @Public()
  async getAllAdmins(@Headers('x-admin-id') adminId?: string) {
    if (!adminId) {
      throw new UnauthorizedException('Admin ID is required');
    }

    // Verify the requesting admin exists
    await this.blocksAdminService.getAdminById(adminId);

    const admins = await this.blocksAdminService.getAllAdmins();
    return {
      success: true,
      data: admins,
    };
  }
}
