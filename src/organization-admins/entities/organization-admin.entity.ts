import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('organization_admins')
export class OrganizationAdmin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string; // hashed

  @Column({ type: 'varchar', length: 255, nullable: true })
  fullName?: string | null;

  @Column({ type: 'varchar', length: 50, default: 'org_admin' })
  role: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLogin?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  passwordChangedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  webPushSubscription?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}


