import { IsString, IsNumber, IsOptional, IsObject, ValidateNested, MaxLength, MinLength, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ============================================
// Common DTOs
// ============================================

export class InfoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(6)
  stan: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(12)
  rrn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(35)
  merchantID?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  subDept?: string;

  @IsOptional()
  @IsString()
  rtpId?: string;
}

export class PostalAddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(35)
  townName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(70)
  subDept: string;

  @IsString()
  @MinLength(1)
  @MaxLength(70)
  addressLine: string;
}

export class ContactDetailsDto {
  @IsOptional()
  @IsString()
  phoneNo?: string;

  @IsOptional()
  @IsString()
  mobileNo?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(128)
  merchantChannelId?: string;
}

export class GeoLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  lat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  long?: string;
}

export class IdentificationDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(35)
  loyaltyNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(35)
  customerLabel?: string;
}

export class PayerDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(3)
  additionalRequiredDetails?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => IdentificationDetailsDto)
  identificationDetails?: IdentificationDetailsDto;
}

// ============================================
// Pre-RTP Title Fetch DTOs
// ============================================

export class CustomerDetailsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  memberid: string;

  @IsString()
  @MinLength(1)
  @MaxLength(24)
  iban: string;
}

export class PreRtpTitleFetchRequestDto {
  @ValidateNested()
  @Type(() => CustomerDetailsDto)
  customerDetails: CustomerDetailsDto;

  @ValidateNested()
  @Type(() => InfoDto)
  info: InfoDto;
}

// ============================================
// Pre-RTP Alias Inquiry DTOs
// ============================================

export class AliasDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  type: string; // e.g., "MOBILE"

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  value: string; // e.g., 11-digit mobile number
}

export class PreRtpAliasInquiryRequestDto {
  @ValidateNested()
  @Type(() => AliasDto)
  alias: AliasDto;

  @ValidateNested()
  @Type(() => InfoDto)
  info: InfoDto;
}

// ============================================
// RTP Now Merchant DTOs
// ============================================

export class MerchantDetailsMerchantDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  dbaName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  merchantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  iban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6)
  bankBic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(35)
  merchantCategoryCode?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(35)
  merchantID: string;

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
  @Type(() => GeoLocationDto)
  geoLocation?: GeoLocationDto;
}

export class PaymentDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  executionDateTime?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  expiryDateTime: string;

  @IsString()
  instructedAmount: string;

  @IsString()
  rtpId: string;

  @IsOptional()
  @IsString()
  @MaxLength(35)
  billNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  transactionType?: string;
}

export class RtpNowMerchantRequestDto {
  @ValidateNested()
  @Type(() => MerchantDetailsMerchantDto)
  merchantDetails: MerchantDetailsMerchantDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PayerDetailsDto)
  payerDetails?: PayerDetailsDto;

  @ValidateNested()
  @Type(() => PaymentDetailsDto)
  paymentDetails: PaymentDetailsDto;

  @ValidateNested()
  @Type(() => InfoDto)
  info: InfoDto;
}

// ============================================
// RTP Now Aggregator DTOs
// ============================================

export class MerchantDetailsAggregatorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(35)
  merchantId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(70)
  subDept: string;
}

export class PaymentDetailsAggregatorDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  executionDateTime?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  expiryDateTime: string;

  @IsString()
  rtpId: string;

  @IsOptional()
  @IsString()
  @MaxLength(35)
  billNo?: string;

  @IsNumber()
  instructedAmount: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  transactionType?: string;
}

export class RtpNowAggregatorRequestDto {
  @ValidateNested()
  @Type(() => MerchantDetailsAggregatorDto)
  merchantDetails: MerchantDetailsAggregatorDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDetailsDto)
  contactDetails?: ContactDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoLocationDto)
  geoLocation?: GeoLocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PayerDetailsDto)
  payerDetails?: PayerDetailsDto;

  @ValidateNested()
  @Type(() => PaymentDetailsAggregatorDto)
  paymentDetails: PaymentDetailsAggregatorDto;

  @ValidateNested()
  @Type(() => InfoDto)
  info: InfoDto;
}

// ============================================
// RTP Later DTOs (same structure as Now, but with transactionType required for aggregator)
// ============================================

export class PaymentDetailsLaterAggregatorDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  executionDateTime?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  expiryDateTime: string;

  @IsString()
  rtpId: string;

  @IsOptional()
  @IsString()
  @MaxLength(35)
  billNo?: string;

  @IsNumber()
  instructedAmount: number;

  @IsString()
  @MinLength(1)
  @MaxLength(3)
  transactionType: string; // Required for later aggregator
}

export class RtpLaterMerchantRequestDto extends RtpNowMerchantRequestDto {}

export class RtpLaterAggregatorRequestDto {
  @ValidateNested()
  @Type(() => MerchantDetailsAggregatorDto)
  merchantDetails: MerchantDetailsAggregatorDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDetailsDto)
  contactDetails?: ContactDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoLocationDto)
  geoLocation?: GeoLocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PayerDetailsDto)
  payerDetails?: PayerDetailsDto;

  @ValidateNested()
  @Type(() => PaymentDetailsLaterAggregatorDto)
  paymentDetails: PaymentDetailsLaterAggregatorDto;

  @ValidateNested()
  @Type(() => InfoDto)
  info: InfoDto;
}

// ============================================
// Status Inquiry / Cancellation DTOs
// ============================================

export class StatusInquiryInfoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(6)
  stan: string;

  @IsString()
  rtpId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(35)
  merchantID: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  subDept?: string;
}

export class StatusInquiryRequestDto {
  @ValidateNested()
  @Type(() => StatusInquiryInfoDto)
  info: StatusInquiryInfoDto;
}

export class RtpCancellationRequestDto {
  @ValidateNested()
  @Type(() => StatusInquiryInfoDto)
  info: StatusInquiryInfoDto;
}

// ============================================
// Response DTOs
// ============================================

export interface RtpApiResponse {
  responseCode: string;
  responseDescription: string;
  rtpId?: string;
  title?: string;
  iban?: string;
  accountStatus?: string;
  [key: string]: unknown;
}

// ============================================
// Backend Request DTOs (simplified for frontend)
// ============================================

export class TitleFetchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  iban: string;

  @IsString()
  @MinLength(1)
  @MaxLength(24)
  bankBic: string; // memberid / Receiving participant BIC
}

export class AliasFetchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  mobileNumber: string;
}

export class CreateRtpDto {
  @IsNumber()
  @Min(1)
  @Max(10000000)
  amountPkr: number;

  @IsString()
  rtpId: string; // From pre-RTP call

  @IsOptional()
  @IsString()
  @MaxLength(35)
  billNo?: string;

  @IsOptional()
  @IsNumber()
  expiryMinutes?: number; // Default 30 minutes

  @IsOptional()
  @IsString()
  userId?: string;
}

export class RtpStatusDto {
  @IsString()
  rtpId: string;
}

