import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../admin/entities/user.entity';
import { OrganizationAdmin } from '../../organization-admins/entities/organization-admin.entity';
import { BlocksAdmin } from '../../blocks-admin/entities/blocks-admin.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  organizationAdminId: string | null;

  @ManyToOne(() => OrganizationAdmin, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organizationAdminId' })
  organizationAdmin: OrganizationAdmin | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  blocksAdminId: string | null;

  @ManyToOne(() => BlocksAdmin, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'blocksAdminId' })
  blocksAdmin: BlocksAdmin | null;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'user' })
  recipientType: 'user' | 'org_admin' | 'blocks_admin';

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: any | null;

  @Column({ type: 'varchar', length: 32, default: 'sent' })
  status: 'pending' | 'sent' | 'failed';

  @Column({ type: 'varchar', length: 50, nullable: true })
  platform?: 'expo' | 'web' | null;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

