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
import { User } from '../../admin/entities/user.entity';

export type LinkedBankAccountStatus = 'pending' | 'verified' | 'disabled';

@Entity('linked_bank_accounts')
export class LinkedBankAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Bank Account Details
  @Column({ type: 'varchar', length: 255, name: 'account_holder_name' })
  accountHolderName: string;

  @Column({ type: 'varchar', length: 100, name: 'account_number' })
  accountNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'iban' })
  iban?: string;

  @Column({ type: 'varchar', length: 255, name: 'bank_name' })
  bankName: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'swift_code' })
  swiftCode?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'branch' })
  branch?: string;

  // Optional: Account Type (Checking, Savings, etc.)
  @Column({ type: 'varchar', length: 50, nullable: true, name: 'account_type' })
  accountType?: string;

  // Status & Default
  @Column({ type: 'varchar', length: 32, default: 'pending', name: 'status' })
  status: LinkedBankAccountStatus;

  @Column({ type: 'boolean', default: false, name: 'is_default' })
  isDefault: boolean;

  // Optional: Display name/label for the account
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'display_name' })
  displayName?: string;

  // Metadata
  @Column({ type: 'jsonb', nullable: true, name: 'metadata' })
  metadata?: any;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
