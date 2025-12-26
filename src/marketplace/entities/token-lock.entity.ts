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
import { Investment } from '../../investments/entities/investment.entity';
import { MarketplaceListing } from './marketplace-listing.entity';

@Entity('token_locks')
export class TokenLock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'investment_id' })
  investmentId: string;

  @ManyToOne(() => Investment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'investment_id' })
  investment: Investment;

  @Index()
  @Column({ type: 'uuid', name: 'listing_id' })
  listingId: string;

  @ManyToOne(() => MarketplaceListing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing: MarketplaceListing;

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer, name: 'locked_tokens' })
  lockedTokens: Decimal;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

