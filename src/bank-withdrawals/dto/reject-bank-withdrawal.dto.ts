import { IsNotEmpty, IsString } from 'class-validator';

export class RejectBankWithdrawalDto {
  @IsNotEmpty()
  @IsString()
  rejectionReason: string;
}


