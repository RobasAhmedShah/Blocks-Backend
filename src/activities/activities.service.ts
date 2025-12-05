import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Activity } from './entities/activity.entity';
import { GetActivitiesDto, ActivityUserType } from './dto/get-activities.dto';

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
  ) {}

  async createActivity(activityData: Partial<Activity>): Promise<Activity> {
    try {
      const activity = this.activityRepository.create(activityData);
      return await this.activityRepository.save(activity);
    } catch (error) {
      this.logger.error(`Failed to create activity: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getActivities(dto: GetActivitiesDto) {
    const { userType, userId, endpoint, method, limit = 50, offset = 0 } = dto;

    const queryBuilder = this.activityRepository.createQueryBuilder('activity')
      .leftJoinAndSelect('activity.user', 'user')
      .leftJoinAndSelect('activity.orgAdmin', 'orgAdmin')
      .orderBy('activity.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    // Filter by user type
    if (userType && userType !== ActivityUserType.ALL) {
      queryBuilder.andWhere('activity.userType = :userType', { userType });
    }

    // Filter by userId
    if (userId) {
      queryBuilder.andWhere('activity.userId = :userId', { userId });
    }

    // Filter by endpoint
    if (endpoint) {
      queryBuilder.andWhere('activity.endpoint LIKE :endpoint', { endpoint: `%${endpoint}%` });
    }

    // Filter by method
    if (method) {
      queryBuilder.andWhere('activity.method = :method', { method });
    }

    const [activities, total] = await queryBuilder.getManyAndCount();

    return {
      activities,
      total,
      limit,
      offset,
    };
  }

  async getActivityCount(userType?: ActivityUserType) {
    const queryBuilder = this.activityRepository.createQueryBuilder('activity');

    if (userType && userType !== ActivityUserType.ALL) {
      queryBuilder.where('activity.userType = :userType', { userType });
    }

    return await queryBuilder.getCount();
  }

  async deleteAllActivities(): Promise<{ deleted: number }> {
    // Use query builder to delete all records (TypeORM doesn't allow delete({}))
    const result = await this.activityRepository
      .createQueryBuilder()
      .delete()
      .from(Activity)
      .execute();
    return { deleted: result.affected || 0 };
  }
}

