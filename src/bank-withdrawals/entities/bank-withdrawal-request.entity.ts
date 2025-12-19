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

@Entity('bank_withdrawal_requests')
export class BankWithdrawalRequest {
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

  // User's Bank Account Details (where they want to receive money)
  @Column({ type: 'varchar', length: 255, name: 'user_bank_account_name' })
  userBankAccountName: string;

  @Column({ type: 'varchar', length: 100, name: 'user_bank_account_number' })
  userBankAccountNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'user_bank_iban' })
  userBankIban?: string;

  @Column({ type: 'varchar', length: 255, name: 'user_bank_name' })
  userBankName: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'user_bank_swift_code' })
  userBankSwiftCode?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'user_bank_branch' })
  userBankBranch?: string;

  // Status & Admin Review
  @Index()
  @Column({ type: 'varchar', length: 32, default: 'pending', name: 'status' })
  status: 'pending' | 'completed' | 'rejected';

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'reviewed_by' })
  reviewedBy?: string;

  // Note: No foreign key constraint on reviewed_by
  // It can contain Blocks Admin IDs (from blocks_admins table)
  // The reviewer relation is removed to prevent TypeORM from creating FK constraint

  @Column({ type: 'timestamptz', nullable: true, name: 'reviewed_at' })
  reviewedAt?: Date;

  @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
  rejectionReason?: string;

  // Bank Transaction Proof (provided by admin after manual transfer)
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'bank_transaction_id' })
  bankTransactionId?: string;

  @Column({ type: 'text', nullable: true, name: 'bank_transaction_proof_url' })
  bankTransactionProofUrl?: string;

  // Transaction Link (debit transaction)
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
