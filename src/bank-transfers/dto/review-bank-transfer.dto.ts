import { IsNotEmpty, IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewBankTransferDto {
  @IsNotEmpty()
  @IsIn(['approved', 'rejected'], { message: 'Status must be either approved or rejected' })
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}


