import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdatePropertyRequestStatusDto {
  @IsEnum(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}

