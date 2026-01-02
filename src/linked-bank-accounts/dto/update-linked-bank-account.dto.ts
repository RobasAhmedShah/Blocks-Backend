import { IsOptional, IsString, IsBoolean, MaxLength, MinLength } from 'class-validator';

export class UpdateLinkedBankAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  accountHolderName?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(100)
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  iban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  swiftCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  branch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  accountType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  status?: 'pending' | 'verified' | 'disabled';

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
