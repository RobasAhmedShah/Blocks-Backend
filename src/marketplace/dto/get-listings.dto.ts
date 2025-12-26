import { IsOptional, IsUUID, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum ListingSortBy {
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  CREATED_AT_DESC = 'created_at_desc',
  CREATED_AT_ASC = 'created_at_asc',
  ROI_DESC = 'roi_desc',
}

export class GetListingsDto {
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @IsOptional()
  @IsEnum(ListingSortBy)
  sortBy?: ListingSortBy;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}

