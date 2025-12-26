import { Controller, Get, Param, Query, NotFoundException, Post } from '@nestjs/common';
import { CertificatesService } from '../certificates/certificates.service';
import { Public } from '../common/decorators/public.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Investment } from '../investments/entities/investment.entity';

@Controller('api/mobile/certificates')
@Public()
export class MobileCertificatesController {
  constructor(
    private readonly certificatesService: CertificatesService,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Investment)
    private readonly investmentRepo: Repository<Investment>,
  ) {}

  /**
   * Get transaction certificate
   * GET /api/mobile/certificates/transactions/:transactionId
   */
  @Get('transactions/:transactionId')
  async getTransactionCertificate(
    @Param('transactionId') transactionId: string,
  ) {
    try {
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
        throw new NotFoundException(`Transaction not found: ${transactionId}`);
      }

      // Use actual transaction ID (UUID) for certificate service
      // The service will load relations and generate certificate if needed
      const actualTransactionId = transaction.id;
      const signedUrl = await this.certificatesService.getTransactionCertificate(actualTransactionId);
      return {
        success: true,
        transactionId: actualTransactionId,
        pdfUrl: signedUrl,
      };
    } catch (error) {
      // Log the error for debugging
      console.error('Certificate API Error:', error);
      
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      // Return more detailed error message
      const errorMessage = error?.message || 'Failed to get transaction certificate';
      throw new NotFoundException(errorMessage);
    }
  }

  /**
   * Get property legal document
   * GET /api/mobile/certificates/properties/:propertyId/legal-document
   */
  @Get('properties/:propertyId/legal-document')
  async getPropertyLegalDocument(@Param('propertyId') propertyId: string) {
    try {
      const pdfUrl = await this.certificatesService.getPropertyLegalDocument(propertyId);
      if (!pdfUrl) {
        throw new NotFoundException('Property legal document not found');
      }
      return {
        success: true,
        propertyId,
        pdfUrl,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Failed to get property legal document');
    }
  }

  /**
   * Generate portfolio summary certificate
   * GET /api/mobile/certificates/portfolio/:propertyId?userId=xxx
   */
  @Get('portfolio/:propertyId')
  async generatePortfolioSummary(
    @Param('propertyId') propertyId: string,
    @Query('userId') userId?: string,
  ) {
    try {
      // If userId is not provided, we can't generate portfolio summary
      if (!userId) {
        throw new NotFoundException('User ID is required as query parameter: ?userId=xxx');
      }

      const result = await this.certificatesService.generatePortfolioSummary(
        userId,
        propertyId,
      );
      return {
        success: true,
        propertyId,
        pdfUrl: result.signedUrl,
        certificatePath: result.certificatePath,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Failed to generate portfolio summary certificate');
    }
  }

  /**
   * TEST ENDPOINT: Manually generate certificate for a transaction
   * POST /api/mobile/certificates/test/generate/:transactionId
   */
  @Post('test/generate/:transactionId')
  async testGenerateCertificate(@Param('transactionId') transactionId: string) {
    try {
      // Support both UUID and displayCode
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transactionId);
      let transaction;
      
      if (isUuid) {
        transaction = await this.transactionRepo.findOne({
          where: { id: transactionId },
          relations: ['user', 'property'],
        });
      } else {
        transaction = await this.transactionRepo.findOne({
          where: { displayCode: transactionId },
          relations: ['user', 'property'],
        });
      }

      if (!transaction) {
        throw new NotFoundException(`Transaction not found: ${transactionId}`);
      }

      // Get investment ID if available
      let investmentId: string | undefined;
      if (transaction.userId && transaction.propertyId) {
        const investment = await this.investmentRepo.findOne({
          where: {
            userId: transaction.userId,
            propertyId: transaction.propertyId,
          },
          order: { createdAt: 'DESC' },
        });
        investmentId = investment?.id;
      }

      // Generate certificate
      const result = await this.certificatesService.generateTransactionCertificate(
        transaction.id,
        investmentId,
      );

      // Verify what was saved
      const updatedTransaction = await this.transactionRepo.findOne({
        where: { id: transaction.id },
      });

      const updatedInvestment = investmentId 
        ? await this.investmentRepo.findOne({
            where: { id: investmentId },
          })
        : null;

      return {
        success: true,
        message: 'Certificate generated successfully',
        certificate: {
          certificatePath: result.certificatePath,
          signedUrl: result.signedUrl,
        },
        databaseCheck: {
          transaction: {
            id: updatedTransaction?.id,
            displayCode: updatedTransaction?.displayCode,
            certificatePath: updatedTransaction?.certificatePath,
            saved: !!updatedTransaction?.certificatePath,
          },
          investment: updatedInvestment ? {
            id: updatedInvestment.id,
            displayCode: updatedInvestment.displayCode,
            certificatePath: updatedInvestment.certificatePath,
            saved: !!updatedInvestment.certificatePath,
          } : null,
        },
      };
    } catch (error) {
      console.error('Test certificate generation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate certificate',
        stack: error.stack,
      };
    }
  }

  /**
   * TEST ENDPOINT: Check certificate path in database
   * GET /api/mobile/certificates/test/check/:transactionId
   */
  @Get('test/check/:transactionId')
  async testCheckCertificate(@Param('transactionId') transactionId: string) {
    try {
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
        throw new NotFoundException(`Transaction not found: ${transactionId}`);
      }

      // Get related investment
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

      return {
        success: true,
        transaction: {
          id: transaction.id,
          displayCode: transaction.displayCode,
          userId: transaction.userId,
          propertyId: transaction.propertyId,
          certificatePath: transaction.certificatePath,
          hasCertificatePath: !!transaction.certificatePath,
        },
        investment: investment ? {
          id: investment.id,
          displayCode: investment.displayCode,
          userId: investment.userId,
          propertyId: investment.propertyId,
          certificatePath: investment.certificatePath,
          hasCertificatePath: !!investment.certificatePath,
        } : null,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to check certificate',
      };
    }
  }

  /**
   * Get marketplace trade certificate (buyer's ownership certificate)
   * GET /api/mobile/certificates/marketplace-trades/:tradeId
   */
  @Get('marketplace-trades/:tradeId')
  async getMarketplaceTradeCertificate(@Param('tradeId') tradeId: string) {
    try {
      const signedUrl = await this.certificatesService.getMarketplaceTradeCertificate(tradeId);
      return {
        success: true,
        certificateUrl: signedUrl,
      };
    } catch (error) {
      console.error('Marketplace trade certificate API Error:', error);
      const errorMessage = error?.message || 'Failed to get marketplace trade certificate';
      throw new NotFoundException(errorMessage);
    }
  }

  /**
   * Get transaction certificate for seller (when they sold tokens)
   * GET /api/mobile/certificates/transactions/seller/:tradeId
   */
  @Get('transactions/seller/:tradeId')
  async getSellerTransactionCertificate(@Param('tradeId') tradeId: string) {
    try {
      const signedUrl = await this.certificatesService.getSellerTransactionCertificate(tradeId);
      return {
        success: true,
        certificateUrl: signedUrl,
      };
    } catch (error) {
      console.error('Seller transaction certificate API Error:', error);
      const errorMessage = error?.message || 'Failed to get seller transaction certificate';
      throw new NotFoundException(errorMessage);
    }
  }
}
