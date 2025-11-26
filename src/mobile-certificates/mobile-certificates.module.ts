import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MobileCertificatesController } from './mobile-certificates.controller';
import { CertificatesModule } from '../certificates/certificates.module';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Investment } from '../investments/entities/investment.entity';

@Module({
  imports: [
    ConfigModule,
    CertificatesModule,
    TypeOrmModule.forFeature([Transaction, Investment]),
  ],
  controllers: [MobileCertificatesController],
})
export class MobileCertificatesModule {}

