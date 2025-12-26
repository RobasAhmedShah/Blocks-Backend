import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DevtoolsModule } from '@nestjs/devtools-integration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AdminModule } from './admin/admin.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users';
import { KycModule } from './kyc';
import { PropertiesModule } from './properties';
import { WalletModule } from './wallet';
import { TransactionsModule } from './transactions';
import { InvestmentsModule } from './investments';
import { RewardsModule } from './rewards';
import { PortfolioModule } from './portfolio';
import { OrganizationAdminsModule } from './organization-admins/organization-admins.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { ListenersModule } from './listeners/listeners.module';
import { UploadModule } from './upload/upload.module';
import { ChatbotDatabaseModule } from './chatbot-database/chatbot-database.module';
import { MobileAuthModule } from './mobile-auth/mobile-auth.module';
import { MobilePropertiesModule } from './mobile-properties/mobile-properties.module';
import { MobileInvestmentsModule } from './mobile-investments/mobile-investments.module';
import { MobileWalletModule } from './mobile-wallet/mobile-wallet.module';
import { MobileTransactionsModule } from './mobile-transactions/mobile-transactions.module';
import { MobileProfileModule } from './mobile-profile/mobile-profile.module';
import { MobilePaymentMethodsModule } from './mobile-payment-methods/mobile-payment-methods.module';
import { SupabaseModule } from './supabase/supabase.module';
import { PdfModule } from './pdf/pdf.module';
import { CertificatesModule } from './certificates/certificates.module';
import { MobileCertificatesModule } from './mobile-certificates/mobile-certificates.module';
import { MobileKycModule } from './mobile-kyc/mobile-kyc.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ActivitiesModule } from './activities/activities.module';
import { PropertyRequestsModule } from './property-requests/property-requests.module';
import { BlocksAdminModule } from './blocks-admin/blocks-admin.module';
import { BankTransfersModule } from './bank-transfers/bank-transfers.module';
import { BankWithdrawalsModule } from './bank-withdrawals/bank-withdrawals.module';
import { SettingsModule } from './settings/settings.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ActivityLoggingInterceptor } from './activities/interceptors/activity-logging.interceptor';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from './properties/entities/property.entity';
import { User } from './admin/entities/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Make ConfigModule available globally
      envFilePath: '.env', // Explicitly specify .env file
    }),
    DevtoolsModule.register({
      http: process.env.NODE_ENV !== 'production'
    }),
    DatabaseModule,
    TypeOrmModule.forFeature([Property, User]), // Make Property and User repositories available for global interceptor
    EventEmitterModule.forRoot(), // Event-driven architecture
    AdminModule,
    OrganizationsModule,
    UsersModule,
    KycModule,
    PropertiesModule,
    WalletModule,
    TransactionsModule,
    InvestmentsModule,
    RewardsModule,
    PortfolioModule,
        PaymentMethodsModule, // Payment method system
        OrganizationAdminsModule, // Org admin management
    ListenersModule, // Event listeners for cross-service updates
    UploadModule, // File upload system
    ChatbotDatabaseModule, // Chatbot database query endpoints for AI tool calling
    MobileAuthModule, // Mobile authentication module
    MobilePropertiesModule, // Mobile properties endpoints
    MobileInvestmentsModule, // Mobile investments endpoints
    MobileWalletModule, // Mobile wallet endpoints
    MobileTransactionsModule, // Mobile transactions endpoints
    MobileProfileModule, // Mobile profile endpoints
    MobilePaymentMethodsModule, // Mobile payment methods endpoints
    SupabaseModule, // Supabase storage integration
    PdfModule, // PDF generation service
    CertificatesModule, // Certificate generation service
    MobileCertificatesModule, // Mobile certificate endpoints
    MobileKycModule, // Mobile KYC endpoints
    NotificationsModule, // Push notifications system
    ActivitiesModule, // Activity logging system
    PropertyRequestsModule, // Property requests system
    BlocksAdminModule, // Blocks admin authentication
    BankTransfersModule, // Bank transfer deposit requests
    BankWithdrawalsModule, // Bank withdrawal requests
    SettingsModule, // Settings management (bank account details, etc.)
    MarketplaceModule, // Peer-to-peer token marketplace
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLoggingInterceptor,
    },
  ],
})
export class AppModule {}
