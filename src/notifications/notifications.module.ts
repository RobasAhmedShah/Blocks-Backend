import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { User } from '../admin/entities/user.entity';
import { OrganizationAdmin } from '../organization-admins/entities/organization-admin.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User, OrganizationAdmin]),
    ConfigModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
