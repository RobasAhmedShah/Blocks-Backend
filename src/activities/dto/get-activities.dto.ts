import { IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum ActivityUserType {
  ALL = 'all',
  ADMIN = 'admin',
  ORG_ADMIN = 'org_admin',
  USER = 'user',
}

export class GetActivitiesDto {
  @IsOptional()
  @IsEnum(ActivityUserType)
  userType?: ActivityUserType;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

