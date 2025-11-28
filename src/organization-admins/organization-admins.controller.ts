import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { OrganizationAdminsService } from './organization-admins.service';
import { NotificationsService } from '../notifications/notifications.service';

@Controller('org/auth')
export class OrganizationAdminsController {
  constructor(
    private readonly orgAdminsService: OrganizationAdminsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: { email: string; password: string }) {
    return this.orgAdminsService.login(body.email, body.password);
  }

  @Patch('change-password/:adminId')
  changePassword(
    @Param('adminId') adminId: string,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.orgAdminsService.changePassword(adminId, body.currentPassword, body.newPassword);
  }

  @Post('register-web-push/:adminId')
  @HttpCode(HttpStatus.OK)
  async registerWebPush(
    @Param('adminId') adminId: string,
    @Body() body: { subscription: any },
  ) {
    const orgAdmin = await this.notificationsService.registerOrgAdminWebPush(adminId, body.subscription);
    return {
      success: true,
      message: 'Web push subscription registered successfully',
      adminId: orgAdmin.id,
    };
  }

  @Get('notifications/:adminId')
  async getNotifications(@Param('adminId') adminId: string) {
    const notifications = await this.notificationsService.getOrgAdminNotifications(adminId);
    return {
      success: true,
      data: notifications,
    };
  }
}


