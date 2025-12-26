import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DecimalTransformer } from '../../common/decimal.transformer';
import Decimal from 'decimal.js';
import { User } from '../../admin/entities/user.entity';
import { Wallet } from '../../wallet/entities/wallet.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { Property } from '../../properties/entities/property.entity';
import { PaymentMethod } from '../../payment-methods/entities/payment-method.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, unique: true })
  displayCode: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  walletId?: string | null;

  @ManyToOne(() => Wallet, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'walletId' })
  wallet?: Wallet;

  @Index('IDX_transactions_organization')
  @Column({ type: 'uuid', nullable: true })
  organizationId?: string | null;

  @ManyToOne(() => Organization, org => org.transactions, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  propertyId?: string | null;

  @ManyToOne(() => Property, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'propertyId' })
  property?: Property;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  paymentMethodId?: string | null;

  @ManyToOne(() => PaymentMethod, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'paymentMethodId' })
  paymentMethod?: PaymentMethod;

  @Column({ type: 'varchar', length: 32 })
  type: 'deposit' | 'withdrawal' | 'investment' | 'return' | 'fee' | 'reward' | 'inflow' | 'marketplace_buy' | 'marketplace_sell';

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer })
  amountUSDT: Decimal;

  @Column({ type: 'varchar', length: 32 })
  status: 'pending' | 'completed' | 'failed';

  @Column({ type: 'varchar', length: 128, nullable: true })
  fromEntity?: string | null;  // human-readable sender name

  @Column({ type: 'varchar', length: 128, nullable: true })
  toEntity?: string | null;    // human-readable receiver name

  @Column({ type: 'varchar', length: 64, nullable: true })
  referenceId?: string | null;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any | null;

  @Column({ type: 'text', nullable: true })
  certificatePath?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}


