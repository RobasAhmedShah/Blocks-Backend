import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';

export class CreatePropertyTokenDto {
  @IsString()
  @IsNotEmpty()
  propertyId: string; // UUID or displayCode

  @IsString()
  @IsNotEmpty()
  name: string; // e.g., "Bronze Token", "Gold Token"

  @IsString()
  @IsNotEmpty()
  color: string; // Hex color code (e.g., "#CD7F32")

  @IsString()
  @IsNotEmpty()
  tokenSymbol: string; // e.g., "MBT", "MGT", "MPT" - must be globally unique

  @IsNumber()
  @Min(0.000001)
  pricePerTokenUSDT: number;

  @IsNumber()
  @Min(0.000001)
  totalTokens: number;

  @IsNumber()
  @Min(0)
  expectedROI: number;

  @IsString()
  @IsOptional()
  apartmentType?: string; // e.g., "Studio", "1BR", "2BR"

  @IsOptional()
  apartmentFeatures?: any; // JSONB: { bedrooms, bathrooms, area_sqm, amenities }

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
