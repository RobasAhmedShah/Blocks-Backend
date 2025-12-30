import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('gmail_sync')
export class GmailSync {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  emailAddress: string;

  @Column({ type: 'varchar', length: 50 })
  lastHistoryId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

