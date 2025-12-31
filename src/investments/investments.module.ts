import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvestmentsController } from './investments.controller';
import { InvestmentsService } from './investments.service';
import { Investment } from './entities/investment.entity';
import { Property } from '../properties/entities/property.entity';
import { PropertyToken } from '../properties/entities/property-token.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../admin/entities/user.entity';
import { Organization } from '../organizations/entities/organization.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Investment,
      Property,
      PropertyToken,
      Wallet,
      Transaction,
      User,
      Organization,
    ]),
    // PortfolioModule removed - now handled by event listeners
  ],
  controllers: [InvestmentsController],
  providers: [InvestmentsService],
  exports: [InvestmentsService], // Export for use in MobileInvestmentsModule
})
export class InvestmentsModule {}


