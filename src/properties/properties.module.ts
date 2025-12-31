import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { PropertyTokensController } from './property-tokens.controller';
import { PropertyTokensService } from './property-tokens.service';
import { Property } from './entities/property.entity';
import { PropertyToken } from './entities/property-token.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Property, PropertyToken, Organization]),
    UploadModule,
  ],
  controllers: [PropertiesController, PropertyTokensController],
  providers: [PropertiesService, PropertyTokensService],
  exports: [PropertiesService, PropertyTokensService],
})
export class PropertiesModule {}


