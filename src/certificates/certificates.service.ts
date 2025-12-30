import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Investment } from '../investments/entities/investment.entity';
import { Property } from '../properties/entities/property.entity';
import { User } from '../admin/entities/user.entity';
import { MarketplaceTrade } from '../marketplace/entities/marketplace-trade.entity';
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
    @InjectRepository(MarketplaceTrade)
    private readonly marketplaceTradeRepo: Repository<MarketplaceTrade>,
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

    // Generate PDF using PDFKit (HTML to PDF conversion not available)
    // TODO: Implement HTML to PDF conversion using PDFKit or alternative library
    this.logger.warn('Portfolio summary PDF generation requires HTML to PDF conversion which is not currently implemented.');
    throw new Error('Portfolio summary PDF generation is not available. Please use transaction certificate generation instead.');
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
   * Generate marketplace trade certificate PDF (transfer certificate)
   */
  async generateMarketplaceTradeCertificate(
    tradeId: string,
  ): Promise<{
    certificatePath: string;
    signedUrl: string;
  }> {
    this.logger.log(`[CertificatesService] 🔄 Generating marketplace trade certificate for: ${tradeId}`);

    try {
      // Load trade with relations
      const trade = await this.marketplaceTradeRepo.findOne({
        where: { id: tradeId },
        relations: ['buyer', 'seller', 'property', 'property.organization', 'listing'],
      });

      if (!trade) {
        this.logger.error(`[CertificatesService] ❌ Marketplace trade ${tradeId} not found`);
        throw new NotFoundException(`Marketplace trade ${tradeId} not found`);
      }

      if (!trade.buyer) {
        this.logger.error(`[CertificatesService] ❌ Trade buyer not found for trade ${tradeId}`);
        throw new NotFoundException('Trade buyer not found');
      }

      if (!trade.property) {
        this.logger.error(`[CertificatesService] ❌ Trade property not found for trade ${tradeId}`);
        throw new NotFoundException('Trade property not found');
      }

      // Check if certificate already exists
      if (trade.certificatePath) {
        this.logger.log(`[CertificatesService] ✅ Certificate already exists: ${trade.certificatePath}`);
        
        // Extract relative path if it's a full URL (for signed URL generation)
        let relativePath = trade.certificatePath;
        if (trade.certificatePath.startsWith('http://') || trade.certificatePath.startsWith('https://')) {
          const urlParts = trade.certificatePath.split('/storage/v1/object/public/Marketplace/');
          relativePath = urlParts.length > 1 ? urlParts[1] : trade.certificatePath;
        }
        
        const signedUrl = await this.supabaseService.getMarketplaceCertificateSignedUrl(relativePath);
        return {
          certificatePath: trade.certificatePath, // Return stored full URL
          signedUrl,
        };
      }

      this.logger.log(`[CertificatesService] 📄 Starting PDF generation for marketplace trade ${trade.displayCode}`);

      // Get buyer's total investment for this property to calculate ownership
      const buyerInvestments = await this.investmentRepo.find({
        where: {
          userId: trade.buyerId,
          propertyId: trade.propertyId,
          status: 'confirmed',
        },
      });

      let totalBuyerTokens = new Decimal(0);
      for (const inv of buyerInvestments) {
        totalBuyerTokens = totalBuyerTokens.plus(inv.tokensPurchased as Decimal);
      }

      const totalTokens = trade.property.totalTokens || new Decimal(0);
      const ownershipPercentage = totalTokens.gt(0)
        ? totalBuyerTokens.div(totalTokens).times(100)
        : new Decimal(0);

      // Get stamps/assets URLs
      const secpStampUrl = this.supabaseService.getAssetUrl('stamps/secp.png');
      const sbpStampUrl = this.supabaseService.getAssetUrl('stamps/sbp.png');

      // Prepare certificate data for PDFKit
      const certificateData = {
        department: 'Blocks Token Transfer Certificate',
        subDepartment: 'Marketplace Trade',
        boxNo: trade.displayCode || 'N/A',
        regNo: `REG-${trade.displayCode}`,
        ownerName: trade.buyer.fullName || trade.buyer.email,
        ownerAddress: trade.buyer.email || 'N/A',
        propertyId: trade.property.displayCode,
        location: `${trade.property.city || ''}, ${trade.property.country || ''}`.trim() || 'N/A',
        surveyNo: 'N/A',
        area: 'N/A',
        usage: trade.property.type || 'N/A',
        tokensPurchased: trade.tokensBought.toString(),
        totalTokens: totalTokens.toString(),
        ownershipPercentage: ownershipPercentage.toFixed(8),
        tokenPrice: trade.pricePerToken.toString(),
        totalAmount: trade.totalUSDT.toString(),
        averagePrice: trade.pricePerToken.toString(), // For marketplace, price per token is the purchase price
        expectedROI: trade.property.expectedROI?.toString() || '0',
        authorityName: 'A. B. Registrar',
        designation: 'Registrar of Deeds',
        serial: `CERT-${trade.displayCode}-${Date.now()}`,
        date: trade.createdAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        secpStampUrl,
        sbpStampUrl,
        // Additional marketplace-specific fields
        sellerName: trade.seller?.fullName || trade.seller?.email || 'N/A',
        listingCode: trade.listing?.displayCode || 'N/A',
        transferType: 'Marketplace Transfer',
      };

      this.logger.log(`[CertificatesService] 📄 Generating PDF certificate using PDFKit...`);

      // Generate PDF using PDFKit
      const pdfBuffer = await this.pdfService.generateCertificate(certificateData);

      this.logger.log(`[CertificatesService] 📦 PDF generated (${pdfBuffer.length} bytes)`);

      // Upload to Supabase Marketplace bucket
      const filePath = `trades/${trade.buyerId}/${trade.id}.pdf`;
      this.logger.log(`[CertificatesService] ☁️ Uploading to Supabase Marketplace bucket: ${filePath}`);
      
      const { path: uploadedPath } = await this.supabaseService.uploadMarketplaceCertificate(
        filePath,
        pdfBuffer,
      );

      this.logger.log(`[CertificatesService] ✅ Uploaded to Supabase: ${uploadedPath}`);

      // Get full public URL
      const fullPublicUrl = this.supabaseService.getMarketplaceCertificatePublicUrl(uploadedPath);
      this.logger.log(`[CertificatesService] 🔗 Full public URL: ${fullPublicUrl}`);

      // Save certificate path to trade
      await this.marketplaceTradeRepo.update(
        { id: trade.id },
        { certificatePath: fullPublicUrl }
      );

      // Verify it was saved
      const updatedTrade = await this.marketplaceTradeRepo.findOne({ where: { id: trade.id } });
      if (updatedTrade?.certificatePath === fullPublicUrl) {
        this.logger.log(`[CertificatesService] ✅ Verified: Certificate path saved to trade ${trade.displayCode}: ${fullPublicUrl}`);
      } else {
        this.logger.error(`[CertificatesService] ❌ FAILED: Certificate path NOT saved to trade ${trade.displayCode}`);
        throw new Error(`Failed to save certificate path to trade ${trade.id}`);
      }

      // ✅ ALSO save certificatePath to buyer's investment (so it shows in mobile app)
      // The investment ID should be passed via the event, but we can also find it via buyerTransactionId
      let buyerInvestmentId: string | undefined;
      
      // Try to get investment ID from trade metadata if available
      if (trade.metadata?.buyerInvestmentId) {
        buyerInvestmentId = trade.metadata.buyerInvestmentId;
      }

      // If not in metadata, find it via buyerTransactionId
      if (!buyerInvestmentId && trade.buyerTransactionId) {
        const buyerTransaction = await this.transactionRepo.findOne({
          where: { id: trade.buyerTransactionId },
        });

        if (buyerTransaction && buyerTransaction.userId && buyerTransaction.propertyId) {
          // Find the most recent confirmed investment for this user/property
          const buyerInvestment = await this.investmentRepo.findOne({
            where: {
              userId: buyerTransaction.userId,
              propertyId: buyerTransaction.propertyId,
              status: 'confirmed',
            },
            order: { updatedAt: 'DESC' }, // Use updatedAt since marketplace updates existing investments
          });
          
          if (buyerInvestment) {
            buyerInvestmentId = buyerInvestment.id;
          }
        }
      }

      if (buyerInvestmentId) {
        // Update investment with certificate path
        await this.investmentRepo.update(
          { id: buyerInvestmentId },
          { certificatePath: fullPublicUrl }
        );

        // Verify it was saved
        const updatedInvestment = await this.investmentRepo.findOne({
          where: { id: buyerInvestmentId },
        });

        if (updatedInvestment?.certificatePath === fullPublicUrl) {
          this.logger.log(
            `[CertificatesService] ✅ Verified: Certificate path also saved to buyer's investment ${updatedInvestment.displayCode} (${buyerInvestmentId}): ${fullPublicUrl}`,
          );
        } else {
          this.logger.warn(
            `[CertificatesService] ⚠️ Warning: Certificate path NOT saved to buyer's investment ${buyerInvestmentId}`,
          );
        }
      } else {
        this.logger.warn(
          `[CertificatesService] ⚠️ Could not find buyer's investment for trade ${trade.displayCode} to save certificate path`,
        );
      }

      // Generate signed URL for immediate access
      const signedUrl = await this.supabaseService.getMarketplaceCertificateSignedUrl(uploadedPath);

      this.logger.log(`[CertificatesService] ✅ Marketplace trade certificate generated successfully: ${fullPublicUrl}`);

      return {
        certificatePath: fullPublicUrl, // Return full URL
        signedUrl,
      };
    } catch (error) {
      this.logger.error(`[CertificatesService] ❌ Error generating marketplace trade certificate:`, error.stack || error.message || error);
      throw error;
    }
  }

  /**
   * Get marketplace trade certificate signed URL
   */
  async getMarketplaceTradeCertificate(tradeId: string): Promise<string> {
    const trade = await this.marketplaceTradeRepo.findOne({
      where: { id: tradeId },
    });

    if (!trade) {
      throw new NotFoundException(`Marketplace trade ${tradeId} not found`);
    }

    if (!trade.certificatePath) {
      // Generate certificate if it doesn't exist
      const result = await this.generateMarketplaceTradeCertificate(tradeId);
      return result.signedUrl;
    }

    // Extract relative path from full URL
    if (trade.certificatePath.startsWith('http://') || trade.certificatePath.startsWith('https://')) {
      const urlParts = trade.certificatePath.split('/storage/v1/object/public/Marketplace/');
      const relativePath = urlParts.length > 1 ? urlParts[1] : trade.certificatePath;
      return await this.supabaseService.getMarketplaceCertificateSignedUrl(relativePath);
    } else {
      return await this.supabaseService.getMarketplaceCertificateSignedUrl(trade.certificatePath);
    }
  }

  /**
   * Generate ownership certificate with CURRENT token count for a user/property
   * This certificate reflects the current state of ownership, not individual transactions
   * Should be regenerated whenever tokens change (buy/sell)
   */
  async generateOwnershipCertificate(
    userId: string,
    propertyId: string,
    investmentId?: string,
    source: 'direct' | 'marketplace' = 'direct',
    sellerInfo?: { name: string; email: string },
    organizationName?: string,
  ): Promise<{
    certificatePath: string;
    signedUrl: string;
  }> {
    this.logger.log(`[CertificatesService] 🔄 Generating ownership certificate for user: ${userId}, property: ${propertyId}, source: ${source}`);

    try {
      // Load user and property
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }

      const property = await this.propertyRepo.findOne({
        where: { id: propertyId },
        relations: ['organization'],
      });
      if (!property) {
        throw new NotFoundException(`Property ${propertyId} not found`);
      }

      // Get ALL confirmed investments for this user/property to calculate CURRENT total tokens
      const allInvestments = await this.investmentRepo.find({
        where: {
          userId,
          propertyId,
          status: 'confirmed',
        },
      });

      // Calculate current total tokens and total invested amount
      let currentTotalTokens = new Decimal(0);
      let totalInvestedAmount = new Decimal(0);
      for (const inv of allInvestments) {
        currentTotalTokens = currentTotalTokens.plus(inv.tokensPurchased as Decimal);
        totalInvestedAmount = totalInvestedAmount.plus(inv.amountUSDT as Decimal);
      }

      if (currentTotalTokens.lte(0)) {
        throw new Error('User has no tokens for this property');
      }

      // Calculate ownership percentage
      const totalTokens = property.totalTokens || new Decimal(0);
      const ownershipPercentage = totalTokens.gt(0)
        ? currentTotalTokens.div(totalTokens).times(100)
        : new Decimal(0);

      // Calculate average price
      const averagePrice = currentTotalTokens.gt(0)
        ? totalInvestedAmount.div(currentTotalTokens)
        : new Decimal(0);

      // Get stamps
      const secpStampUrl = this.supabaseService.getAssetUrl('stamps/secp.png');
      const sbpStampUrl = this.supabaseService.getAssetUrl('stamps/sbp.png');

      // Determine ownership statement based on source
      let ownershipStatement = '';
      if (source === 'direct') {
        const orgName = organizationName || property.organization?.name || 'BLOCKS';
        ownershipStatement = `This certifies that ${user.fullName || user.email}, residing at ${user.email}, is the lawful holder of fractional tokenized ownership in the property described below. These tokens were purchased directly from ${orgName} (BLOCKS Platform).`;
      } else {
        const sellerName = sellerInfo?.name || 'Unknown Seller';
        ownershipStatement = `This certifies that ${user.fullName || user.email}, residing at ${user.email}, is the lawful holder of fractional tokenized ownership in the property described below. These tokens were purchased from the marketplace from ${sellerName} (${sellerInfo?.email || 'N/A'}).`;
      }

      // Prepare certificate data
      const certificateData = {
        department: 'Blocks Token Ownership Certificate',
        subDepartment: 'Certificate of Tokenized Property Ownership',
        boxNo: `OWN-${userId.substring(0, 8)}-${propertyId.substring(0, 8)}`,
        regNo: `REG-OWN-${Date.now()}`,
        ownerName: user.fullName || user.email,
        ownerAddress: user.email || 'N/A',
        propertyId: property.displayCode,
        location: `${property.city || ''}, ${property.country || ''}`.trim() || 'N/A',
        surveyNo: 'N/A',
        area: 'N/A',
        usage: property.type || 'N/A',
        tokensPurchased: currentTotalTokens.toString(), // CURRENT total tokens
        totalTokens: totalTokens.toString(),
        ownershipPercentage: ownershipPercentage.toFixed(8),
        tokenPrice: property.pricePerTokenUSDT?.toString() || '0',
        totalAmount: totalInvestedAmount.toString(), // Total invested amount
        averagePrice: averagePrice.toFixed(2),
        expectedROI: property.expectedROI?.toString() || '0', // Required by interface, even if not displayed
        authorityName: 'A. B. Registrar',
        designation: 'Registrar of Deeds',
        serial: `CERT-OWN-${userId.substring(0, 8)}-${propertyId.substring(0, 8)}-${Date.now()}`,
        date: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        secpStampUrl,
        sbpStampUrl,
        ownershipStatement, // Custom ownership statement
      };

      // Generate PDF
      const pdfBuffer = await this.pdfService.generateCertificate(certificateData);
      this.logger.log(`[CertificatesService] 📦 PDF generated (${pdfBuffer.length} bytes)`);

      // Upload to Supabase - fixed path per user+property (overwrites existing certificate)
      const filePath = `ownership/${userId}/${propertyId}.pdf`;
      this.logger.log(`[CertificatesService] ☁️ Uploading to Supabase (overwriting existing): ${filePath}`);
      
      const { path: uploadedPath } = await this.supabaseService.uploadCertificate(
        filePath,
        pdfBuffer,
      );

      // Get full public URL
      const fullPublicUrl = this.supabaseService.getCertificatePublicUrl(uploadedPath);
      this.logger.log(`[CertificatesService] 🔗 Full public URL: ${fullPublicUrl}`);

      // Update ALL investments for this user+property to point to the same certificate
      // This ensures all investments show the same certificate (one certificate per user+property)
      const updateResult = await this.investmentRepo.update(
        {
          userId,
          propertyId,
          status: 'confirmed',
        },
        { certificatePath: fullPublicUrl }
      );

      this.logger.log(
        `[CertificatesService] ✅ Updated ${updateResult.affected || 0} investment(s) with certificate path: ${fullPublicUrl}`,
      );

      // Verify at least one investment was updated
      if (updateResult.affected === 0) {
        this.logger.warn(
          `[CertificatesService] ⚠️ Warning: No investments found to update certificate path for user ${userId}, property ${propertyId}`,
        );
      } else {
        // Verify the update worked by checking one investment
        const sampleInvestment = await this.investmentRepo.findOne({
          where: {
            userId,
            propertyId,
            status: 'confirmed',
          },
        });

        if (sampleInvestment?.certificatePath === fullPublicUrl) {
          this.logger.log(
            `[CertificatesService] ✅ Verified: Certificate path saved to investments for user ${userId}, property ${propertyId}`,
          );
        }
      }

      // Generate signed URL
      const signedUrl = await this.supabaseService.createSignedUrl(uploadedPath);

      this.logger.log(`[CertificatesService] ✅ Ownership certificate generated successfully: ${fullPublicUrl}`);

      return {
        certificatePath: fullPublicUrl,
        signedUrl,
      };
    } catch (error) {
      this.logger.error(`[CertificatesService] ❌ Error generating ownership certificate:`, error.stack || error.message || error);
      throw error;
    }
  }

  /**
   * Generate transaction certificate for seller when they sell tokens via marketplace
   * This is a separate certificate type that shows the transfer/sale transaction
   */
  async generateTransactionCertificateForSeller(
    tradeId: string,
    sellerInvestmentId?: string,
  ): Promise<{
    certificatePath: string;
    signedUrl: string;
  }> {
    this.logger.log(`[CertificatesService] 🔄 Generating transaction certificate for seller, trade: ${tradeId}`);

    try {
      // Load trade with relations
      const trade = await this.marketplaceTradeRepo.findOne({
        where: { id: tradeId },
        relations: ['buyer', 'seller', 'property', 'property.organization', 'listing'],
      });

      if (!trade) {
        throw new NotFoundException(`Marketplace trade ${tradeId} not found`);
      }

      if (!trade.seller) {
        throw new NotFoundException('Trade seller not found');
      }

      if (!trade.property) {
        throw new NotFoundException('Trade property not found');
      }

      // Get seller's CURRENT token count after sale
      const sellerInvestments = await this.investmentRepo.find({
        where: {
          userId: trade.sellerId,
          propertyId: trade.propertyId,
          status: 'confirmed',
        },
      });

      let currentSellerTokens = new Decimal(0);
      for (const inv of sellerInvestments) {
        currentSellerTokens = currentSellerTokens.plus(inv.tokensPurchased as Decimal);
      }

      // Get stamps
      const secpStampUrl = this.supabaseService.getAssetUrl('stamps/secp.png');
      const sbpStampUrl = this.supabaseService.getAssetUrl('stamps/sbp.png');

      // Prepare transaction certificate data
      const certificateData = {
        department: 'Blocks Token Transaction Certificate',
        subDepartment: 'Certificate of Token Transfer',
        boxNo: trade.displayCode || 'N/A',
        regNo: `REG-TXN-${trade.displayCode}`,
        ownerName: trade.seller.fullName || trade.seller.email,
        ownerAddress: trade.seller.email || 'N/A',
        propertyId: trade.property.displayCode,
        location: `${trade.property.city || ''}, ${trade.property.country || ''}`.trim() || 'N/A',
        surveyNo: 'N/A',
        area: 'N/A',
        usage: trade.property.type || 'N/A',
        tokensPurchased: trade.tokensBought.toString(), // Tokens that were sold (required field)
        totalTokens: trade.property.totalTokens?.toString() || '0',
        ownershipPercentage: '0', // Not applicable for transaction certificate
        tokenPrice: trade.pricePerToken.toString(),
        totalAmount: trade.totalUSDT.toString(),
        averagePrice: trade.pricePerToken.toString(),
        expectedROI: trade.property.expectedROI?.toString() || '0',
        authorityName: 'A. B. Registrar',
        designation: 'Registrar of Deeds',
        serial: `CERT-TXN-${trade.displayCode}-${Date.now()}`,
        date: trade.createdAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        secpStampUrl,
        sbpStampUrl,
        // Transaction-specific fields (these are additional fields, not part of base CertificateData)
        tokensSold: trade.tokensBought.toString(), // Tokens that were sold
        tokensRemaining: currentSellerTokens.toString(), // Remaining tokens after sale
        buyerName: trade.buyer?.fullName || trade.buyer?.email || 'N/A',
        transactionType: 'Marketplace Sale',
        transactionStatement: `This certifies that ${trade.seller.fullName || trade.seller.email} has transferred ${trade.tokensBought.toString()} tokens of ${trade.property.title} to ${trade.buyer?.fullName || trade.buyer?.email || 'N/A'} via the BLOCKS Marketplace. After this transaction, ${trade.seller.fullName || trade.seller.email} retains ${currentSellerTokens.toString()} tokens of this property.`,
      };

      // Generate PDF
      const pdfBuffer = await this.pdfService.generateCertificate(certificateData);
      this.logger.log(`[CertificatesService] 📦 PDF generated (${pdfBuffer.length} bytes)`);

      // Upload to Supabase Marketplace bucket (for transaction certificates)
      const filePath = `transactions/sellers/${trade.sellerId}/${trade.id}.pdf`;
      this.logger.log(`[CertificatesService] ☁️ Uploading to Supabase Marketplace bucket: ${filePath}`);
      
      const { path: uploadedPath } = await this.supabaseService.uploadMarketplaceCertificate(
        filePath,
        pdfBuffer,
      );

      // Get full public URL
      const fullPublicUrl = this.supabaseService.getMarketplaceCertificatePublicUrl(uploadedPath);
      this.logger.log(`[CertificatesService] 🔗 Full public URL: ${fullPublicUrl}`);

      // Save to seller's transaction (if sellerTransactionId exists)
      if (trade.sellerTransactionId) {
        await this.transactionRepo.update(
          { id: trade.sellerTransactionId },
          { certificatePath: fullPublicUrl }
        );
        this.logger.log(`[CertificatesService] ✅ Transaction certificate saved to seller transaction ${trade.sellerTransactionId}`);
      }

      // Generate signed URL
      const signedUrl = await this.supabaseService.getMarketplaceCertificateSignedUrl(uploadedPath);

      this.logger.log(`[CertificatesService] ✅ Transaction certificate for seller generated successfully: ${fullPublicUrl}`);

      return {
        certificatePath: fullPublicUrl,
        signedUrl,
      };
    } catch (error) {
      this.logger.error(`[CertificatesService] ❌ Error generating transaction certificate for seller:`, error.stack || error.message || error);
      throw error;
    }
  }

  /**
   * Get seller transaction certificate signed URL
   */
  async getSellerTransactionCertificate(tradeId: string): Promise<string> {
    const trade = await this.marketplaceTradeRepo.findOne({
      where: { id: tradeId },
    });

    if (!trade) {
      throw new NotFoundException(`Marketplace trade ${tradeId} not found`);
    }

    // Check if seller transaction certificate exists (stored in sellerTransactionId)
    if (trade.sellerTransactionId) {
      const sellerTransaction = await this.transactionRepo.findOne({
        where: { id: trade.sellerTransactionId },
      });

      if (sellerTransaction?.certificatePath) {
        // Extract relative path from full URL
        if (sellerTransaction.certificatePath.startsWith('http://') || sellerTransaction.certificatePath.startsWith('https://')) {
          const urlParts = sellerTransaction.certificatePath.split('/storage/v1/object/public/Marketplace/');
          const relativePath = urlParts.length > 1 ? urlParts[1] : sellerTransaction.certificatePath;
          return await this.supabaseService.getMarketplaceCertificateSignedUrl(relativePath);
        } else {
          return await this.supabaseService.getMarketplaceCertificateSignedUrl(sellerTransaction.certificatePath);
        }
      }
    }

    // If certificate doesn't exist, generate it
    const result = await this.generateTransactionCertificateForSeller(tradeId);
    return result.signedUrl;
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

