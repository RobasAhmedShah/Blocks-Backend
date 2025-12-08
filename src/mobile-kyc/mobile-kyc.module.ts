import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MobileKycController } from './mobile-kyc.controller';
import { KycService } from '../kyc/kyc.service';
import { KycVerification } from '../kyc/entities/kyc-verification.entity';
import { User } from '../admin/entities/user.entity';
import { SupabaseModule } from '../supabase/supabase.module';
import { KycModule } from '../kyc/kyc.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycVerification, User]),
    SupabaseModule,
    KycModule, // Import to use KycService
  ],
  controllers: [MobileKycController],
  providers: [],
})
export class MobileKycModule {}

