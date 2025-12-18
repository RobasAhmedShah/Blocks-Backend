import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DecimalTransformer } from '../../common/decimal.transformer';
import Decimal from 'decimal.js';
import { Organization } from '../../organizations/entities/organization.entity';
import { OrganizationAdmin } from '../../organization-admins/entities/organization-admin.entity';
import { BlocksAdmin } from '../../blocks-admin/entities/blocks-admin.entity';

@Entity('property_requests')
export class PropertyRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Index()
  @Column({ type: 'uuid' })
  requestedBy: string;

  @ManyToOne(() => OrganizationAdmin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestedBy' })
  requester: OrganizationAdmin;

  @Index()
  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';

  // Property fields (same as Property entity)
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 32 })
  type: 'residential' | 'commercial' | 'mixed';

  @Column({ type: 'varchar', length: 32, default: 'planning' })
  propertyStatus: 'planning' | 'construction' | 'active' | 'onhold' | 'soldout' | 'completed';

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer })
  totalValueUSDT: Decimal;

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer })
  totalTokens: Decimal;

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

  @Column({ type: 'jsonb', nullable: true })
  documents?: any | null;

  // Approval fields
  @Column({ type: 'uuid', nullable: true })
  blocksAdminId?: string | null;

  @ManyToOne(() => BlocksAdmin, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'blocksAdminId' })
  blocksAdmin?: BlocksAdmin | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

