import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortfolioListener } from './portfolio.listener';
import { OrganizationListener } from './organization.listener';
import { TransactionListener } from './transaction.listener';
import { AuditListener } from './audit.listener';
import { PaymentMethodListener } from './payment-method.listener';
import { CertificateListener } from './certificate.listener';
import { InvestmentNotificationListener } from './investment-notification.listener';
import { Portfolio } from '../portfolio/entities/portfolio.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../admin/entities/user.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Property } from '../properties/entities/property.entity';
import { Investment } from '../investments/entities/investment.entity';
import { Reward } from '../rewards/entities/reward.entity';
import { PaymentMethod } from '../payment-methods/entities/payment-method.entity';
import { OrganizationAdmin } from '../organization-admins/entities/organization-admin.entity';
import { MarketplaceTrade } from '../marketplace/entities/marketplace-trade.entity';
import { CertificatesModule } from '../certificates/certificates.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Portfolio,
      Organization,
      Transaction,
      User,
      Wallet,
      Property,
      Investment,
      Reward,
      PaymentMethod,
      OrganizationAdmin,
      MarketplaceTrade,
    ]),
    CertificatesModule,
    NotificationsModule,
  ],
  providers: [
    PortfolioListener,
    OrganizationListener,
    TransactionListener,
    AuditListener,
    PaymentMethodListener,
    CertificateListener,
    InvestmentNotificationListener,
  ],
  exports: [
    PortfolioListener,
    OrganizationListener,
    TransactionListener,
    AuditListener,
    PaymentMethodListener,
    CertificateListener,
    InvestmentNotificationListener,
  ],
})
export class ListenersModule {}
