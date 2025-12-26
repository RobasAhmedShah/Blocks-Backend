import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DecimalTransformer } from '../../common/decimal.transformer';
import Decimal from 'decimal.js';
import { User } from '../../admin/entities/user.entity';
import { Property } from '../../properties/entities/property.entity';

@Entity('marketplace_listings')
export class MarketplaceListing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, unique: true, name: 'display_code' })
  displayCode: string;

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

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer, name: 'price_per_token' })
  pricePerToken: Decimal;

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer, name: 'total_tokens' })
  totalTokens: Decimal;

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer, name: 'remaining_tokens' })
  remainingTokens: Decimal;

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer, name: 'min_order_usdt' })
  minOrderUSDT: Decimal;

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer, name: 'max_order_usdt' })
  maxOrderUSDT: Decimal;

  @Index()
  @Column({ type: 'varchar', length: 32, default: 'active', name: 'status' })
  status: 'active' | 'sold' | 'cancelled';

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

