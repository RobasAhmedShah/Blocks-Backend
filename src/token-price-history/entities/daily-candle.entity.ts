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
import { Property } from '../../properties/entities/property.entity';
import type { PriceSource } from './token-price-history.entity';

/**
 * Daily Candle Entity
 * 
 * Represents a daily OHLC (Open, High, Low, Close) candle from the
 * daily_candles_1d table (aggregated from token_price_history via cron job).
 * 
 * This entity is registered with TypeORM so it knows about the table structure.
 * The service uses raw SQL queries and returns DailyCandleDto for API responses.
 */
@Entity('daily_candles_1d')
export class DailyCandle {
  @PrimaryColumn({ type: 'timestamptz', name: 'bucket_day' })
  bucketDay: Date;

  @PrimaryColumn({ type: 'uuid', name: 'property_id' })
  propertyId: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @PrimaryColumn({ type: 'text', name: 'price_source', default: 'marketplace' })
  priceSource: PriceSource;

  @Column('numeric', {
    precision: 18,
    scale: 6,
    transformer: DecimalTransformer,
    name: 'open_price',
  })
  openPrice: Decimal;

  @Column('numeric', {
    precision: 18,
    scale: 6,
    transformer: DecimalTransformer,
    name: 'high_price',
  })
  highPrice: Decimal;

  @Column('numeric', {
    precision: 18,
    scale: 6,
    transformer: DecimalTransformer,
    name: 'low_price',
  })
  lowPrice: Decimal;

  @Column('numeric', {
    precision: 18,
    scale: 6,
    transformer: DecimalTransformer,
    name: 'close_price',
  })
  closePrice: Decimal;

  @Column('numeric', {
    precision: 18,
    scale: 6,
    transformer: DecimalTransformer,
    name: 'volume',
    default: 0,
  })
  volume: Decimal;

  @Column({ type: 'integer', name: 'trade_count', default: 0 })
  tradeCount: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

/**
 * Daily Candle DTO
 * 
 * Used for API responses. Maps bucket_day to date for frontend compatibility.
 */
export interface DailyCandleDto {
  date: Date;
  propertyId: string;
  priceSource: PriceSource;
  openPrice: Decimal;
  highPrice: Decimal;
  lowPrice: Decimal;
  closePrice: Decimal;
  volume: Decimal;
  tradeCount: number;
}


