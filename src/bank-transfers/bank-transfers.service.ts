import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BankTransferRequest } from './entities/bank-transfer-request.entity';
import { CreateBankTransferRequestDto } from './dto/create-bank-transfer-request.dto';
import { ReviewBankTransferDto } from './dto/review-bank-transfer.dto';
import { User } from '../admin/entities/user.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { SupabaseService } from '../supabase/supabase.service';
import { SettingsService } from '../settings/settings.service';
import Decimal from 'decimal.js';

@Injectable()
export class BankTransfersService {
  private readonly logger = new Logger(BankTransfersService.name);

  constructor(
    @InjectRepository(BankTransferRequest)
    private readonly bankTransferRepo: Repository<BankTransferRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly supabaseService: SupabaseService,
    private readonly settingsService: SettingsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get bank account details for display to users (from database with env fallback)
   */
  async getBankAccountDetails() {
    return this.settingsService.getBankAccountDetails();
  }

  /**
   * Create a new bank transfer request
   */
  async createRequest(userId: string, dto: CreateBankTransferRequestDto): Promise<BankTransferRequest> {
    // Verify user exists
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate display code
    const seqResult = await this.bankTransferRepo.query(
      "SELECT nextval('bank_transfer_display_seq') as nextval",
    );
    const displayCode = `BTR-${seqResult[0].nextval.toString().padStart(6, '0')}`;

    // Get bank account details once
    const bankDetails = await this.getBankAccountDetails();

    // Create request
    const requestData: Partial<BankTransferRequest> = {
      displayCode,
      userId,
      amountUSDT: new Decimal(dto.amountUSDT),
      currency: 'USDT',
      bankAccountName: bankDetails.accountName,
      bankAccountNumber: bankDetails.accountNumber,
      bankIban: bankDetails.iban || undefined,
      bankName: bankDetails.bankName,
      bankSwiftCode: bankDetails.swiftCode || undefined,
      bankBranch: bankDetails.branch || undefined,
      proofImageUrl: dto.proofImageUrl, // Will be Supabase URL after upload
      status: 'pending',
      description: `Bank transfer deposit request for ${dto.amountUSDT} USDT`,
    };

    const request = this.bankTransferRepo.create(requestData);
    const savedRequest = await this.bankTransferRepo.save(request);

    this.logger.log(`Bank transfer request created: ${displayCode} for user ${user.displayCode}`);

    return savedRequest;
  }

  /**
   * Upload proof image and return Supabase URL
   */
  async uploadProof(
    userId: string,
    requestId: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<string> {
    try {
      const result = await this.supabaseService.uploadBankTransferReceipt(
        userId,
        requestId,
        fileBuffer,
        contentType,
      );

      // Update request with proof URL
      await this.bankTransferRepo.update(requestId, {
        proofImageUrl: result.publicUrl,
      });

      return result.publicUrl;
    } catch (error) {
      this.logger.error(`Failed to upload proof for request ${requestId}:`, error);
      throw new BadRequestException(`Failed to upload proof: ${error.message}`);
    }
  }

  /**
   * Get all bank transfer requests (admin)
   */
  async getAllRequests(params?: {
    status?: 'pending' | 'approved' | 'rejected';
    userId?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = this.bankTransferRepo
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.user', 'user')
      .leftJoinAndSelect('request.reviewer', 'reviewer')
      .leftJoinAndSelect('request.transaction', 'transaction')
      .orderBy('request.createdAt', 'DESC');

    if (params?.status) {
      query.andWhere('request.status = :status', { status: params.status });
    }

    if (params?.userId) {
      query.andWhere('request.userId = :userId', { userId: params.userId });
    }

    if (params?.limit) {
      query.limit(params.limit);
    }

    if (params?.offset) {
      query.offset(params.offset);
    }

    return query.getMany();
  }

  /**
   * Get user's bank transfer requests
   */
  async getUserRequests(userId: string) {
    return this.bankTransferRepo.find({
      where: { userId },
      relations: ['transaction'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get single request by ID
   */
  async getRequestById(id: string): Promise<BankTransferRequest> {
    const request = await this.bankTransferRepo.findOne({
      where: { id },
      relations: ['user', 'reviewer', 'transaction'],
    });

    if (!request) {
      throw new NotFoundException('Bank transfer request not found');
    }

    return request;
  }

  /**
   * Review (approve/reject) bank transfer request
   */
  async reviewRequest(
    requestId: string,
    adminId: string,
    dto: ReviewBankTransferDto,
  ): Promise<BankTransferRequest> {
    const request = await this.bankTransferRepo.findOne({
      where: { id: requestId },
      relations: ['user'],
    });

    if (!request) {
      throw new NotFoundException('Bank transfer request not found');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException(`Request is already ${request.status}`);
    }

    // Note: adminId is from blocks_admins table, not users table
    // We don't need to verify admin exists since it's coming from authenticated session
    // Just use the adminId directly for the reviewed_by field

    if (dto.status === 'approved') {
      return this.approveRequest(request, adminId);
    } else {
      return this.rejectRequest(request, adminId, dto.rejectionReason);
    }
  }

  /**
   * Approve request and credit wallet
   */
  private async approveRequest(
    request: BankTransferRequest,
    adminId: string,
  ): Promise<BankTransferRequest> {
    return this.dataSource.transaction(async (manager) => {
      const wallets = manager.getRepository(Wallet);
      const transactions = manager.getRepository(Transaction);
      const requests = manager.getRepository(BankTransferRequest);
      const users = manager.getRepository(User);

      // Get user and wallet
      const user = await users.findOne({ where: { id: request.userId } });
      if (!user) throw new NotFoundException('User not found');

      const wallet = await wallets.findOne({ where: { userId: request.userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      // Credit wallet
      const amountUSDT = new Decimal(request.amountUSDT);
      wallet.balanceUSDT = (wallet.balanceUSDT as Decimal).plus(amountUSDT);
      wallet.totalDepositedUSDT = (wallet.totalDepositedUSDT as Decimal).plus(amountUSDT);
      await wallets.save(wallet);

      // Generate transaction display code
      const txnResult = await transactions.query(
        "SELECT nextval('transaction_display_seq') as nextval",
      );
      const txnDisplayCode = `TXN-${txnResult[0].nextval.toString().padStart(6, '0')}`;

      // Create transaction
      const transaction = transactions.create({
        userId: request.userId,
        walletId: wallet.id,
        type: 'deposit',
        amountUSDT: amountUSDT,
        status: 'completed',
        description: `Bank transfer deposit approved - ${request.displayCode}`,
        displayCode: txnDisplayCode,
        referenceId: request.displayCode,
        metadata: {
          bankTransferRequestId: request.id,
          bankAccountName: request.bankAccountName,
          bankAccountNumber: request.bankAccountNumber,
        },
      });
      const savedTransaction = await transactions.save(transaction);

      // Update request
      request.status = 'approved';
      request.reviewedBy = adminId;
      request.reviewedAt = new Date();
      request.transactionId = savedTransaction.id;
      const updatedRequest = await requests.save(request);

      this.logger.log(
        `Bank transfer request ${request.displayCode} approved by admin ${adminId}. Wallet credited ${amountUSDT} USDT.`,
      );

      return updatedRequest;
    });
  }

  /**
   * Reject request
   */
  private async rejectRequest(
    request: BankTransferRequest,
    adminId: string,
    rejectionReason?: string,
  ): Promise<BankTransferRequest> {
    request.status = 'rejected';
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    request.rejectionReason = rejectionReason || 'Request rejected by admin';

    const updatedRequest = await this.bankTransferRepo.save(request);

    this.logger.log(
      `Bank transfer request ${request.displayCode} rejected by admin ${adminId}. Reason: ${rejectionReason || 'Not specified'}`,
    );

    return updatedRequest;
  }

  /**
   * Get signed URL for proof image (for private bucket access)
   */
  async getProofSignedUrl(proofImageUrl: string, expiresIn: number = 3600): Promise<string> {
    if (!proofImageUrl) {
      throw new BadRequestException('Proof image URL is required');
    }

    // If it's a base64 data URL, return as-is
    if (proofImageUrl.startsWith('data:image/')) {
      return proofImageUrl;
    }

    // If it's already a signed URL, return as-is
    if (proofImageUrl.includes('token=') || proofImageUrl.includes('sign=')) {
      return proofImageUrl;
    }

    // Extract path from full URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/bank-transfer-receipts/[userId]/[filename]
    // OR: https://[project].supabase.co/storage/v1/object/sign/bank-transfer-receipts/[userId]/[filename]
    try {
      const url = new URL(proofImageUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      
      // Find index of bucket name
      const bucketIndex = pathParts.findIndex((part) => part === 'bank-transfer-receipts');
      if (bucketIndex === -1) {
        // If bucket name not found, might be a different format or public URL
        // Try to extract path manually using regex
        const pathMatch = proofImageUrl.match(/bank-transfer-receipts\/(.+)$/);
        if (pathMatch) {
          const filePath = pathMatch[1].split('?')[0]; // Remove query params if any
          return this.supabaseService.getBankTransferReceiptSignedUrl(filePath, expiresIn);
        }
        // If we can't parse it, return the original URL (might be public)
        this.logger.warn(`Could not parse proof URL format, returning as-is: ${proofImageUrl}`);
        return proofImageUrl;
      }
      
      // Get path after bucket name (userId/filename)
      const filePath = pathParts.slice(bucketIndex + 1).join('/');
      
      if (!filePath) {
        this.logger.warn(`Could not extract file path from URL: ${proofImageUrl}`);
        return proofImageUrl; // Return original URL as fallback
      }

      return this.supabaseService.getBankTransferReceiptSignedUrl(filePath, expiresIn);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // If URL parsing fails, try to extract path manually
      const pathMatch = proofImageUrl.match(/bank-transfer-receipts\/(.+)$/);
      if (pathMatch) {
        const filePath = pathMatch[1].split('?')[0]; // Remove query params if any
        return this.supabaseService.getBankTransferReceiptSignedUrl(filePath, expiresIn);
      }
      // Last resort: return the original URL (might be public or in a different format)
      this.logger.warn(`Failed to parse proof image URL, returning as-is: ${proofImageUrl}`, error);
      return proofImageUrl;
    }
  }
}
