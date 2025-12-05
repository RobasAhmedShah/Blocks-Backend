import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { Activity } from './entities/activity.entity';
import { Property } from '../properties/entities/property.entity';
import { User } from '../admin/entities/user.entity';
import { ActivityLoggingInterceptor } from './interceptors/activity-logging.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([Activity, Property, User])],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, ActivityLoggingInterceptor],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}

