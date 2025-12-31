import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DecimalTransformer } from '../../common/decimal.transformer';
import Decimal from 'decimal.js';
import { Property } from './property.entity';
import { Investment } from '../../investments/entities/investment.entity';
import { Reward } from '../../rewards/entities/reward.entity';

@Entity('property_tokens')
export class PropertyToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, unique: true, name: 'display_code' })
  displayCode: string; // Token symbol only (e.g., "MBT", "MGT", "MPT") - globally unique

  @Index()
  @Column({ type: 'uuid', name: 'property_id' })
  propertyId: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @Column({ type: 'varchar', length: 100 })
  name: string; // e.g., "Bronze Token", "Gold Token", "Platinum Token"

  @Column({ type: 'varchar', length: 50 })
  color: string; // Hex color code (e.g., "#CD7F32", "#FFD700", "#E5E4E2")

  @Column({ type: 'varchar', length: 20, name: 'token_symbol' })
  tokenSymbol: string; // e.g., "MBT", "MGT", "MPT"

  @Column('numeric', {
    precision: 18,
    scale: 6,
    transformer: DecimalTransformer,
    name: 'price_per_token_usdt',
  })
  pricePerTokenUSDT: Decimal;

  @Column('numeric', {
    precision: 18,
    scale: 6,
    transformer: DecimalTransformer,
    name: 'total_tokens',
  })
  totalTokens: Decimal;

  @Column('numeric', {
    precision: 18,
    scale: 6,
    transformer: DecimalTransformer,
    name: 'available_tokens',
  })
  availableTokens: Decimal;

  @Column('numeric', {
    precision: 5,
    scale: 2,
    transformer: DecimalTransformer,
    name: 'expected_roi',
  })
  expectedROI: Decimal;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'apartment_type' })
  apartmentType?: string | null; // e.g., "Studio", "1BR", "2BR", "Penthouse"

  @Column({ type: 'jsonb', nullable: true, name: 'apartment_features' })
  apartmentFeatures?: any | null; // e.g., { bedrooms: 1, bathrooms: 1, area_sqm: 45, amenities: ["balcony", "parking"] }

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'integer', default: 0, name: 'display_order' })
  displayOrder: number; // For sorting tokens in UI

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @OneToMany(() => Investment, (investment) => investment.propertyToken)
  investments: Investment[];

  @OneToMany(() => Reward, (reward) => reward.propertyToken)
  rewards: Reward[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
