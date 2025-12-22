import { IsNotEmpty, IsNumber, Min, IsString, IsOptional } from 'class-validator';

export class CreateBankTransferRequestDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01, { message: 'Amount must be at least 0.01 USDT' })
  amountUSDT: number;

  @IsNotEmpty()
  @IsString()
  proofImageUrl: string; // Base64 data URL or Supabase URL from mobile upload
}


