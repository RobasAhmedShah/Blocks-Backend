import { IsEnum, IsString, IsOptional } from 'class-validator';

export class UploadKycDocumentDto {
  @IsEnum(['front', 'back', 'selfie'])
  documentType: 'front' | 'back' | 'selfie';

  @IsOptional()
  @IsString()
  userId?: string; // Optional: if not using JWT auth
}

