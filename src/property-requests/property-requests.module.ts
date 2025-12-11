import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertyRequest } from './entities/property-request.entity';
import { PropertyRequestsService } from './property-requests.service';
import { PropertyRequestsController } from './property-requests.controller';
import { Organization } from '../organizations/entities/organization.entity';
import { OrganizationAdmin } from '../organization-admins/entities/organization-admin.entity';
import { Property } from '../properties/entities/property.entity';
import { User } from '../admin/entities/user.entity';
import { PropertiesModule } from '../properties/properties.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PropertyRequest, Organization, OrganizationAdmin, Property, User]),
    PropertiesModule,
  ],
  controllers: [PropertyRequestsController],
  providers: [PropertyRequestsService],
  exports: [PropertyRequestsService],
})
export class PropertyRequestsModule {}

