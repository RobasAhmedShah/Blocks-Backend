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
import { Organization } from '../../organizations/entities/organization.entity';
import { PropertyToken } from './property-token.entity';

@Entity('properties')
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, unique: true, name: 'displayCode' })
  displayCode: string;

  @Index()
  @Column({ type: 'uuid', name: 'organizationId' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 32 })
  type: 'residential' | 'commercial' | 'mixed';

  @Column({ type: 'varchar', length: 32 })
  status: 'planning' | 'construction' | 'active' | 'onhold' | 'soldout' | 'completed';

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer })
  totalValueUSDT: Decimal;

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer })
  totalTokens: Decimal;

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer })
  availableTokens: Decimal;

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer })
  pricePerTokenUSDT: Decimal;

  @Column('numeric', { precision: 5, scale: 2, transformer: DecimalTransformer })
  expectedROI: Decimal;

  @Column({ type: 'varchar', length: 128, nullable: true })
  city?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  country?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  features?: any | null;

  @Column({ type: 'jsonb', nullable: true })
  images?: any | null;

  @Column({ type: 'jsonb', nullable: true, name: 'documents' })
  documents?: any | null;

  @Column({ type: 'text', nullable: true })
  legalDocPath?: string | null;

  @OneToMany(() => PropertyToken, (token) => token.property)
  tokens?: PropertyToken[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}


