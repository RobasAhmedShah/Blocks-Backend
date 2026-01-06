import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceListing } from './entities/marketplace-listing.entity';
import { MarketplaceTrade } from './entities/marketplace-trade.entity';
import { TokenLock } from './entities/token-lock.entity';
import { Investment } from '../investments/entities/investment.entity';
import { Property } from '../properties/entities/property.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../admin/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CertificatesModule } from '../certificates/certificates.module';
import { TokenPriceHistoryModule } from '../token-price-history/token-price-history.module';
import { PortfolioModule } from '../portfolio/portfolio.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarketplaceListing,
      MarketplaceTrade,
      TokenLock,
      Investment,
      Property,
      Wallet,
      Transaction,
      User,
    ]),
    NotificationsModule,
    CertificatesModule,
    TokenPriceHistoryModule,
    PortfolioModule,
  ],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}

