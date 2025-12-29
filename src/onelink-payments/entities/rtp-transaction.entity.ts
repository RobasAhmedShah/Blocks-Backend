import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type RtpOperationType = 
  | 'PRE_RTP_TITLE_FETCH'
  | 'PRE_RTP_ALIAS_INQUIRY'
  | 'RTP_NOW_MERCHANT'
  | 'RTP_NOW_AGGREGATOR'
  | 'RTP_LATER_MERCHANT'
  | 'RTP_LATER_AGGREGATOR'
  | 'STATUS_INQUIRY'
  | 'RTP_CANCELLATION';

export type RtpStatus = 
  | 'PENDING'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'COMPLETED'
  | 'FAILED';

@Entity('rtp_transactions')
@Index(['rtpId'])
@Index(['userId'])
@Index(['stan'])
@Index(['rrn'])
@Index(['status'])
@Index(['createdAt'])
export class RtpTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  @Index()
  displayCode: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  operationType: RtpOperationType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  rtpId: string | null;

  @Column({ type: 'varchar', length: 6 })
  stan: string;

  @Column({ type: 'varchar', length: 12, nullable: true })
  rrn: string;

  @Column({ type: 'varchar', length: 35, nullable: true })
  merchantId: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'PKR' })
  currency: string;

  @Column({ type: 'varchar', length: 24, nullable: true })
  payerIban: string | null;

  @Column({ type: 'varchar', length: 140, nullable: true })
  payerTitle: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  payerMobile: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: RtpStatus;

  @Column({ type: 'varchar', length: 10, nullable: true })
  responseCode: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  responseDescription: string;

  @Column({ type: 'jsonb', nullable: true })
  requestPayload: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  responsePayload: Record<string, unknown>;

  @Column({ type: 'timestamp with time zone', nullable: true })
  expiryDateTime: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  executionDateTime: Date;

  @Column({ type: 'varchar', length: 35, nullable: true })
  billNo: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  errorMessage: string;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;
}

