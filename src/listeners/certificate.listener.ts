import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { InvestmentCompletedEvent } from '../events/investment.events';
import type { MarketplaceTradeCompletedEvent } from '../events/marketplace.events';
import { CertificatesService } from '../certificates/certificates.service';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Investment } from '../investments/entities/investment.entity';
import { MarketplaceTrade } from '../marketplace/entities/marketplace-trade.entity';
import { Property } from '../properties/entities/property.entity';

@Injectable()
export class CertificateListener {
  private readonly logger = new Logger(CertificateListener.name);

  constructor(
    private readonly certificatesService: CertificatesService,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Investment)
    private readonly investmentRepo: Repository<Investment>,
    @InjectRepository(MarketplaceTrade)
    private readonly marketplaceTradeRepo: Repository<MarketplaceTrade>,
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
  ) {}

  /**
   * Auto-generate transaction certificate when investment is completed
   */
  @OnEvent('investment.completed', { async: true })
  async handleInvestmentCompleted(event: InvestmentCompletedEvent) {
    try {
      this.logger.log(
        `[CertificateListener] 📨 Event received for investment: ${event.investmentDisplayCode}, transaction: ${event.transactionDisplayCode || 'N/A'}, userId: ${event.userId}, propertyId: ${event.propertyId}`,
      );

      // ✅ Add delay to ensure transaction is committed and visible
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Use transactionId from event if available, otherwise search for it
      let transaction;
      if (event.transactionId) {
        // Direct lookup by transaction ID (more reliable)
        transaction = await this.transactionRepo.findOne({
          where: { id: event.transactionId },
          relations: ['user', 'property'],
        });
        
        if (!transaction) {
          this.logger.warn(
            `[CertificateListener] ⚠️ Transaction ${event.transactionId} not found, trying search method...`,
          );
        }
      }

      // Fallback: Search for transaction if direct lookup failed or transactionId not provided
      if (!transaction) {
        transaction = await this.transactionRepo.findOne({
          where: {
            userId: event.userId,
            propertyId: event.propertyId,
            type: 'investment',
            status: 'completed',
          },
          order: { createdAt: 'DESC' },
          relations: ['user', 'property'],
        });
      }

      if (!transaction) {
        this.logger.error(
          `[CertificateListener] ❌ No transaction found for investment ${event.investmentDisplayCode}. ` +
          `Searched for: transactionId=${event.transactionId || 'N/A'}, userId=${event.userId}, propertyId=${event.propertyId}, type=investment, status=completed`,
        );
        
        // Try to find ANY transaction for this user/property for debugging
        const anyTransaction = await this.transactionRepo.find({
          where: {
            userId: event.userId,
            propertyId: event.propertyId,
          },
          order: { createdAt: 'DESC' },
          take: 5,
        });
        
        this.logger.log(
          `[CertificateListener] Found ${anyTransaction.length} transactions for user/property:`,
          anyTransaction.map(t => ({
            id: t.id,
            displayCode: t.displayCode,
            type: t.type,
            status: t.status,
            createdAt: t.createdAt,
          })),
        );
        
        return;
      }

      this.logger.log(
        `[CertificateListener] ✅ Found transaction: ${transaction.displayCode} (${transaction.id})`,
      );

      // Generate ownership certificate with CURRENT token count (not per transaction)
      // Use await to ensure errors are caught properly
      try {
        // Get property organization name for certificate
        const property = await this.propertyRepo.findOne({
          where: { id: event.propertyId },
          relations: ['organization'],
        });

        const result = await this.certificatesService.generateOwnershipCertificate(
          event.userId,
          event.propertyId,
          event.investmentId, // Pass the specific investment ID to save certificate to
          'direct', // Direct purchase from BLOCKS
          undefined, // No seller info for direct purchases
          property?.organization?.name,
        );
        this.logger.log(
          `[CertificateListener] ✅ Ownership certificate generated successfully for investment ${event.investmentDisplayCode}: ${result.certificatePath}`,
        );
        
        // Verify the certificatePath was saved to the investment
        if (event.investmentId) {
          const investment = await this.investmentRepo.findOne({
            where: { id: event.investmentId },
          });
          
          if (investment && investment.certificatePath) {
            this.logger.log(
              `[CertificateListener] ✅ Verified: Certificate path saved to investment ${event.investmentDisplayCode} (${event.investmentId}): ${investment.certificatePath}`,
            );
          } else {
            this.logger.warn(
              `[CertificateListener] ⚠️ Warning: Certificate path NOT found in investment ${event.investmentDisplayCode} (${event.investmentId}) after generation. Expected: ${result.certificatePath}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `[CertificateListener] ❌ Failed to generate ownership certificate for investment ${event.investmentId}:`,
          error.stack || error.message || error,
        );
        // Log full error details
        console.error('[CertificateListener] Full error:', error);
        // Don't throw - certificate generation failure shouldn't break the system
      }
    } catch (error) {
      this.logger.error('[CertificateListener] ❌ Failed to handle certificate generation:', error);
      console.error('[CertificateListener] Full error:', error);
      // Don't throw - certificate generation failure shouldn't break the system
    }
  }

  /**
   * Auto-generate certificates when marketplace trade is completed
   * 1. Generate ownership certificate for buyer (with current token count)
   * 2. Generate transaction certificate for seller
   * 3. Regenerate ownership certificate for seller (with updated token count after sale)
   */
  @OnEvent('marketplace.trade.completed', { async: true })
  async handleMarketplaceTradeCompleted(event: MarketplaceTradeCompletedEvent) {
    try {
      this.logger.log(
        `[CertificateListener] 📨 Marketplace trade completed event received: ${event.tradeDisplayCode}, buyer: ${event.buyerId}, seller: ${event.sellerId}`,
      );

      // Add delay to ensure transaction is committed and trade is visible
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Load trade to get seller and property info
      const trade = await this.marketplaceTradeRepo.findOne({
        where: { id: event.tradeId },
        relations: ['buyer', 'seller', 'property', 'property.organization'],
      });

      if (!trade) {
        this.logger.error(`[CertificateListener] ❌ Trade ${event.tradeId} not found`);
        return;
      }

      // 1. Generate ownership certificate for BUYER (with current token count, source: marketplace)
      try {
        const buyerOwnershipResult = await this.certificatesService.generateOwnershipCertificate(
          event.buyerId,
          event.propertyId,
          event.buyerInvestmentId,
          'marketplace',
          {
            name: trade.seller?.fullName || trade.seller?.email || 'Unknown Seller',
            email: trade.seller?.email || 'N/A',
          },
          trade.property?.organization?.name,
        );
        this.logger.log(
          `[CertificateListener] ✅ Buyer ownership certificate generated successfully for trade ${event.tradeDisplayCode}: ${buyerOwnershipResult.certificatePath}`,
        );
      } catch (error) {
        this.logger.error(
          `[CertificateListener] ❌ Failed to generate buyer ownership certificate for trade ${event.tradeId}:`,
          error.stack || error.message || error,
        );
      }

      // 2. Generate transaction certificate for SELLER
      try {
        const sellerTransactionResult = await this.certificatesService.generateTransactionCertificateForSeller(
          event.tradeId,
          event.sellerInvestmentId,
        );
        this.logger.log(
          `[CertificateListener] ✅ Seller transaction certificate generated successfully for trade ${event.tradeDisplayCode}: ${sellerTransactionResult.certificatePath}`,
        );
      } catch (error) {
        this.logger.error(
          `[CertificateListener] ❌ Failed to generate seller transaction certificate for trade ${event.tradeId}:`,
          error.stack || error.message || error,
        );
      }

      // 3. Regenerate ownership certificate for SELLER (with updated token count after sale)
      try {
        const sellerOwnershipResult = await this.certificatesService.generateOwnershipCertificate(
          event.sellerId,
          event.propertyId,
          event.sellerInvestmentId,
          'direct', // Seller's remaining tokens are from direct purchase
          undefined,
          trade.property?.organization?.name,
        );
        this.logger.log(
          `[CertificateListener] ✅ Seller ownership certificate regenerated successfully for trade ${event.tradeDisplayCode}: ${sellerOwnershipResult.certificatePath}`,
        );
      } catch (error) {
        this.logger.error(
          `[CertificateListener] ❌ Failed to regenerate seller ownership certificate for trade ${event.tradeId}:`,
          error.stack || error.message || error,
        );
      }
    } catch (error) {
      this.logger.error('[CertificateListener] ❌ Failed to handle marketplace trade certificate generation:', error);
      console.error('[CertificateListener] Full error:', error);
      // Don't throw - certificate generation failure shouldn't break the system
    }
  }
}

