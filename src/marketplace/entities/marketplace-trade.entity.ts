import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DecimalTransformer } from '../../common/decimal.transformer';
import Decimal from 'decimal.js';
import { User } from '../../admin/entities/user.entity';
import { Property } from '../../properties/entities/property.entity';
import { MarketplaceListing } from './marketplace-listing.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

@Entity('marketplace_trades')
export class MarketplaceTrade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, unique: true, name: 'display_code' })
  displayCode: string;

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'listing_id' })
  listingId?: string | null;

  @ManyToOne(() => MarketplaceListing, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'listing_id' })
  listing?: MarketplaceListing | null;

  @Index()
  @Column({ type: 'uuid', name: 'buyer_id' })
  buyerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  @Index()
  @Column({ type: 'uuid', name: 'seller_id' })
  sellerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @Index()
  @Column({ type: 'uuid', name: 'property_id' })
  propertyId: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer, name: 'tokens_bought' })
  tokensBought: Decimal;

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer, name: 'total_usdt' })
  totalUSDT: Decimal;

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer, name: 'price_per_token' })
  pricePerToken: Decimal;

  @Column({ type: 'uuid', nullable: true, name: 'buyer_transaction_id' })
  buyerTransactionId?: string | null;

  @ManyToOne(() => Transaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'buyer_transaction_id' })
  buyerTransaction?: Transaction | null;

  @Column({ type: 'uuid', nullable: true, name: 'seller_transaction_id' })
  sellerTransactionId?: string | null;

  @ManyToOne(() => Transaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'seller_transaction_id' })
  sellerTransaction?: Transaction | null;

  @Column({ type: 'jsonb', nullable: true, name: 'metadata' })
  metadata?: any | null;

  @Column({ type: 'text', nullable: true, name: 'certificate_path' })
  certificatePath?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

