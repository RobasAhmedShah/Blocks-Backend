import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankTransfersService } from './bank-transfers.service';
import { BankTransfersController, AdminBankTransfersController } from './bank-transfers.controller';
import { BankTransferRequest } from './entities/bank-transfer-request.entity';
import { User } from '../admin/entities/user.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { SupabaseModule } from '../supabase/supabase.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BankTransferRequest, User, Wallet, Transaction]),
    SupabaseModule,
    SettingsModule,
  ],
  controllers: [BankTransfersController, AdminBankTransfersController],
  providers: [BankTransfersService],
  exports: [BankTransfersService],
})
export class BankTransfersModule {}


