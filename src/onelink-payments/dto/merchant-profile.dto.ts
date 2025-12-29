import { IsString, IsObject, IsOptional, IsNumber, MaxLength, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

// ============================================
// Create Merchant Profile DTOs
// ============================================

export class PostalAddressDto {
  @IsString()
  @MaxLength(35)
  townName: string;

  @IsString()
  @MaxLength(70)
  addressLine: string;
}

export class ContactDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(15)
  phoneNo?: string; // Must be 13-15 digits (international format, e.g., +923001234567)

  @IsOptional()
  @IsString()
  @MaxLength(15)
  mobileNo?: string; // Must be 13-15 digits (international format, e.g., +923001234567)

  @IsOptional()
  @IsString()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  dept?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  website?: string;
}

export class PaymentDetailsDto {
  @IsString()
  @IsIn(['F', 'P']) // F = Fixed, P = Percentage
  feeType: string;

  @IsNumber()
  feeValue: number;
}

export class MerchantDetailsCreateDto {
  @IsString()
  @MaxLength(140)
  dbaName: string;

  @IsString()
  @MaxLength(140)
  merchantName: string;

  @IsString()
  @MaxLength(24)
  iban: string;

  @IsString()
  @MaxLength(6)
  bankBic: string;

  @IsString()
  @MaxLength(35)
  merchantCategoryCode: string;

  @IsString()
  @MaxLength(35)
  merchantID: string;

  @IsString()
  @MaxLength(140)
  accountTitle: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PostalAddressDto)
  postalAddress?: PostalAddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDetailsDto)
  contactDetails?: ContactDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentDetailsDto)
  paymentDetails?: PaymentDetailsDto;
}

export class CreateMerchantProfileDto {
  @ValidateNested()
  @Type(() => MerchantDetailsCreateDto)
  merchantDetails: MerchantDetailsCreateDto;
}

// ============================================
// Update Merchant Profile DTOs
// ============================================

export class MerchantDetailsUpdateDto {
  @IsString()
  @IsIn(['00', '01', '02']) // 00=Active, 01=Inactive, 02=Blocked
  merchantStatus: string;

  @IsOptional()
  @IsString()
  reasonCode?: string;

  @IsString()
  @MaxLength(140)
  dbaName: string;

  @IsString()
  @MaxLength(140)
  merchantName: string;

  @IsString()
  @MaxLength(24)
  iban: string;

  @IsString()
  @MaxLength(6)
  bankBic: string;

  @IsString()
  @MaxLength(35)
  merchantCategoryCode: string;

  @IsString()
  @MaxLength(35)
  merchantID: string;

  @IsString()
  @MaxLength(140)
  accountTitle: string;
}

export class UpdateMerchantProfileDto {
  @ValidateNested()
  @Type(() => MerchantDetailsUpdateDto)
  merchantDetails: MerchantDetailsUpdateDto;
}

// ============================================
// Get Merchant Profile DTOs
// ============================================

export class GetMerchantProfileQueryDto {
  @IsString()
  merchantID: string;
}

// ============================================
// Notify Merchant DTOs (Webhook from 1LINK)
// ============================================

export class NotifyMerchantInfoDto {
  @IsString()
  @MaxLength(12)
  rrn: string;

  @IsString()
  @MaxLength(6)
  stan: string;

  @IsString()
  dateTime: string;
}

export class NotifyMerchantMessageInfoDto {
  @IsString()
  merchantID: string;

  @IsOptional()
  @IsString()
  subDept?: string;

  @IsString()
  status: string;
}

export class NotifyMerchantDto {
  @ValidateNested()
  @Type(() => NotifyMerchantInfoDto)
  info: NotifyMerchantInfoDto;

  @ValidateNested()
  @Type(() => NotifyMerchantMessageInfoDto)
  messageInfo: NotifyMerchantMessageInfoDto;
}

// ============================================
// Payment Notification DTOs (Webhook from 1LINK)
// ============================================

export class PaymentNotificationInfoDto {
  @IsString()
  @MaxLength(12)
  rrn: string;

  @IsString()
  @MaxLength(6)
  stan: string;

  @IsString()
  dateTime: string;
}

export class PaymentNotificationMessageInfoDto {
  @IsString()
  merchantID: string;

  @IsOptional()
  @IsString()
  subDept?: string;

  @IsString()
  status: string;

  @IsString()
  orginalInstructedAmount: string;

  @IsString()
  netAmount: string;
}

export class PaymentNotificationDto {
  @ValidateNested()
  @Type(() => PaymentNotificationInfoDto)
  info: PaymentNotificationInfoDto;

  @ValidateNested()
  @Type(() => PaymentNotificationMessageInfoDto)
  messageInfo: PaymentNotificationMessageInfoDto;
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateMerchantProfileRequest {
  merchantDetails: {
    dbaName: string;
    merchantName: string;
    iban: string;
    bankBic: string;
    merchantCategoryCode: string;
    merchantID: string;
    accountTitle: string;
    postalAddress?: {
      townName: string;
      addressLine: string;
    };
    contactDetails?: {
      phoneNo?: string;
      mobileNo?: string;
      email?: string;
      dept?: string;
      website?: string;
    };
    paymentDetails?: {
      feeType: string;
      feeValue: number;
    };
  };
}

export interface UpdateMerchantProfileRequest {
  merchantDetails: {
    merchantStatus: string;
    reasonCode?: string;
    dbaName: string;
    merchantName: string;
    iban: string;
    bankBic: string;
    merchantCategoryCode: string;
    merchantID: string;
    accountTitle: string;
  };
}

export interface MerchantProfileApiResponse {
  responseCode: string;
  responseDescription: string;
}

