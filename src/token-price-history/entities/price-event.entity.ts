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
import { Property } from '../../properties/entities/property.entity';

export type PriceEventType = 'PROPERTY_CREATED' | 'PROPERTY_PRICE_UPDATE' | 'LISTING_CREATED' | 'PURCHASE_EXECUTED';
export type ReferenceType = 'listing' | 'trade' | 'property';

@Entity('price_event')
export class PriceEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'property_id' })
  propertyId: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @Index()
  @Column({ type: 'text', name: 'event_type' })
  eventType: PriceEventType;

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
    name: 'quantity' 
  })
  quantity: Decimal;

  @Index()
  @Column({ type: 'uuid', name: 'actor_id' })
  actorId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor?: User | null;

  @Column({ type: 'uuid', nullable: true, name: 'reference_id' })
  referenceId?: string | null;

  @Index()
  @Column({ type: 'text', nullable: true, name: 'reference_type' })
  referenceType?: ReferenceType | null;

  @Column({ type: 'jsonb', nullable: true, name: 'metadata' })
  metadata?: any | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}


