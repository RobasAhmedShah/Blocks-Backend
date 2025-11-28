import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationAdmin } from './entities/organization-admin.entity';
import { OrganizationAdminsService } from './organization-admins.service';
import { OrganizationAdminsController } from './organization-admins.controller';
import { Organization } from '../organizations/entities/organization.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrganizationAdmin, Organization]),
    NotificationsModule,
  ],
  controllers: [OrganizationAdminsController],
  providers: [OrganizationAdminsService],
  exports: [OrganizationAdminsService],
})
export class OrganizationAdminsModule {}


