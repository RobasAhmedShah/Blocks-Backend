import { IsString, IsNumber, IsUUID, Min, Max, IsOptional } from 'class-validator';

export class GenerateQrDto {
  @IsNumber()
  @Min(1, { message: 'Amount must be at least 1 PKR' })
  @Max(500000, { message: 'Amount cannot exceed 500,000 PKR' })
  amountPkr: number;

  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  purpose?: string;
}

export class GenerateQrResponseDto {
  depositId: string;
  referenceId: string;
  amountPkr: string;
  qrCodeBase64: string;
  qrCodeDataUri: string;
  currency: string;
}

export interface OneLinkTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface OneLinkQrRequest {
  InitiationMethod: string;
  MerchantAccountInformationPayee: {
    GloballyUniqueIdentifier: string;
    PayeeBankIMD: string;
    PayeeAccountNumber: string;
  };
  MerchantAccountInformationProduct: {
    GloballyUniqueIdentifier: string;
    ProductCode: string;
  };
  MCC: string;
  CurrencyCode: string;
  TransactionAmount: string;
  ConvenienceInd?: string;
  ConvenienceFeeValue?: string;
  ConvenienceFeePercentage?: string;
  CountryCode: string;
  MerchantName: string;
  MerchantCity: string;
  PostalCode?: string;
  AdditionalData: {
    BillNumber?: string;
    MobileNumber?: string;
    StoreID?: string;
    LoyaltyNumber?: string;
    ReferenceID: string;
    ConsumerID?: string;
    TerminalID?: string;
    Purpose: string;
    AdditionalConsumerDataRequest?: string;
  };
  MerchantLanguageInfoTemplate?: {
    LanguagePreference?: string;
    MerchantNameAlternateLanguage?: string;
    MerchantCityAlternateLanguage?: string;
    RFUforEMVCo?: string;
  };
}

export interface OneLinkQrResponse {
  ResponseCode: string;
  ResponseDetail: string;
  QRCode?: string;
}

