import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import { PropertyRequest } from './entities/property-request.entity';
import { CreatePropertyRequestDto } from './dto/create-property-request.dto';
import { UpdatePropertyRequestStatusDto } from './dto/update-property-request-status.dto';
import { Organization } from '../organizations/entities/organization.entity';
import { OrganizationAdmin } from '../organization-admins/entities/organization-admin.entity';
import { Property } from '../properties/entities/property.entity';
import { PropertiesService } from '../properties/properties.service';
import { BlocksAdmin } from '../blocks-admin/entities/blocks-admin.entity';

@Injectable()
export class PropertyRequestsService {
  constructor(
    @InjectRepository(PropertyRequest)
    private readonly propertyRequestRepo: Repository<PropertyRequest>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(OrganizationAdmin)
    private readonly orgAdminRepo: Repository<OrganizationAdmin>,
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(BlocksAdmin)
    private readonly blocksAdminRepo: Repository<BlocksAdmin>,
    private readonly propertiesService: PropertiesService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreatePropertyRequestDto, orgAdminId: string) {
    // Verify organization exists
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dto.organizationId);
    let organizationId = dto.organizationId;
    
    if (!isUuid) {
      const org = await this.orgRepo.findOne({ where: { displayCode: dto.organizationId } });
      if (!org) {
        throw new NotFoundException(`Organization with display code '${dto.organizationId}' not found`);
      }
      organizationId = org.id;
    }

    // Verify org admin belongs to this organization
    const orgAdmin = await this.orgAdminRepo.findOne({
      where: { id: orgAdminId },
      relations: ['organization'],
    });

    if (!orgAdmin) {
      throw new NotFoundException('Organization admin not found');
    }

    if (orgAdmin.organizationId !== organizationId) {
      throw new ForbiddenException('You can only create property requests for your own organization');
    }

    // Check if slug already exists in properties or property_requests
    const existingProperty = await this.propertyRepo.findOne({ where: { slug: dto.slug } });
    if (existingProperty) {
      throw new BadRequestException(`Property with slug '${dto.slug}' already exists`);
    }

    const existingRequest = await this.propertyRequestRepo.findOne({ 
      where: { slug: dto.slug, status: 'pending' } 
    });
    if (existingRequest) {
      throw new BadRequestException(`Property request with slug '${dto.slug}' is already pending`);
    }

    // Create property request
    const propertyRequest = this.propertyRequestRepo.create({
      organizationId,
      requestedBy: orgAdminId,
      status: 'pending',
      title: dto.title,
      slug: dto.slug,
      description: dto.description,
      type: dto.type,
      propertyStatus: dto.propertyStatus || 'planning',
      totalValueUSDT: new Decimal(dto.totalValueUSDT),
      totalTokens: new Decimal(dto.totalTokens),
      expectedROI: new Decimal(dto.expectedROI),
      city: dto.city,
      country: dto.country,
      features: dto.features,
      images: dto.images,
      documents: dto.documents,
    });

    return this.propertyRequestRepo.save(propertyRequest);
  }

  async findAll(orgAdminId?: string) {
    const queryBuilder = this.propertyRequestRepo
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.organization', 'organization')
      .leftJoinAndSelect('request.requester', 'requester')
      .leftJoinAndSelect('request.blocksAdmin', 'blocksAdmin')
      .orderBy('request.createdAt', 'DESC');

    if (orgAdminId) {
      // Filter by org admin - they should see requests they created
      const orgAdmin = await this.orgAdminRepo.findOne({
        where: { id: orgAdminId },
        select: ['id', 'organizationId'],
      });

      if (orgAdmin) {
        // Filter by both: requests created by this admin AND requests for their organization
        queryBuilder.where('(request.requestedBy = :orgAdminId OR request.organizationId = :organizationId)', {
          orgAdminId: orgAdmin.id,
          organizationId: orgAdmin.organizationId,
        });
      } else {
        // If org admin not found, return empty array
        return [];
      }
    }

    return queryBuilder.getMany();
  }

  async findOne(id: string, orgAdminId?: string) {
    const queryBuilder = this.propertyRequestRepo
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.organization', 'organization')
      .leftJoinAndSelect('request.requester', 'requester')
      .leftJoinAndSelect('request.blocksAdmin', 'blocksAdmin')
      .where('request.id = :id', { id });

    if (orgAdminId) {
      // Filter by org admin - they should see requests they created
      const orgAdmin = await this.orgAdminRepo.findOne({
        where: { id: orgAdminId },
        select: ['id', 'organizationId'],
      });

      if (orgAdmin) {
        // Filter by both: requests created by this admin AND requests for their organization
        queryBuilder.andWhere('(request.requestedBy = :orgAdminId OR request.organizationId = :organizationId)', {
          orgAdminId: orgAdmin.id,
          organizationId: orgAdmin.organizationId,
        });
      } else {
        throw new NotFoundException('Property request not found');
      }
    }

    const request = await queryBuilder.getOne();

    if (!request) {
      throw new NotFoundException('Property request not found');
    }

    return request;
  }

  async updateStatus(id: string, dto: UpdatePropertyRequestStatusDto, adminId: string) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adminId);
    if (!isUUID) throw new BadRequestException('Admin ID must be a valid UUID');

    const blocksAdmin = await this.blocksAdminRepo.findOne({
      where: { id: adminId },
      select: ['id', 'isActive'],
    });

    if (!blocksAdmin) throw new NotFoundException('Blocks admin not found');
    if (!blocksAdmin.isActive) throw new ForbiddenException('Blocks admin account is inactive');

    const request = await this.propertyRequestRepo.findOne({
      where: { id },
      relations: ['organization'],
    });

    if (!request) {
      throw new NotFoundException('Property request not found');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException(`Property request is already ${request.status}`);
    }

    // Use transaction to ensure data consistency
    return this.dataSource.transaction(async (manager) => {
      const requestRepo = manager.getRepository(PropertyRequest);
      const propertyRepo = manager.getRepository(Property);

      if (dto.status === 'approved') {
        // Create property from request
        const property = propertyRepo.create({
          organizationId: request.organizationId,
          title: request.title,
          slug: request.slug,
          description: request.description,
          type: request.type,
          status: request.propertyStatus,
          totalValueUSDT: request.totalValueUSDT,
          totalTokens: request.totalTokens,
          availableTokens: request.totalTokens,
          pricePerTokenUSDT: request.totalValueUSDT.div(request.totalTokens),
          expectedROI: request.expectedROI,
          city: request.city,
          country: request.country,
          features: request.features,
          images: request.images,
          documents: request.documents,
        });

        // Generate displayCode
        const result = await manager.query('SELECT nextval(\'property_display_seq\') as nextval');
        property.displayCode = `PROP-${result[0].nextval.toString().padStart(6, '0')}`;

        await propertyRepo.save(property);

        // Update request status
        request.status = 'approved';
        request.blocksAdminId = blocksAdmin.id;
        request.reviewedAt = new Date();
      } else {
        // Reject request
        request.status = 'rejected';
        request.blocksAdminId = blocksAdmin.id;
        request.reviewedAt = new Date();
        request.rejectionReason = dto.rejectionReason || null;
      }

      return requestRepo.save(request);
    });
  }
}

