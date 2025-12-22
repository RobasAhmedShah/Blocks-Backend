import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DecimalTransformer } from '../../common/decimal.transformer';
import Decimal from 'decimal.js';
import { User } from '../../admin/entities/user.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

// Note: User import is still needed for the user relation (userId)

@Entity('bank_transfer_requests')
export class BankTransferRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, unique: true, name: 'display_code' })
  displayCode: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer, name: 'amount_usdt' })
  amountUSDT: Decimal;

  @Column({ type: 'varchar', length: 10, default: 'USDT', name: 'currency' })
  currency: string;

  // Bank Account Details (where user sent money to)
  @Column({ type: 'varchar', length: 255, name: 'bank_account_name' })
  bankAccountName: string;

  @Column({ type: 'varchar', length: 100, name: 'bank_account_number' })
  bankAccountNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'bank_iban' })
  bankIban?: string;

  @Column({ type: 'varchar', length: 255, name: 'bank_name' })
  bankName: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'bank_swift_code' })
  bankSwiftCode?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'bank_branch' })
  bankBranch?: string;

  // Proof Upload
  @Column({ type: 'text', nullable: true, name: 'proof_image_url' })
  proofImageUrl?: string;

  // Status & Admin Review
  @Index()
  @Column({ type: 'varchar', length: 32, default: 'pending', name: 'status' })
  status: 'pending' | 'approved' | 'rejected';

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'reviewed_by' })
  reviewedBy?: string;

  // Note: No foreign key constraint on reviewed_by
  // It can contain either User IDs (from users table) or Blocks Admin IDs (from blocks_admins table)
  // The reviewer relation is removed to prevent TypeORM from creating FK constraint
  // If you need reviewer info, query it separately based on reviewedBy value

  @Column({ type: 'timestamptz', nullable: true, name: 'reviewed_at' })
  reviewedAt?: Date;

  @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
  rejectionReason?: string;

  // Transaction Link
  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'transaction_id' })
  transactionId?: string;

  @ManyToOne(() => Transaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'transaction_id' })
  transaction?: Transaction;

  // Metadata
  @Column({ type: 'jsonb', nullable: true, name: 'metadata' })
  metadata?: any;

  @Column({ type: 'text', nullable: true, name: 'description' })
  description?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}


