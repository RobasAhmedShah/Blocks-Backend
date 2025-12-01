import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Logger } from '@nestjs/common';
import { AdminService } from './admin.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SendNotificationDto } from '../notifications/dto/send-notification.dto';

@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly adminService: AdminService,
    private readonly organizationsService: OrganizationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get('users')
  findAll(@Query('org') org?: string) {
    if (org) {
      return this.adminService.findInvestorsByOrganization(org);
    }
    return this.adminService.findAll();
  }

  @Post('users')
  create(@Body() data: any) {
    return this.adminService.create(data);
  }

  // Organizations management
  @Post('organizations')
  createOrganization(@Body() body: any) {
    return this.organizationsService.createWithAdmin(body);
  }

  // Send notifications to users
  @Post('notifications/send')
  async sendNotifications(@Body() dto: SendNotificationDto) {
    // Log received data for debugging
    this.logger.log('Received notification request:', {
      userIds: dto.userIds,
      userIdsType: typeof dto.userIds,
      isArray: Array.isArray(dto.userIds),
      title: dto.title,
      message: dto.message,
      category: dto.category,
    });

    // Ensure userIds is an array
    const userIdsArray = Array.isArray(dto.userIds) ? dto.userIds : (dto.userIds ? [dto.userIds] : []);

    if (userIdsArray.length === 0) {
      throw new Error('At least one user ID is required');
    }

    return this.notificationsService.sendNotificationsToUsers(
      userIdsArray,
      dto.title,
      dto.message,
      dto.category,
      dto.propertyId,
      dto.customUrl,
    );
  }

  @Get('organizations')
  listOrganizations() {
    return this.organizationsService.listWithAdmin();
  }

  @Get('notifications')
  async getBlocksAdminNotifications() {
    const notifications = await this.notificationsService.getBlocksAdminNotifications();
    return { success: true, notifications };
  }

  @Patch('organizations/:id')
  updateOrganization(@Param('id') id: string, @Body() body: any) {
    return this.organizationsService.updateAdminManaged(id, body);
  }

  @Delete('organizations/:id')
  deleteOrganization(@Param('id') id: string) {
    return this.organizationsService.deleteAdminManaged(id);
  }

  @Post('organizations/:id/reset-password')
  resetOrgAdminPassword(@Param('id') id: string, @Body() body: { newPassword?: string }) {
    return this.organizationsService.resetOrgAdminPassword(id, body?.newPassword);
  }
}


