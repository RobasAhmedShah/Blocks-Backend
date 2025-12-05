import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../admin/entities/user.entity';
import { OrganizationAdmin } from '../../organization-admins/entities/organization-admin.entity';

@Entity('activities')
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 10 })
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

  @Index()
  @Column({ type: 'varchar', length: 500 })
  endpoint: string;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  userType: 'admin' | 'org_admin' | 'user' | 'anonymous';

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  orgAdminId?: string | null;

  @ManyToOne(() => OrganizationAdmin, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orgAdminId' })
  orgAdmin?: OrganizationAdmin;

  @Column({ type: 'varchar', length: 100, nullable: true })
  userName?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userEmail?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  statusCode?: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  action?: string | null; // e.g., 'Property Updated', 'New Investment', 'deposit'

  @Column({ type: 'text', nullable: true })
  description?: string | null; // e.g., 'Crystal Residences', 'Transaction processed'

  @Column({ type: 'varchar', length: 100, nullable: true })
  amount?: string | null; // e.g., '$63803957', '$995.07'

  @Column({ type: 'varchar', length: 50, nullable: true })
  ipAddress?: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  requestBody?: any | null;

  @Column({ type: 'jsonb', nullable: true })
  responseData?: any | null;

  @Column({ type: 'integer', default: 0 })
  responseTime: number; // in milliseconds

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

