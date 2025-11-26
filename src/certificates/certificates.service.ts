import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Investment } from '../investments/entities/investment.entity';
import { Property } from '../properties/entities/property.entity';
import { User } from '../admin/entities/user.entity';
import { SupabaseService } from '../supabase/supabase.service';
import { PdfService } from '../pdf/pdf.service';
import * as ejs from 'ejs';
import * as path from 'path';
import * as fs from 'fs';
import Decimal from 'decimal.js';

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);
  private readonly templatesPath: string;

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Investment)
    private readonly investmentRepo: Repository<Investment>,
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly supabaseService: SupabaseService,
    private readonly pdfService: PdfService,
  ) {
    // Resolve templates path - works in both dev and production
    // In dev: __dirname = dist/src/certificates, but templates are in src/certificates/templates
    // In prod: templates should be copied to dist/src/certificates/templates
    const distPath = path.join(__dirname, 'templates');
    const srcPath = path.join(__dirname, '..', '..', 'src', 'certificates', 'templates');
    
    // Check if templates exist in dist (production) or use src path (development)
    if (fs.existsSync(distPath)) {
      this.templatesPath = distPath;
      this.logger.log(`[CertificatesService] ✅ Using templates from: ${distPath}`);
    } else if (fs.existsSync(srcPath)) {
      this.templatesPath = srcPath;
      this.logger.log(`[CertificatesService] ✅ Using templates from: ${srcPath}`);
    } else {
      // Fallback: try process.cwd() relative path
      const cwdPath = path.join(process.cwd(), 'src', 'certificates', 'templates');
      if (fs.existsSync(cwdPath)) {
        this.templatesPath = cwdPath;
        this.logger.log(`[CertificatesService] ✅ Using templates from: ${cwdPath}`);
      } else {
        this.templatesPath = srcPath; // Default to src path for dev mode
        this.logger.warn(`[CertificatesService] ⚠️ Templates path not found, using: ${srcPath}`);
      }
    }
  }

  /**
   * Generate transaction certificate PDF
   */
  async generateTransactionCertificate(
    transactionId: string,
    investmentId?: string, // Optional: specific investment ID to update
  ): Promise<{
    certificatePath: string;
    signedUrl: string;
  }> {
    this.logger.log(`[CertificatesService] 🔄 Generating transaction certificate for: ${transactionId}`);

    try {
      // Load transaction with relations
      const transaction = await this.transactionRepo.findOne({
        where: { id: transactionId },
        relations: ['user', 'property', 'property.organization'],
      });

      if (!transaction) {
        this.logger.error(`[CertificatesService] ❌ Transaction ${transactionId} not found`);
        throw new NotFoundException(`Transaction ${transactionId} not found`);
      }

      if (!transaction.user) {
        this.logger.error(`[CertificatesService] ❌ Transaction user not found for transaction ${transactionId}`);
        throw new NotFoundException('Transaction user not found');
      }

      if (!transaction.property) {
        this.logger.error(`[CertificatesService] ❌ Transaction property not found for transaction ${transactionId}`);
        throw new NotFoundException('Transaction property not found');
      }

      // Check if certificate already exists
      if (transaction.certificatePath) {
        this.logger.log(`[CertificatesService] ✅ Certificate already exists: ${transaction.certificatePath}`);
        
        // Extract relative path if it's a full URL (for signed URL generation)
        let relativePath = transaction.certificatePath;
        if (transaction.certificatePath.startsWith('http://') || transaction.certificatePath.startsWith('https://')) {
          const urlParts = transaction.certificatePath.split('/storage/v1/object/public/certificates/');
          relativePath = urlParts.length > 1 ? urlParts[1] : transaction.certificatePath;
        }
        
        const signedUrl = await this.supabaseService.createSignedUrl(relativePath);
        return {
          certificatePath: transaction.certificatePath, // Return stored full URL
          signedUrl,
        };
      }

      this.logger.log(`[CertificatesService] 📄 Starting PDF generation for transaction ${transaction.displayCode}`);

      // Get investment details if available
      let investment: Investment | null = null;
      if (transaction.userId && transaction.propertyId) {
        investment = await this.investmentRepo.findOne({
          where: {
            userId: transaction.userId,
            propertyId: transaction.propertyId,
          },
          order: { createdAt: 'DESC' },
        });
      }

      // Calculate ownership percentage and average price
      const tokensPurchased = investment?.tokensPurchased || new Decimal(0);
      const totalTokens = transaction.property.totalTokens || new Decimal(0);
      const ownershipPercentage = totalTokens.gt(0)
        ? tokensPurchased.div(totalTokens).times(100)
        : new Decimal(0);

      const totalInvested = investment?.amountUSDT || transaction.amountUSDT || new Decimal(0);
      const averagePrice = tokensPurchased.gt(0)
        ? totalInvested.div(tokensPurchased)
        : new Decimal(0);

      // Get stamp URLs for logos
      const secpStampUrl = this.supabaseService.getAssetUrl('stamps/secp.png');
      const sbpStampUrl = this.supabaseService.getAssetUrl('stamps/sbp.png');

      // Prepare certificate data for PDFKit
      const certificateData = {
        department: 'Blocks Token Land Ownership',
        subDepartment: '',
        boxNo: transaction.displayCode || 'N/A',
        regNo: `REG-${transaction.displayCode}`,
        ownerName: transaction.user.fullName || transaction.user.email,
        ownerAddress: transaction.user.email || 'N/A',
        propertyId: transaction.property.displayCode,
        location: `${transaction.property.city || ''}, ${transaction.property.country || ''}`.trim() || 'N/A',
        surveyNo: 'N/A', // Add to Property entity if needed
        area: 'N/A', // Add to Property entity if needed
        usage: transaction.property.type || 'N/A',
        tokensPurchased: tokensPurchased.toString(),
        totalTokens: totalTokens.toString(),
        ownershipPercentage: ownershipPercentage.toFixed(8),
        tokenPrice: transaction.property.pricePerTokenUSDT?.toString() || '0',
        totalAmount: transaction.amountUSDT?.toString() || '0',
        averagePrice: averagePrice.toFixed(2),
        expectedROI: transaction.property.expectedROI?.toString() || '0',
        authorityName: 'A. B. Registrar', // Can be made configurable
        designation: 'Registrar of Deeds',
        serial: `CERT-${transaction.displayCode}-${Date.now()}`,
        date: transaction.createdAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        secpStampUrl,
        sbpStampUrl,
      };

      this.logger.log(`[CertificatesService] 📄 Generating PDF certificate using PDFKit...`);

      // Generate PDF using PDFKit
      const pdfBuffer = await this.pdfService.generateCertificate(certificateData);

      this.logger.log(`[CertificatesService] 📦 PDF generated (${pdfBuffer.length} bytes)`);

      // Upload to Supabase
      const filePath = `transactions/${transaction.userId}/${transaction.id}.pdf`;
      this.logger.log(`[CertificatesService] ☁️ Uploading to Supabase: ${filePath}`);
      
      const { path: uploadedPath } = await this.supabaseService.uploadCertificate(
        filePath,
        pdfBuffer,
      );

      this.logger.log(`[CertificatesService] ✅ Uploaded to Supabase: ${uploadedPath}`);

      // ✅ Get full public URL for saving in database
      const fullPublicUrl = this.supabaseService.getCertificatePublicUrl(uploadedPath);
      this.logger.log(`[CertificatesService] 🔗 Full public URL: ${fullPublicUrl}`);

      // Save full URL to transaction table using update() for reliability
      await this.transactionRepo.update(
        { id: transaction.id },
        { certificatePath: fullPublicUrl }
      );
      
      // Verify the save by reloading
      const updatedTransaction = await this.transactionRepo.findOne({
        where: { id: transaction.id },
      });
      
      if (updatedTransaction?.certificatePath === fullPublicUrl) {
        this.logger.log(`[CertificatesService] ✅ Verified: Certificate path saved to transaction ${transaction.displayCode}: ${fullPublicUrl}`);
      } else {
        this.logger.error(`[CertificatesService] ❌ FAILED: Certificate path NOT saved to transaction ${transaction.displayCode}`);
        throw new Error(`Failed to save certificate path to transaction ${transaction.id}`);
      }

      // ✅ ALSO save certificatePath (full URL) to investments table
      // If investmentId is provided, update that specific investment
      // Otherwise, update the most recent investment for this user/property
      if (transaction.userId && transaction.propertyId) {
        let investment: Investment | null = null;
        
        if (investmentId) {
          // Update the specific investment from the event
          investment = await this.investmentRepo.findOne({
            where: { id: investmentId },
          });
          
          if (!investment) {
            this.logger.warn(`[CertificatesService] ⚠️ Investment ${investmentId} not found, trying to find by user/property...`);
          }
        }
        
        // Fallback: Find the most recent investment if specific ID not found or not provided
        if (!investment) {
          investment = await this.investmentRepo.findOne({
            where: {
              userId: transaction.userId,
              propertyId: transaction.propertyId,
            },
            order: { createdAt: 'DESC' }, // Get the most recent investment
          });
        }

        if (investment) {
          // Use update() for more reliable save
          await this.investmentRepo.update(
            { id: investment.id },
            { certificatePath: fullPublicUrl }
          );
          
          // Verify the save by reloading
          const updatedInvestment = await this.investmentRepo.findOne({
            where: { id: investment.id },
          });
          
          if (updatedInvestment?.certificatePath === fullPublicUrl) {
            this.logger.log(`[CertificatesService] ✅ Verified: Certificate path saved to investment ${investment.displayCode} (${investment.id}): ${fullPublicUrl}`);
          } else {
            this.logger.error(`[CertificatesService] ❌ FAILED: Certificate path NOT saved to investment ${investment.displayCode} (${investment.id})`);
            throw new Error(`Failed to save certificate path to investment ${investment.id}`);
          }
        } else {
          this.logger.warn(`[CertificatesService] ⚠️ Investment not found for userId=${transaction.userId}, propertyId=${transaction.propertyId}, investmentId=${investmentId || 'N/A'}`);
        }
      }

      // Generate signed URL
      const signedUrl = await this.supabaseService.createSignedUrl(uploadedPath);

      this.logger.log(`[CertificatesService] ✅ Transaction certificate generated successfully: ${fullPublicUrl}`);

      return {
        certificatePath: fullPublicUrl, // Return full URL
        signedUrl,
      };
    } catch (error) {
      this.logger.error(`[CertificatesService] ❌ Error generating certificate:`, error.stack || error.message || error);
      throw error;
    }
  }

  /**
   * Generate portfolio summary certificate PDF
   */
  async generatePortfolioSummary(
    userId: string,
    propertyId: string,
  ): Promise<{
    certificatePath: string;
    signedUrl: string;
  }> {
    this.logger.log(`Generating portfolio summary for user: ${userId}, property: ${propertyId}`);

    // Load user
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Load property - support both UUID and displayCode
    const isPropertyUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId);
    let property: Property | null;
    if (isPropertyUuid) {
      property = await this.propertyRepo.findOne({
        where: { id: propertyId },
        relations: ['organization'],
      });
    } else {
      property = await this.propertyRepo.findOne({
        where: { displayCode: propertyId },
        relations: ['organization'],
      });
    }
    
    if (!property) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }
    
    // Use actual property ID (UUID) for database queries
    const actualPropertyId = property.id;

    // Get all investments for this user and property
    const investments = await this.investmentRepo.find({
      where: {
        userId,
        propertyId: actualPropertyId,
        status: 'confirmed',
      },
      order: { createdAt: 'ASC' },
    });

    if (investments.length === 0) {
      throw new NotFoundException('No investments found for this property');
    }

    // Calculate totals
    const totalTokens = investments.reduce(
      (sum, inv) => sum.plus(inv.tokensPurchased),
      new Decimal(0),
    );
    const totalInvested = investments.reduce(
      (sum, inv) => sum.plus(inv.amountUSDT),
      new Decimal(0),
    );
    const averagePrice = totalTokens.gt(0)
      ? totalInvested.div(totalTokens)
      : new Decimal(0);
    const ownershipPercentage = property.totalTokens.gt(0)
      ? totalTokens.div(property.totalTokens).times(100)
      : new Decimal(0);

    // Get all transactions for this property
    const transactions = await this.transactionRepo.find({
      where: {
        userId,
        propertyId: actualPropertyId,
        type: 'investment',
        status: 'completed',
      },
      order: { createdAt: 'ASC' },
    });

    // Get stamp URLs
    const secpStampUrl = this.supabaseService.getAssetUrl('stamps/secp.png');
    const sbpStampUrl = this.supabaseService.getAssetUrl('stamps/sbp.png');

    // Prepare template data
    const templateData = {
      certificateId: `PORT-${property.displayCode}-${Date.now()}`,
      investorName: user.fullName || user.email,
      userId: user.displayCode || userId,
      propertyName: property.title,
      propertyDisplayCode: property.displayCode,
      propertyLocation: `${property.city || ''}, ${property.country || ''}`.trim() || 'N/A',
      expectedROI: property.expectedROI?.toString() || '0',
      totalTokens: totalTokens.toString(),
      totalInvested: totalInvested.toString(),
      averagePrice: averagePrice.toFixed(2),
      ownershipPercentage: ownershipPercentage.toFixed(2),
      transactions: transactions.map((txn) => {
        // Find corresponding investment for this transaction
        const relatedInvestment = investments.find(
          (inv) => inv.userId === txn.userId && inv.propertyId === txn.propertyId,
        );
        return {
          date: txn.createdAt.toLocaleDateString('en-US'),
          displayCode: txn.displayCode,
          tokens: relatedInvestment?.tokensPurchased?.toString() || '0',
          amount: txn.amountUSDT?.toString() || '0',
          status: txn.status.toUpperCase(),
        };
      }),
      secpStampUrl,
      sbpStampUrl,
      generatedAt: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    };

    // Render HTML template
    const html = await ejs.renderFile(
      path.join(this.templatesPath, 'portfolio-summary.ejs'),
      templateData,
    );

    // Generate PDF
    const pdfBuffer = await this.pdfService.generateFromHtml(html);

    // Upload to Supabase
    const filePath = `portfolio/${userId}/${actualPropertyId}.pdf`;
    const { path: uploadedPath } = await this.supabaseService.uploadCertificate(
      filePath,
      pdfBuffer,
    );

    // ✅ Get full public URL for saving in database (if needed)
    const fullPublicUrl = this.supabaseService.getCertificatePublicUrl(uploadedPath);
    this.logger.log(`[CertificatesService] 🔗 Full public URL: ${fullPublicUrl}`);

    // Generate signed URL
    const signedUrl = await this.supabaseService.createSignedUrl(uploadedPath);

    this.logger.log(`Portfolio summary certificate generated: ${fullPublicUrl}`);

    return {
      certificatePath: fullPublicUrl, // Return full URL
      signedUrl,
    };
  }

  /**
   * Get transaction certificate signed URL
   */
  async getTransactionCertificate(transactionId: string): Promise<string> {
    this.logger.log(`Getting transaction certificate for: ${transactionId}`);
    
    // Support both UUID and displayCode
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transactionId);
    let transaction;
    
    if (isUuid) {
      transaction = await this.transactionRepo.findOne({
        where: { id: transactionId },
      });
    } else {
      transaction = await this.transactionRepo.findOne({
        where: { displayCode: transactionId },
      });
    }

    if (!transaction) {
      this.logger.warn(`Transaction not found: ${transactionId}`);
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    // Use actual UUID for certificate operations
    const actualTransactionId = transaction.id;

    if (!transaction.certificatePath) {
      // Generate if doesn't exist
      this.logger.log(`Certificate not found, generating for transaction: ${actualTransactionId}`);
      const result = await this.generateTransactionCertificate(actualTransactionId);
      return result.signedUrl;
    }

    // Check if certificatePath is already a full URL or relative path
    if (transaction.certificatePath.startsWith('http://') || transaction.certificatePath.startsWith('https://')) {
      // It's already a full URL, return it directly (or create signed URL for private buckets)
      this.logger.log(`Certificate exists (full URL), creating signed URL from: ${transaction.certificatePath}`);
      // Extract relative path from full URL for signed URL generation
      const urlParts = transaction.certificatePath.split('/storage/v1/object/public/certificates/');
      const relativePath = urlParts.length > 1 ? urlParts[1] : transaction.certificatePath;
      return await this.supabaseService.createSignedUrl(relativePath);
    } else {
      // It's a relative path (old format), create signed URL
      this.logger.log(`Certificate exists (relative path), creating signed URL: ${transaction.certificatePath}`);
      return await this.supabaseService.createSignedUrl(transaction.certificatePath);
    }
  }

  /**
   * Get property legal document URL
   */
  async getPropertyLegalDocument(propertyId: string): Promise<string | null> {
    // Check if it's a UUID format (contains hyphens and is 36 chars)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propertyId);
    
    let property: Property | null;
    if (isUuid) {
      property = await this.propertyRepo.findOne({ where: { id: propertyId } });
    } else {
      property = await this.propertyRepo.findOne({ where: { displayCode: propertyId } });
    }

    if (!property) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }

    // Use the actual property ID (UUID) for Supabase lookup
    const actualPropertyId = property.id;

    if (property.legalDocPath) {
      // If path is stored in DB, use it
      return await this.supabaseService.createSignedUrl(property.legalDocPath);
    }

    // Otherwise, try to get from property-documents bucket
    try {
      return this.supabaseService.getPropertyDocumentUrl(actualPropertyId);
    } catch (error) {
      this.logger.warn(`Property legal document not found for: ${actualPropertyId}`);
      return null;
    }
  }

  /**
   * Generate document hash for verification
   */
  private generateDocumentHash(transaction: Transaction): string {
    const crypto = require('crypto');
    const data = JSON.stringify({
      id: transaction.id,
      displayCode: transaction.displayCode,
      userId: transaction.userId,
      propertyId: transaction.propertyId,
      amount: transaction.amountUSDT?.toString(),
      createdAt: transaction.createdAt.toISOString(),
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

