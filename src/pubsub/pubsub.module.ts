import { Module } from '@nestjs/common';
import { GmailController } from './gmail/gmail.controller';
import { GmailService } from './gmail/gmail.service';

@Module({
  controllers: [GmailController],
  providers: [GmailService],
  exports: [GmailService],
})
export class PubSubModule {}

