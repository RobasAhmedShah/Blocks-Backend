import { IsString, IsNotEmpty, IsNumber, Min, IsOptional } from 'class-validator';

export class DistributeRoiDto {
  @IsString()
  @IsOptional()
  propertyId?: string; // Optional for backward compatibility (legacy property-level ROI)

  @IsString()
  @IsOptional()
  propertyTokenId?: string; // NEW: Token tier ID (UUID or displayCode like "MBT") for token-specific ROI

  @IsNumber()
  @Min(0.01)
  totalRoiUSDT: number;
}

