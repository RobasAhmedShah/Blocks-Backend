import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenPriceHistoryService } from './token-price-history.service';
import { PriceEvent } from './entities/price-event.entity';
import { TokenPriceHistory } from './entities/token-price-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PriceEvent, TokenPriceHistory]),
  ],
  providers: [TokenPriceHistoryService],
  exports: [TokenPriceHistoryService],
})
export class TokenPriceHistoryModule {}

