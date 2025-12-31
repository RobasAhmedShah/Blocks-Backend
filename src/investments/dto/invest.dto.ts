import { IsString, IsNotEmpty, IsNumber, Min, IsOptional } from 'class-validator';

export class InvestDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsOptional()
  propertyId?: string; // Optional for backward compatibility

  @IsString()
  @IsOptional()
  propertyTokenId?: string; // NEW: Token tier ID (UUID or displayCode like "MBT")

  @IsNumber()
  @Min(0.000001)
  tokensToBuy: number;
}
