import { IsString, IsNotEmpty } from 'class-validator';

export class RegisterExpoTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}


