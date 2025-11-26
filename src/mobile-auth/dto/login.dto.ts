import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsObject } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  expoToken?: string;

  @IsOptional()
  @IsObject()
  webPushSubscription?: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

