import { IsString, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';

export class UpdatePropertyTokenDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  tokenSymbol?: string; // Changing this requires checking global uniqueness

  @IsNumber()
  @IsOptional()
  @Min(0.000001)
  pricePerTokenUSDT?: number;

  @IsNumber()
  @IsOptional()
  @Min(0.000001)
  totalTokens?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  expectedROI?: number;

  @IsString()
  @IsOptional()
  apartmentType?: string;

  @IsOptional()
  apartmentFeatures?: any;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
