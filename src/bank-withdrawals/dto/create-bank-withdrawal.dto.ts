import { IsNotEmpty, IsNumber, Min, IsString, IsOptional } from 'class-validator';

export class CreateBankWithdrawalDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01, { message: 'Amount must be at least 0.01 USDT' })
  amountUSDT: number;

  // User's Bank Account Details (where they want to receive money)
  @IsNotEmpty()
  @IsString()
  userBankAccountName: string;

  @IsNotEmpty()
  @IsString()
  userBankAccountNumber: string;

  @IsOptional()
  @IsString()
  userBankIban?: string;

  @IsNotEmpty()
  @IsString()
  userBankName: string;

  @IsOptional()
  @IsString()
  userBankSwiftCode?: string;

  @IsOptional()
  @IsString()
  userBankBranch?: string;
}


