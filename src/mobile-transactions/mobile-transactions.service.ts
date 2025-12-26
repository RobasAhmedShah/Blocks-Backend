import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { TransactionsService } from '../transactions/transactions.service';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionFilterDto } from './dto/transaction-filter.dto';
import Decimal from 'decimal.js';

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class MobileTransactionsService {
  constructor(
    private readonly transactionsService: TransactionsService,
    @InjectRepository(Transaction)
    private readonly txnRepo: Repository<Transaction>,
  ) {}

  async findByUserWithFilters(
    userId: string,
    query: TransactionFilterDto,
  ): Promise<PaginatedResponse<any>> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Check if userId is UUID or displayCode
    const isUserIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      userId,
    );

    let actualUserId = userId;
    if (!isUserIdUuid) {
      // Find user by displayCode to get their UUID
      const user = await this.txnRepo.manager
        .getRepository('User')
        .findOne({ where: { displayCode: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      actualUserId = user.id;
    }

    // Build query
    let qb = this.txnRepo
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.property', 'property')
      .where('transaction.userId = :userId', { userId: actualUserId });

    // Apply filters
    if (query.type) {
      qb = qb.andWhere('transaction.type = :type', { type: query.type });
    }

    if (query.status) {
      qb = qb.andWhere('transaction.status = :status', { status: query.status });
    }

    if (query.propertyId) {
      // Check if propertyId is UUID or displayCode
      const isPropertyUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        query.propertyId,
      );

      if (isPropertyUuid) {
        qb = qb.andWhere('transaction.propertyId = :propertyId', {
          propertyId: query.propertyId,
        });
      } else {
        // Find property by displayCode
        const property = await this.txnRepo.manager
          .getRepository('Property')
          .findOne({ where: { displayCode: query.propertyId } });
        if (property) {
          qb = qb.andWhere('transaction.propertyId = :propertyId', {
            propertyId: property.id,
          });
        } else {
          // Property not found, return empty result
          qb = qb.andWhere('1 = 0'); // Always false condition
        }
      }
    }

    // Get total count before pagination
    const total = await qb.getCount();

    // Apply pagination and ordering
    const transactions = await qb
      .orderBy('transaction.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    // Transform transactions with error handling
    const transformedTransactions = transactions
      .map((txn) => {
        try {
          return this.transformTransaction(txn);
        } catch (error) {
          console.error(`[MobileTransactionsService] Error transforming transaction ${txn.id}:`, error);
          return null;
        }
      })
      .filter((txn) => txn !== null); // Remove failed transformations

    return {
      data: transformedTransactions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private transformTransaction(transaction: Transaction): any {
    // Map transaction type to mobile app format
    // Backend types: 'deposit' | 'withdrawal' | 'investment' | 'return' | 'fee' | 'reward' | 'inflow'
    // Frontend types: 'deposit' | 'withdraw' | 'investment' | 'rental_income' | 'rental' | 'transfer'
    let type: string = transaction.type;
    
    const typeMapping: Record<string, string> = {
      'deposit': 'deposit',
      'withdrawal': 'withdraw',
      'investment': 'investment',
      'reward': 'rental_income', // Map reward to rental_income for mobile
      'return': 'rental_income', // Map return to rental_income as well
      'inflow': 'deposit', // Map inflow to deposit
      'fee': 'withdraw', // Map fee to withdraw (money going out)
      'marketplace_buy': 'investment', // Map marketplace_buy to investment (money going out)
      'marketplace_sell': 'deposit', // Map marketplace_sell to deposit (money coming in)
    };
    
    type = typeMapping[transaction.type] || transaction.type;

    // ✅ Safe Decimal conversion with null checks
    const amountUSDT = transaction.amountUSDT 
      ? new Decimal(transaction.amountUSDT) 
      : new Decimal(0);
    
    // Mobile app expects:
    // - Positive amounts for deposits, rental income, and marketplace_sell (money coming in)
    // - Negative amounts for withdrawals, investments, and marketplace_buy (money going out)
    let amount = amountUSDT.toNumber();
    
    if (transaction.type === 'investment' || 
        transaction.type === 'withdrawal' || 
        transaction.type === 'fee' ||
        transaction.type === 'marketplace_buy') {
      // Money going out: investments, withdrawals, fees, marketplace purchases
      amount = -Math.abs(amount);
    } else {
      // Money coming in: deposits, rewards, returns, inflows, marketplace sales
      amount = Math.abs(amount);
    }

    // Clean description to remove BWR- and BTR- codes (hide from users)
    let description = transaction.description || this.generateDescription(transaction);
    // Remove BWR-XXXXXX and BTR-XXXXXX patterns from description
    description = description.replace(/\s*-\s*(BWR|BTR)-\d+/gi, '').trim();
    
    return {
      id: transaction.id,
      type,
      amount,
      date: transaction.createdAt.toISOString(), // Convert Date to ISO string
      description,
      status: transaction.status,
      currency: 'USDC',
      propertyId: transaction.propertyId || undefined,
      propertyTitle: transaction.property?.title || undefined,
      metadata: transaction.metadata || undefined, // Include metadata for bank transaction IDs
    };
  }

  private generateDescription(transaction: Transaction): string {
    if (transaction.description) {
      return transaction.description;
    }

    const typeMap: Record<string, string> = {
      deposit: 'Wallet deposit',
      withdrawal: 'Withdrawal',
      investment: `Investment in ${transaction.property?.title || 'property'}`,
      return: 'Return on investment',
      fee: 'Transaction fee',
      reward: `Rental income from ${transaction.property?.title || 'property'}`,
      inflow: 'Funds received',
      marketplace_buy: `Purchased tokens from marketplace${transaction.property?.title ? ` - ${transaction.property.title}` : ''}`,
      marketplace_sell: `Sold tokens on marketplace${transaction.property?.title ? ` - ${transaction.property.title}` : ''}`,
    };

    return typeMap[transaction.type] || 'Transaction';
  }
}

