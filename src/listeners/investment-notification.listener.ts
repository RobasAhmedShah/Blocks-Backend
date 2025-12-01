import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { InvestmentCompletedEvent } from '../events/investment.events';
import { NotificationsService } from '../notifications/notifications.service';
import { OrganizationAdmin } from '../organization-admins/entities/organization-admin.entity';
import { Property } from '../properties/entities/property.entity';
import { User } from '../admin/entities/user.entity';

@Injectable()
export class InvestmentNotificationListener {
  private readonly logger = new Logger(InvestmentNotificationListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    @InjectRepository(OrganizationAdmin)
    private readonly orgAdminRepo: Repository<OrganizationAdmin>,
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Handle investment completed event - send notifications to org admin and Blocks admin
   */
  @OnEvent('investment.completed', { async: true })
  async handleInvestmentCompleted(event: InvestmentCompletedEvent) {
    try {
      this.logger.log(
        `[InvestmentNotificationListener] 📨 Event received! Processing investment notification for investment: ${event.investmentDisplayCode}, user: ${event.userDisplayCode}, property: ${event.propertyDisplayCode}`,
      );

      // Fetch property to get property title
      const property = await this.propertyRepo.findOne({
        where: { id: event.propertyId },
        select: ['id', 'title', 'displayCode', 'organizationId'],
      });

      if (!property) {
        this.logger.warn(`[InvestmentNotificationListener] Property ${event.propertyId} not found`);
        return;
      }

      // Fetch user to get user name
      const user = await this.userRepo.findOne({
        where: { id: event.userId },
        select: ['id', 'fullName', 'displayCode', 'email'],
      });

      const userName = user?.fullName || user?.displayCode || 'A user';
      const propertyName = property.title || property.displayCode;
      const tokensPurchased = event.tokensPurchased.toString();
      const amountUSDT = event.amountUSDT.toString();

      // 1. Send notification to Organization Admin
      try {
        const orgAdmin = await this.orgAdminRepo.findOne({
          where: { organizationId: event.organizationId, isActive: true },
          select: ['id', 'organizationId', 'email', 'fullName', 'isActive'],
        });

        if (orgAdmin) {
          const orgAdminTitle = `New Token Purchase - ${propertyName}`;
          const orgAdminMessage = `${userName} purchased ${tokensPurchased} tokens (${amountUSDT} USDT) in ${propertyName}`;

          const orgAdminData = {
            type: 'token_purchase',
            url: `/org/properties/${property.id}`,
            propertyId: property.id,
            propertyDisplayCode: property.displayCode,
            userId: event.userId,
            userDisplayCode: event.userDisplayCode,
            tokensPurchased: tokensPurchased,
            amountUSDT: amountUSDT,
            investmentId: event.investmentId,
            investmentDisplayCode: event.investmentDisplayCode,
          };

          await this.notificationsService.sendNotificationToOrgAdmin(
            orgAdmin.id,
            orgAdminTitle,
            orgAdminMessage,
            orgAdminData,
          );

          this.logger.log(
            `[InvestmentNotificationListener] ✅ Notification sent to organization admin for ${event.organizationDisplayCode}`,
          );
        } else {
          this.logger.warn(
            `[InvestmentNotificationListener] ⚠️ No active organization admin found for organization ${event.organizationDisplayCode}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `[InvestmentNotificationListener] ❌ Failed to send notification to organization admin:`,
          error,
        );
        // Don't throw - continue with Blocks admin notification
      }

      // 2. Send notification to Blocks Admin (Super Admin)
      try {
        const blocksAdminTitle = `New Token Purchase - ${propertyName}`;
        const blocksAdminMessage = `${userName} purchased ${tokensPurchased} tokens (${amountUSDT} USDT) in ${propertyName} (${event.organizationDisplayCode})`;

        const blocksAdminData = {
          type: 'token_purchase',
          url: `/admin/properties/${property.id}`,
          propertyId: property.id,
          propertyDisplayCode: property.displayCode,
          organizationId: event.organizationId,
          organizationDisplayCode: event.organizationDisplayCode,
          userId: event.userId,
          userDisplayCode: event.userDisplayCode,
          tokensPurchased: tokensPurchased,
          amountUSDT: amountUSDT,
          investmentId: event.investmentId,
          investmentDisplayCode: event.investmentDisplayCode,
        };

        await this.notificationsService.sendNotificationToBlocksAdmin(
          blocksAdminTitle,
          blocksAdminMessage,
          blocksAdminData,
        );

        this.logger.log(
          `[InvestmentNotificationListener] ✅ Notification sent to Blocks admin`,
        );
      } catch (error) {
        this.logger.error(
          `[InvestmentNotificationListener] ❌ Failed to send notification to Blocks admin:`,
          error,
        );
        // Don't throw - notification failure shouldn't break the system
      }
    } catch (error) {
      this.logger.error(
        `[InvestmentNotificationListener] ❌ Error processing investment notification:`,
        error,
      );
      // Don't throw - notification failure shouldn't break the investment flow
    }
  }
}

