import { IsString, IsNotEmpty, IsObject } from 'class-validator';

export class RegisterWebPushDto {
  @IsObject()
  @IsNotEmpty()
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}


