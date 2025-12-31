import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DecimalTransformer } from '../../common/decimal.transformer';
import Decimal from 'decimal.js';
import { User } from '../../admin/entities/user.entity';
import { Investment } from '../../investments/entities/investment.entity';
import { PropertyToken } from '../../properties/entities/property-token.entity';

@Entity('rewards')
export class Reward {
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
  investmentId: string;

  @ManyToOne(() => Investment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'investmentId' })
  investment: Investment;

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'property_token_id' })
  propertyTokenId?: string | null;

  @ManyToOne(() => PropertyToken, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'property_token_id' })
  propertyToken?: PropertyToken | null;

  @Column('numeric', { precision: 18, scale: 6, transformer: DecimalTransformer })
  amountUSDT: Decimal;

  @Column({ type: 'varchar', length: 32 })
  type: 'roi' | 'referral' | 'bonus';

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: 'pending' | 'distributed';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}


