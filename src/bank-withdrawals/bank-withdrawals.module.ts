import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankWithdrawalsService } from './bank-withdrawals.service';
import { BankWithdrawalsController, AdminBankWithdrawalsController } from './bank-withdrawals.controller';
import { BankWithdrawalRequest } from './entities/bank-withdrawal-request.entity';
import { User } from '../admin/entities/user.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BankWithdrawalRequest,
      User,
      Wallet,
      Transaction,
    ]),
  ],
  controllers: [BankWithdrawalsController, AdminBankWithdrawalsController],
  providers: [BankWithdrawalsService],
  exports: [BankWithdrawalsService],
})
export class BankWithdrawalsModule {}


