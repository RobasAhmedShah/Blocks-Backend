import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { PaymentMethod } from '../../payment-methods/entities/payment-method.entity';
import { LinkedBankAccount } from '../../linked-bank-accounts/entities/linked-bank-account.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 32, unique: true })
  displayCode: string;

  @Column({ type: 'varchar', length: 255 })
  fullName: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false, name: 'password' })
  password?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'date', nullable: true })
  dob?: Date | null;

  @Column({ type: 'text', nullable: true })
  address?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profileImage?: string | null;

  @Column({ type: 'text', nullable: true })
  expoToken?: string | null;

  @Column({ type: 'text', nullable: true })
  webPushSubscription?: string | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  bankAccountLast4?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => PaymentMethod, (paymentMethod) => paymentMethod.user)
  paymentMethods: PaymentMethod[];

  @OneToMany(() => LinkedBankAccount, (linkedBankAccount) => linkedBankAccount.user)
  linkedBankAccounts: LinkedBankAccount[];
}


