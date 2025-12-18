import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlocksAdminController } from './blocks-admin.controller';
import { BlocksAdminService } from './blocks-admin.service';
import { BlocksAdmin } from './entities/blocks-admin.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BlocksAdmin])],
  controllers: [BlocksAdminController],
  providers: [BlocksAdminService],
  exports: [BlocksAdminService],
})
export class BlocksAdminModule {}
