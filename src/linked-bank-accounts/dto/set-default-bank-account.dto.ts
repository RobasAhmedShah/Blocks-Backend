import { IsBoolean } from 'class-validator';

export class SetDefaultBankAccountDto {
  @IsBoolean()
  isDefault: boolean;
}
