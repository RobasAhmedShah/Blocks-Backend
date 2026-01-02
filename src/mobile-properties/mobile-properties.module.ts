import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MobilePropertiesController } from './mobile-properties.controller';
import { MobilePropertiesService } from './mobile-properties.service';
import { Property } from '../properties/entities/property.entity';
import { PropertyToken } from '../properties/entities/property-token.entity';
import { PropertiesModule } from '../properties/properties.module';

@Module({
  imports: [TypeOrmModule.forFeature([Property, PropertyToken]), PropertiesModule],
  controllers: [MobilePropertiesController],
  providers: [MobilePropertiesService],
  exports: [MobilePropertiesService],
})
export class MobilePropertiesModule {}

