import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DecimalTransformer } from '../../common/decimal.transformer';
import Decimal from 'decimal.js';
import { User } from '../../admin/entities/user.entity';
import { Property } from '../../properties/entities/property.entity';
import { PropertyToken } from '../../properties/entities/property-token.entity';

@Entity('investments')
export class Investment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, unique: true })
  displayCode: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ type: 'uuid' })
  propertyId: string;

  @ManyToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'propertyId' })
  property: Property;

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'property_token_id' })
  propertyTokenId?: string | null;

  @ManyToOne(() => PropertyToken, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'property_token_id' })
  propertyToken?: PropertyToken | null;

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer })
  tokensPurchased: Decimal;

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer })
  amountUSDT: Decimal;

  @Column({ type: 'varchar', length: 32 })
  status: 'pending' | 'confirmed' | 'active' | 'sold' | 'cancelled';

  @Column({ type: 'varchar', length: 32 })
  paymentStatus: 'pending' | 'completed' | 'failed';

  @Column('numeric', { precision: 5, scale: 2, transformer: DecimalTransformer })
  expectedROI: Decimal;

  @Column({ type: 'text', nullable: true })
  certificatePath?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}


