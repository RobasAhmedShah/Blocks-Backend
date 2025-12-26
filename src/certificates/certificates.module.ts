import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificatesService } from './certificates.service';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Investment } from '../investments/entities/investment.entity';
import { Property } from '../properties/entities/property.entity';
import { User } from '../admin/entities/user.entity';
import { MarketplaceTrade } from '../marketplace/entities/marketplace-trade.entity';
import { SupabaseModule } from '../supabase/supabase.module';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Investment, Property, User, MarketplaceTrade]),
    SupabaseModule,
    PdfModule,
  ],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}

