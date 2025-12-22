import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BankWithdrawalRequest } from './entities/bank-withdrawal-request.entity';
import { CreateBankWithdrawalDto } from './dto/create-bank-withdrawal.dto';
import { CompleteBankWithdrawalDto } from './dto/complete-bank-withdrawal.dto';
import { RejectBankWithdrawalDto } from './dto/reject-bank-withdrawal.dto';
import { User } from '../admin/entities/user.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import Decimal from 'decimal.js';

@Injectable()
export class BankWithdrawalsService {
  private readonly logger = new Logger(BankWithdrawalsService.name);

  constructor(
    @InjectRepository(BankWithdrawalRequest)
    private readonly withdrawalRepo: Repository<BankWithdrawalRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a new withdrawal request
   * Checks balance before allowing request
   */
  async createRequest(userId: string, dto: CreateBankWithdrawalDto): Promise<BankWithdrawalRequest> {
    // Verify user exists
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check wallet balance
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const amountUSDT = new Decimal(dto.amountUSDT);
    const currentBalance = wallet.balanceUSDT as Decimal;

    // Check if user has sufficient balance
    if (currentBalance.lessThan(amountUSDT)) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${currentBalance.toString()} USDT, Requested: ${amountUSDT.toString()} USDT`,
      );
    }

    // Generate display code (BWR-000001, BWR-000002, etc.)
    const seqResult = await this.withdrawalRepo.query(
      "SELECT nextval('bank_withdrawal_display_seq') as nextval",
    );
    const displayCode = `BWR-${seqResult[0].nextval.toString().padStart(6, '0')}`;

    // Create withdrawal request
    const requestData: Partial<BankWithdrawalRequest> = {
      displayCode,
      userId,
      amountUSDT,
      currency: 'USDT',
      userBankAccountName: dto.userBankAccountName,
      userBankAccountNumber: dto.userBankAccountNumber,
      userBankIban: dto.userBankIban || undefined,
      userBankName: dto.userBankName,
      userBankSwiftCode: dto.userBankSwiftCode || undefined,
      userBankBranch: dto.userBankBranch || undefined,
      status: 'pending',
      description: `Bank withdrawal request for ${dto.amountUSDT} USDT to ${dto.userBankAccountName}`,
    };

    const request = this.withdrawalRepo.create(requestData);
    const savedRequest = await this.withdrawalRepo.save(request);

    this.logger.log(`Bank withdrawal request created: ${displayCode} for user ${user.displayCode}`);

    return savedRequest;
  }

  /**
   * Get all withdrawal requests (admin)
   */
  async getAllRequests(status?: 'pending' | 'completed' | 'rejected'): Promise<BankWithdrawalRequest[]> {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    return this.withdrawalRepo.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get user's withdrawal requests
   */
  async getUserRequests(userId: string): Promise<BankWithdrawalRequest[]> {
    return this.withdrawalRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get withdrawal request by ID
   */
  async getRequestById(id: string): Promise<BankWithdrawalRequest> {
    const request = await this.withdrawalRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!request) {
      throw new NotFoundException('Withdrawal request not found');
    }

    return request;
  }

  /**
   * Complete withdrawal (admin confirms transfer and debits wallet)
   */
  async completeWithdrawal(
    requestId: string,
    adminId: string,
    dto: CompleteBankWithdrawalDto,
  ): Promise<BankWithdrawalRequest> {
    return this.dataSource.transaction(async (manager) => {
      const requests = manager.getRepository(BankWithdrawalRequest);
      const wallets = manager.getRepository(Wallet);
      const transactions = manager.getRepository(Transaction);
      const users = manager.getRepository(User);

      const request = await requests.findOne({
        where: { id: requestId },
        relations: ['user'],
      });

      if (!request) {
        throw new NotFoundException('Withdrawal request not found');
      }

      if (request.status !== 'pending') {
        throw new BadRequestException(`Request is already ${request.status}`);
      }

      // Verify user and wallet still exist
      const user = await users.findOne({ where: { id: request.userId } });
      if (!user) throw new NotFoundException('User not found');

      const wallet = await wallets.findOne({ where: { userId: request.userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      // Double-check balance (in case it changed since request was created)
      const amountUSDT = new Decimal(request.amountUSDT);
      const currentBalance = wallet.balanceUSDT as Decimal;

      if (currentBalance.lessThan(amountUSDT)) {
        throw new BadRequestException(
          `Insufficient balance. Available: ${currentBalance.toString()} USDT, Requested: ${amountUSDT.toString()} USDT`,
        );
      }

      // Debit wallet
      wallet.balanceUSDT = currentBalance.minus(amountUSDT);
      const currentTotalWithdrawn = (wallet.totalWithdrawnUSDT as Decimal) || new Decimal(0);
      wallet.totalWithdrawnUSDT = currentTotalWithdrawn.plus(amountUSDT);
      await wallets.save(wallet);

      // Generate transaction display code
      const txnResult = await transactions.query(
        "SELECT nextval('transaction_display_seq') as nextval",
      );
      const txnDisplayCode = `TXN-${txnResult[0].nextval.toString().padStart(6, '0')}`;

      // Create withdrawal transaction
      // Note: Description uses bankTransactionId (not BWR- code) for user-facing display
      const transaction = transactions.create({
        userId: request.userId,
        walletId: wallet.id,
        type: 'withdrawal',
        amountUSDT: amountUSDT,
        status: 'completed',
        description: `Bank withdrawal completed - Transaction ID: ${dto.bankTransactionId}`,
        displayCode: txnDisplayCode,
        referenceId: request.displayCode, // Keep BWR- code in referenceId for internal tracking
        metadata: {
          bankWithdrawalRequestId: request.id,
          bankTransactionId: dto.bankTransactionId,
          userBankAccountName: request.userBankAccountName,
          userBankAccountNumber: request.userBankAccountNumber,
        },
      });
      const savedTransaction = await transactions.save(transaction);

      // Update request
      request.status = 'completed';
      request.reviewedBy = adminId;
      request.reviewedAt = new Date();
      request.bankTransactionId = dto.bankTransactionId;
      request.bankTransactionProofUrl = dto.bankTransactionProofUrl || undefined;
      request.transactionId = savedTransaction.id;
      const updatedRequest = await requests.save(request);

      this.logger.log(
        `Bank withdrawal request ${request.displayCode} completed by admin ${adminId}. Wallet debited ${amountUSDT} USDT. Bank transaction ID: ${dto.bankTransactionId}`,
      );

      return updatedRequest;
    });
  }

  /**
   * Reject withdrawal request
   */
  async rejectWithdrawal(
    requestId: string,
    adminId: string,
    dto: RejectBankWithdrawalDto,
  ): Promise<BankWithdrawalRequest> {
    const request = await this.withdrawalRepo.findOne({
      where: { id: requestId },
      relations: ['user'],
    });

    if (!request) {
      throw new NotFoundException('Withdrawal request not found');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException(`Request is already ${request.status}`);
    }

    request.status = 'rejected';
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    request.rejectionReason = dto.rejectionReason;

    const updatedRequest = await this.withdrawalRepo.save(request);

    this.logger.log(
      `Bank withdrawal request ${request.displayCode} rejected by admin ${adminId}. Reason: ${dto.rejectionReason}`,
    );

    return updatedRequest;
  }
}


