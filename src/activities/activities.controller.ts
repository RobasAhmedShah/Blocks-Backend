import { Controller, Get, Query, Delete } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { GetActivitiesDto } from './dto/get-activities.dto';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  async getActivities(@Query() dto: GetActivitiesDto) {
    return await this.activitiesService.getActivities(dto);
  }

  @Get('count')
  async getActivityCount(@Query('userType') userType?: string) {
    const count = await this.activitiesService.getActivityCount(userType as any);
    return { count };
  }

  @Delete()
  async deleteAllActivities() {
    const result = await this.activitiesService.deleteAllActivities();
    return { 
      success: true, 
      message: `Deleted ${result.deleted} activities`,
      deleted: result.deleted 
    };
  }
}

