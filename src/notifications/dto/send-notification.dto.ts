import { IsArray, IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class SendNotificationDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  userIds: string[]; // Array of user IDs to send notification to

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsIn(['properties', 'property-detail', 'portfolio', 'wallet', 'notifications', 'custom'])
  category: 'properties' | 'property-detail' | 'portfolio' | 'wallet' | 'notifications' | 'custom';

  @IsString()
  @IsOptional()
  propertyId?: string; // Required if category is 'property-detail'

  @IsString()
  @IsOptional()
  customUrl?: string; // Required if category is 'custom'
}

