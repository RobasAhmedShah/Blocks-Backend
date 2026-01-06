import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DecimalTransformer } from '../../common/decimal.transformer';
import Decimal from 'decimal.js';
import { User } from '../../admin/entities/user.entity';

@Entity('portfolio_daily_candles')
export class PortfolioDailyCandle {
  @PrimaryColumn({ type: 'timestamptz', name: 'bucket_day' })
  bucketDay: Date;

  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // OHLC values
  @Column('numeric', { 
    precision: 18, 
    scale: 6, 
    transformer: DecimalTransformer,
    name: 'open_value'
  })
  openValue: Decimal;

  @Column('numeric', { 
    precision: 18, 
    scale: 6, 
    transformer: DecimalTransformer,
    name: 'high_value'
  })
  highValue: Decimal;

  @Column('numeric', { 
    precision: 18, 
    scale: 6, 
    transformer: DecimalTransformer,
    name: 'low_value'
  })
  lowValue: Decimal;

  @Column('numeric', { 
    precision: 18, 
    scale: 6, 
    transformer: DecimalTransformer,
    name: 'close_value'
  })
  closeValue: Decimal;

  @Column('numeric', { 
    precision: 18, 
    scale: 6, 
    transformer: DecimalTransformer,
    name: 'total_invested'
  })
  totalInvested: Decimal;

  @Column({ type: 'integer', name: 'snapshot_count' })
  snapshotCount: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}


