import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LinkedBankAccountsService } from './linked-bank-accounts.service';
import { LinkedBankAccountsController } from './linked-bank-accounts.controller';
import { LinkedBankAccount } from './entities/linked-bank-account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LinkedBankAccount])],
  controllers: [LinkedBankAccountsController],
  providers: [LinkedBankAccountsService],
  exports: [LinkedBankAccountsService],
})
export class LinkedBankAccountsModule {}
