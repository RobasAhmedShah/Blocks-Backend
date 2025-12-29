import { IsString, IsObject, IsOptional, IsNumber, IsInt, MaxLength, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ============================================
// Merchant QR Code Request DTOs
// ============================================

export class PostalAddressP2MDto {
  @IsString()
  @MaxLength(35)
  townName: string;

  @IsString()
  @MaxLength(70)
  addressLine: string;

  @IsString()
  @MaxLength(8)
  subDept: string;
}

export class ContactDetailsP2MDto {
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
  @MaxLength(35)
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

export class MerchantDetailsP2MDto {
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

  @IsOptional()
  @ValidateNested()
  @Type(() => PostalAddressP2MDto)
  postalAddress?: PostalAddressP2MDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDetailsP2MDto)
  contactDetails?: ContactDetailsP2MDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoLocationDto)
  geoLocation?: GeoLocationDto;
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

export class PaymentDetailsP2MDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  executionDateTime?: string;

  @IsString()
  @MaxLength(20)
  expiryDateTime: string;

  @IsInt()
  @Min(1)
  instructedAmount: number; // Amount in PKR (smallest currency unit, e.g., 100 = 1.00 PKR)

  @IsString()
  transactionType: string; // e.g., "PURCHASE", "REFUND", etc.
}

export class InfoDto {
  @IsString()
  @MaxLength(6)
  stan: string;

  @IsString()
  @MaxLength(12)
  rrn: string;
}

export class GenerateP2MQrMerchantDto {
  @ValidateNested()
  @Type(() => MerchantDetailsP2MDto)
  merchantDetails: MerchantDetailsP2MDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PayerDetailsDto)
  payerDetails?: PayerDetailsDto;

  @ValidateNested()
  @Type(() => PaymentDetailsP2MDto)
  paymentDetails: PaymentDetailsP2MDto;

  @ValidateNested()
  @Type(() => InfoDto)
  info: InfoDto;
}

// ============================================
// Aggregator QR Code Request DTOs
// ============================================

export class MerchantDetailsAggregatorDto {
  @IsString()
  @MaxLength(35)
  merchantID: string;

  @IsString()
  @MaxLength(70)
  subDept: string; // Terminal ID. If not available, use "0001"
}

export class ContactDetailsAggregatorDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  merchantChannelId?: string;
}

export class GenerateP2MQrAggregatorDto {
  @ValidateNested()
  @Type(() => MerchantDetailsAggregatorDto)
  merchantDetails: MerchantDetailsAggregatorDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDetailsAggregatorDto)
  contactDetails?: ContactDetailsAggregatorDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoLocationDto)
  geoLocation?: GeoLocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PayerDetailsDto)
  payerDetails?: PayerDetailsDto;

  @ValidateNested()
  @Type(() => PaymentDetailsP2MDto)
  paymentDetails: PaymentDetailsP2MDto;

  @ValidateNested()
  @Type(() => InfoDto)
  info: InfoDto;
}

// ============================================
// Simplified DTOs for Client Requests
// ============================================

export class GenerateP2MQrSimpleDto {
  @IsString()
  merchantID: string;

  @IsNumber()
  @Min(1)
  @Max(500000)
  amountPkr: number; // Amount in PKR (will be converted to smallest currency unit)

  @IsString()
  @IsOptional()
  referenceId?: string; // Optional reference ID (order ID, invoice number, etc.)

  @IsString()
  @IsOptional()
  purpose?: string;

  @IsString()
  @IsOptional()
  transactionType?: string; // Default: "PURCHASE"

  @IsNumber()
  @IsOptional()
  expiryMinutes?: number; // Default: 30 minutes

  @IsString()
  @IsOptional()
  subDept?: string; // Terminal ID, defaults to "0001" for aggregator

  @IsString()
  @IsOptional()
  @MaxLength(3)
  additionalRequiredDetails?: string;

  @IsString()
  @IsOptional()
  @MaxLength(35)
  loyaltyNo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(35)
  customerLabel?: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface GenerateP2MQrMerchantRequest {
  merchantDetails: {
    dbaName: string;
    merchantName: string;
    iban: string;
    bankBic: string;
    merchantCategoryCode: string;
    merchantID: string;
    postalAddress?: {
      townName: string;
      addressLine: string;
      subDept: string;
    };
    contactDetails?: {
      phoneNo?: string;
      mobileNo?: string;
      email?: string;
      dept?: string;
      website?: string;
      merchantChannelId?: string;
    };
    geoLocation?: {
      lat?: string;
      long?: string;
    };
  };
  payerDetails?: {
    additionalRequiredDetails?: string;
    identificationDetails?: {
      loyaltyNo?: string;
      customerLabel?: string;
    };
  };
  paymentDetails: {
    executionDateTime?: string;
    expiryDateTime: string;
    instructedAmount: number;
    transactionType: string;
  };
  info: {
    stan: string;
    rrn: string;
  };
}

export interface GenerateP2MQrAggregatorRequest {
  merchantDetails: {
    merchantID: string;
    subDept: string;
  };
  contactDetails?: {
    merchantChannelId?: string;
  };
  geoLocation?: {
    lat?: string;
    long?: string;
  };
  payerDetails?: {
    additionalRequiredDetails?: string;
    identificationDetails?: {
      loyaltyNo?: string;
      customerLabel?: string;
    };
  };
  paymentDetails: {
    executionDateTime?: string;
    expiryDateTime: string;
    instructedAmount: number;
    transactionType: string;
  };
  info: {
    stan: string;
    rrn: string;
  };
}

export interface P2MQrApiResponse {
  responseCode: string;
  responseDescription: string;
  // Note: QR payload is not exposed in OpenAPI, but may be in actual response
  qrCode?: string; // Base64 encoded QR code (if returned)
  qrData?: string; // QR code data string (if returned)
}

export interface GenerateP2MQrResponseDto {
  qrCodeId: string;
  merchantID: string;
  referenceId: string;
  amountPkr: string;
  qrCodeBase64?: string;
  qrCodeDataUri?: string;
  qrData?: string;
  expiryDateTime: string;
  currency: string;
  stan: string;
  rrn: string;
}


