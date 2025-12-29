import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('merchant_profiles')
export class MerchantProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 35, unique: true })
  merchantID: string;

  @Column({ type: 'varchar', length: 140 })
  dbaName: string;

  @Column({ type: 'varchar', length: 140 })
  merchantName: string;

  @Column({ type: 'varchar', length: 24 })
  iban: string;

  @Column({ type: 'varchar', length: 6 })
  bankBic: string;

  @Column({ type: 'varchar', length: 35 })
  merchantCategoryCode: string;

  @Column({ type: 'varchar', length: 140 })
  accountTitle: string;

  @Column({ type: 'varchar', length: 2, default: '00' }) // 00=Active, 01=Inactive, 02=Blocked
  merchantStatus: string;

  @Column({ type: 'varchar', length: 35, nullable: true })
  townName?: string | null;

  @Column({ type: 'varchar', length: 70, nullable: true })
  addressLine?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phoneNo?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobileNo?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 70, nullable: true })
  dept?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  website?: string | null;

  @Column({ type: 'varchar', length: 1, nullable: true }) // F = Fixed, P = Percentage
  feeType?: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  feeValue?: number | null;

  @Column({ type: 'text', nullable: true })
  reasonCode?: string | null;

  // Store full request/response for audit
  @Column({ type: 'jsonb', nullable: true })
  lastRequestPayload?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  lastResponsePayload?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  lastResponseCode?: string | null;

  @Column({ type: 'text', nullable: true })
  lastResponseDescription?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


