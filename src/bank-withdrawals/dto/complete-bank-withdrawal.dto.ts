import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CompleteBankWithdrawalDto {
  @IsNotEmpty()
  @IsString()
  bankTransactionId: string; // Transaction ID from admin's bank app

  @IsOptional()
  @IsString()
  bankTransactionProofUrl?: string; // Optional: Admin can upload screenshot
}
