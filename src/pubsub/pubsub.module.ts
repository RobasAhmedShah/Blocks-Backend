import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GmailController, GmailWatchController } from './gmail/gmail.controller';
import { GmailService } from './gmail/gmail.service';
import { GmailSync } from './gmail/entities/gmail-sync.entity';
import { User } from '../admin/entities/user.entity';
import { WalletModule } from '../wallet/wallet.module';
import { Transaction } from '../transactions/entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([GmailSync, User, Transaction]),
    WalletModule,
  ],
  controllers: [GmailController, GmailWatchController],
  providers: [GmailService],
  exports: [GmailService],
})
export class PubSubModule {}

