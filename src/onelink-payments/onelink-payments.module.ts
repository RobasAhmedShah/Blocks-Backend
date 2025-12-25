import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OneLinkPaymentsController } from './onelink-payments.controller';
import { OneLinkRtpController } from './onelink-rtp.controller';
import { OneLinkOAuthService } from './onelink-oauth.service';
import { OneLinkQrService } from './onelink-qr.service';
import { OneLinkRtpService } from './onelink-rtp.service';
import { RtpTransaction } from './entities/rtp-transaction.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([RtpTransaction]),
  ],
  controllers: [OneLinkPaymentsController, OneLinkRtpController],
  providers: [OneLinkOAuthService, OneLinkQrService, OneLinkRtpService],
  exports: [OneLinkOAuthService, OneLinkQrService, OneLinkRtpService],
})
export class OneLinkPaymentsModule {}
