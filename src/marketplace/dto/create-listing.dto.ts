import { IsNotEmpty, IsNumber, IsPositive, IsUUID, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateListingDto {
  @IsNotEmpty()
  @IsUUID()
  propertyId: string;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  pricePerToken: number;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  totalTokens: number;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  minOrderUSDT: number;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  @ValidateIf((o) => o.maxOrderUSDT >= o.minOrderUSDT)
  maxOrderUSDT: number;
}

