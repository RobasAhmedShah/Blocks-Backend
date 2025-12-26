import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabase: SupabaseClient;
  private readonly assetsBucket: string;
  private readonly certificatesBucket: string;
  private readonly marketplaceBucket: string;
  private readonly propertyDocumentsBucket: string;
  private readonly kycDocumentsBucket: string;
  private readonly profileImagesBucket: string;
  private readonly bankTransferReceiptsBucket: string;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    // Use service role key for backend operations (bypasses RLS)
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and Service Role Key must be configured in environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.assetsBucket = this.configService.get<string>('SUPABASE_ASSETS_BUCKET', 'assets');
    this.certificatesBucket = this.configService.get<string>('SUPABASE_CERTIFICATES_BUCKET', 'certificates');
    this.marketplaceBucket = this.configService.get<string>('SUPABASE_MARKETPLACE_BUCKET', 'Marketplace');
    this.propertyDocumentsBucket = this.configService.get<string>(
      'SUPABASE_PROPERTY_DOCUMENTS_BUCKET',
      'property-documents',
    );
    this.kycDocumentsBucket = this.configService.get<string>(
      'SUPABASE_KYC_DOCUMENTS_BUCKET',
      'kyc-documents',
    );
    this.profileImagesBucket = this.configService.get<string>(
      'SUPABASE_PROFILE_IMAGES_BUCKET',
      'profile-images',
    );
    this.bankTransferReceiptsBucket = this.configService.get<string>(
      'SUPABASE_BANK_TRANSFER_RECEIPTS_BUCKET',
      'bank-transfer-receipts',
    );
  }

  onModuleInit() {
    console.log('Supabase service initialized');
    console.log(`Assets bucket: ${this.assetsBucket}`);
    console.log(`Certificates bucket: ${this.certificatesBucket}`);
    console.log(`Marketplace bucket: ${this.marketplaceBucket}`);
    console.log(`Property documents bucket: ${this.propertyDocumentsBucket}`);
    console.log(`KYC documents bucket: ${this.kycDocumentsBucket}`);
    console.log(`Profile images bucket: ${this.profileImagesBucket}`);
    console.log(`Bank transfer receipts bucket: ${this.bankTransferReceiptsBucket}`);
  }

  /**
   * Upload PDF to certificates bucket
   */
  async uploadCertificate(
    filePath: string,
    fileBuffer: Buffer,
    contentType: string = 'application/pdf',
  ): Promise<{ path: string; publicUrl: string }> {
    // Use upsert: true to allow overwriting existing files
    const { data, error } = await this.supabase.storage
      .from(this.certificatesBucket)
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: true, // Allow overwriting if file already exists
      });

    if (error) {
      throw new Error(`Failed to upload certificate to Supabase: ${error.message}`);
    }

    // Get public URL (will be null for private buckets, use signed URL instead)
    const { data: urlData } = this.supabase.storage
      .from(this.certificatesBucket)
      .getPublicUrl(filePath);

    return {
      path: data.path,
      publicUrl: urlData.publicUrl,
    };
  }

  /**
   * Generate signed URL for private certificate (for mobile app)
   */
  async createSignedUrl(
    filePath: string,
    expiresIn: number = 3600, // 1 hour default
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.certificatesBucket)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Get public URL for asset (stamps, watermarks) from assets bucket
   */
  getAssetUrl(assetPath: string): string {
    const { data } = this.supabase.storage
      .from(this.assetsBucket)
      .getPublicUrl(assetPath);

    return data.publicUrl;
  }

  /**
   * Get public URL for property legal document
   */
  getPropertyDocumentUrl(propertyId: string): string {
    const filePath = `${propertyId}.pdf`;
    const { data } = this.supabase.storage
      .from(this.propertyDocumentsBucket)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * Get full public URL for certificate (for saving in database)
   */
  getCertificatePublicUrl(filePath: string): string {
    const { data } = this.supabase.storage
      .from(this.certificatesBucket)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * Check if file exists in certificates bucket
   */
  async certificateExists(filePath: string): Promise<boolean> {
    try {
      const pathParts = filePath.split('/');
      const folder = pathParts.slice(0, -1).join('/');
      const fileName = pathParts[pathParts.length - 1];

      const { data, error } = await this.supabase.storage
        .from(this.certificatesBucket)
        .list(folder, {
          search: fileName,
        });

      return !error && data && data.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Upload KYC document (image) to Supabase Storage
   */
  async uploadKycDocument(
    userId: string,
    fileBuffer: Buffer,
    documentType: 'front' | 'back' | 'selfie',
    contentType: string = 'image/jpeg',
  ): Promise<{ path: string; publicUrl: string }> {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const filePath = `${userId}/${documentType}-${timestamp}-${randomId}.${ext}`;

    const { data, error } = await this.supabase.storage
      .from(this.kycDocumentsBucket)
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: false, // Don't overwrite - each upload is unique
      });

    if (error) {
      throw new Error(`Failed to upload KYC document: ${error.message}`);
    }

    // Get public URL (or signed URL for private buckets)
    const { data: urlData } = this.supabase.storage
      .from(this.kycDocumentsBucket)
      .getPublicUrl(filePath);

    return {
      path: data.path,
      publicUrl: urlData.publicUrl,
    };
  }

  /**
   * Generate signed URL for KYC document (for private bucket access)
   */
  async getKycDocumentSignedUrl(
    filePath: string,
    expiresIn: number = 3600, // 1 hour
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.kycDocumentsBucket)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Delete KYC document from Supabase Storage
   */
  async deleteKycDocument(filePath: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.kycDocumentsBucket)
      .remove([filePath]);

    if (error) {
      throw new Error(`Failed to delete KYC document: ${error.message}`);
    }
  }

  /**
   * Upload profile image to Supabase Storage
   */
  async uploadProfileImage(
    userId: string,
    fileBuffer: Buffer,
    contentType: string = 'image/jpeg',
  ): Promise<{ path: string; publicUrl: string }> {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const filePath = `${userId}/profile-${timestamp}-${randomId}.${ext}`;

    // Use upsert: true to allow overwriting existing profile images
    const { data, error } = await this.supabase.storage
      .from(this.profileImagesBucket)
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: false, // Don't overwrite - create new file each time
      });

    if (error) {
      throw new Error(`Failed to upload profile image: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from(this.profileImagesBucket)
      .getPublicUrl(filePath);

    return {
      path: data.path,
      publicUrl: urlData.publicUrl,
    };
  }

  /**
   * Delete profile image from Supabase Storage
   */
  async deleteProfileImage(filePath: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.profileImagesBucket)
      .remove([filePath]);

    if (error) {
      throw new Error(`Failed to delete profile image: ${error.message}`);
    }
  }

  /**
   * Upload bank transfer receipt (image) to Supabase Storage
   */
  async uploadBankTransferReceipt(
    userId: string,
    requestId: string,
    fileBuffer: Buffer,
    contentType: string = 'image/jpeg',
  ): Promise<{ path: string; publicUrl: string }> {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const filePath = `${userId}/${requestId}_${timestamp}_${randomId}.${ext}`;

    const { data, error } = await this.supabase.storage
      .from(this.bankTransferReceiptsBucket)
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: false, // Don't overwrite - each upload is unique
      });

    if (error) {
      throw new Error(`Failed to upload bank transfer receipt: ${error.message}`);
    }

    // Get signed URL for private bucket (or public URL if bucket is public)
    const { data: urlData } = this.supabase.storage
      .from(this.bankTransferReceiptsBucket)
      .getPublicUrl(filePath);

    return {
      path: data.path,
      publicUrl: urlData.publicUrl,
    };
  }

  /**
   * Generate signed URL for bank transfer receipt (for private bucket access)
   */
  async getBankTransferReceiptSignedUrl(
    filePath: string,
    expiresIn: number = 3600, // 1 hour
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bankTransferReceiptsBucket)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Delete bank transfer receipt from Supabase Storage
   */
  async deleteBankTransferReceipt(filePath: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bankTransferReceiptsBucket)
      .remove([filePath]);

    if (error) {
      throw new Error(`Failed to delete bank transfer receipt: ${error.message}`);
    }
  }

  /**
   * Upload marketplace trade certificate PDF to Marketplace bucket
   */
  async uploadMarketplaceCertificate(
    filePath: string,
    fileBuffer: Buffer,
    contentType: string = 'application/pdf',
  ): Promise<{ path: string; publicUrl: string }> {
    const { data, error } = await this.supabase.storage
      .from(this.marketplaceBucket)
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: true, // Allow overwriting if file already exists
      });

    if (error) {
      throw new Error(`Failed to upload marketplace certificate to Supabase: ${error.message}`);
    }

    // Get public URL (will be null for private buckets, use signed URL instead)
    const { data: urlData } = this.supabase.storage
      .from(this.marketplaceBucket)
      .getPublicUrl(data.path);

    return {
      path: data.path,
      publicUrl: urlData.publicUrl,
    };
  }

  /**
   * Generate signed URL for marketplace certificate (for private bucket access)
   */
  async getMarketplaceCertificateSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.marketplaceBucket)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      throw new Error(`Failed to generate signed URL for marketplace certificate: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Get full public URL for marketplace certificate (for saving in database)
   */
  getMarketplaceCertificatePublicUrl(filePath: string): string {
    const { data } = this.supabase.storage
      .from(this.marketplaceBucket)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
}

