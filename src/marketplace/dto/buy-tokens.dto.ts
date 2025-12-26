import { IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class BuyTokensDto {
  @IsNotEmpty()
  @IsUUID()
  listingId: string;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  tokensToBuy: number;
}

