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

@Entity('portfolio_history')
export class PortfolioHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('numeric', { 
    precision: 18, 
    scale: 6, 
    transformer: DecimalTransformer,
    name: 'total_value'
  })
  totalValue: Decimal;

  @Column('numeric', { 
    precision: 18, 
    scale: 6, 
    transformer: DecimalTransformer,
    nullable: true,
    name: 'total_invested'
  })
  totalInvested: Decimal | null;

  @Column({ type: 'timestamptz', name: 'recorded_at' })
  recordedAt: Date;

  // Track what caused the change
  @Column({ type: 'varchar', length: 32, nullable: true, name: 'change_type' })
  changeType?: 'investment' | 'reward' | 'price_update' | 'marketplace_buy' | 'marketplace_sell' | 'snapshot' | null;

  @Column({ type: 'uuid', nullable: true, name: 'reference_id' })
  referenceId?: string | null; // investmentId, rewardId, tradeId, etc.

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

