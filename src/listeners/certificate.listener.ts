import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { InvestmentCompletedEvent } from '../events/investment.events';
import { CertificatesService } from '../certificates/certificates.service';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Investment } from '../investments/entities/investment.entity';

@Injectable()
export class CertificateListener {
  private readonly logger = new Logger(CertificateListener.name);

  constructor(
    private readonly certificatesService: CertificatesService,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Investment)
    private readonly investmentRepo: Repository<Investment>,
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

      // Generate certificate asynchronously (don't block)
      // Use await to ensure errors are caught properly
      try {
        const result = await this.certificatesService.generateTransactionCertificate(
          transaction.id,
          event.investmentId, // Pass the specific investment ID to save certificate to
        );
        this.logger.log(
          `[CertificateListener] ✅ Certificate generated successfully for transaction ${transaction.displayCode}: ${result.certificatePath}`,
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
          `[CertificateListener] ❌ Failed to generate certificate for transaction ${transaction.id}:`,
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
}

