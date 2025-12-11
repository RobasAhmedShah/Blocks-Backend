import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum } from 'class-validator';

export class CreatePropertyRequestDto {
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['residential', 'commercial', 'mixed'])
  type: 'residential' | 'commercial' | 'mixed';

  @IsEnum(['planning', 'construction', 'active', 'onhold', 'soldout', 'completed'])
  @IsOptional()
  propertyStatus?: 'planning' | 'construction' | 'active' | 'onhold' | 'soldout' | 'completed';

  @IsNumber()
  totalValueUSDT: number;

  @IsNumber()
  totalTokens: number;

  @IsNumber()
  expectedROI: number;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsOptional()
  features?: any;

  @IsOptional()
  images?: any;

  @IsOptional()
  documents?: any;
}

