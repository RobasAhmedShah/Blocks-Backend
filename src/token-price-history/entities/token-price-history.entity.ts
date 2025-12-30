import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { DecimalTransformer } from '../../common/decimal.transformer';
import Decimal from 'decimal.js';
import { Property } from '../../properties/entities/property.entity';
import { PriceEvent } from './price-event.entity';

export type PriceSource = 'base' | 'marketplace';

@Entity('token_price_history')
export class TokenPriceHistory {
  @PrimaryColumn({ type: 'timestamptz', name: 'time' })
  time: Date;

  @PrimaryColumn({ type: 'uuid', name: 'property_id' })
  propertyId: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @Column('numeric', { 
    precision: 18, 
    scale: 6, 
    transformer: DecimalTransformer, 
    name: 'price_per_token' 
  })
  pricePerToken: Decimal;

  @Column('numeric', { 
    precision: 18, 
    scale: 6, 
    transformer: DecimalTransformer, 
    name: 'volume',
    default: 0
  })
  volume: Decimal;

  @Index()
  @Column({ type: 'text', name: 'price_source', default: 'marketplace' })
  priceSource: PriceSource;

  @Column({ type: 'integer', name: 'trade_count', default: 0 })
  tradeCount: number;

  @Column('numeric', { 
    precision: 18, 
    scale: 6, 
    transformer: DecimalTransformer, 
    nullable: true,
    name: 'min_price_per_token' 
  })
  minPricePerToken?: Decimal | null;

  @Column('numeric', { 
    precision: 18, 
    scale: 6, 
    transformer: DecimalTransformer, 
    nullable: true,
    name: 'max_price_per_token' 
  })
  maxPricePerToken?: Decimal | null;

  @Column({ type: 'uuid', nullable: true, name: 'derived_from_event_id' })
  derivedFromEventId?: string | null;

  @ManyToOne(() => PriceEvent, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'derived_from_event_id' })
  derivedFromEvent?: PriceEvent | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

