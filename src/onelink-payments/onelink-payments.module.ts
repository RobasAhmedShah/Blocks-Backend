import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OneLinkPaymentsController } from './onelink-payments.controller';
import { OneLinkRtpController } from './onelink-rtp.controller';
import { OneLinkMerchantController } from './onelink-merchant.controller';
import { OneLinkOAuthService } from './onelink-oauth.service';
import { OneLinkQrService } from './onelink-qr.service';
import { OneLinkRtpService } from './onelink-rtp.service';
import { OneLinkMerchantService } from './onelink-merchant.service';
import { OneLinkP2MQrService } from './onelink-p2m-qr.service';
import { RtpTransaction } from './entities/rtp-transaction.entity';
import { MerchantProfile } from './entities/merchant-profile.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([RtpTransaction, MerchantProfile]),
  ],
  controllers: [
    OneLinkPaymentsController,
    OneLinkRtpController,
    OneLinkMerchantController,
  ],
  providers: [
    OneLinkOAuthService,
    OneLinkQrService,
    OneLinkRtpService,
    OneLinkMerchantService,
    OneLinkP2MQrService,
  ],
  exports: [
    OneLinkOAuthService,
    OneLinkQrService,
    OneLinkRtpService,
    OneLinkMerchantService,
    OneLinkP2MQrService,
  ],
})
export class OneLinkPaymentsModule {}
