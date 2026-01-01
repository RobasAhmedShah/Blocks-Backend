import { IsNotEmpty, IsString, IsOptional, IsBoolean, MaxLength, MinLength } from 'class-validator';

export class CreateLinkedBankAccountDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  accountHolderName: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(4)
  @MaxLength(100)
  accountNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  iban?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  bankName: string;

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
  @IsBoolean()
  isDefault?: boolean;
}
