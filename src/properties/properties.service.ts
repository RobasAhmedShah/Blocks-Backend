import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { Property } from './entities/property.entity';
import { PropertyToken } from './entities/property-token.entity';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { UpdatePropertyStatusDto } from './dto/update-property-status.dto';
import { Organization } from '../organizations/entities/organization.entity';
import { UploadService } from '../upload/upload.service';
import { PropertyTokenResponseDto } from './dto/property-token-response.dto';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(PropertyToken)
    private readonly tokenRepo: Repository<PropertyToken>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    private readonly uploadService: UploadService,
  ) {}

  async create(dto: CreatePropertyDto) {
    const totalValue = new Decimal(dto.totalValueUSDT);
    const totalTokens = new Decimal(dto.totalTokens);
    const price = totalValue.div(totalTokens);
    
    // Resolve organizationId from display code if needed
    let organizationId = dto.organizationId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dto.organizationId);
    
    if (!isUuid) {
      // It's a display code, find the organization
      const org = await this.orgRepo.findOne({ where: { displayCode: dto.organizationId } });
      if (!org) {
        throw new Error(`Organization with display code '${dto.organizationId}' not found`);
      }
      organizationId = org.id;
    }
    
    // Generate displayCode using sequence
    const result = await this.propertyRepo.query('SELECT nextval(\'property_display_seq\') as nextval');
    const displayCode = `PROP-${result[0].nextval.toString().padStart(6, '0')}`;
    
    const property = this.propertyRepo.create({
      ...dto,
      organizationId,
      status: dto.status ?? 'planning',
      totalValueUSDT: totalValue,
      totalTokens: totalTokens,
      pricePerTokenUSDT: price,
      availableTokens: totalTokens,
      expectedROI: new Decimal(dto.expectedROI),
      displayCode,
    });
    return this.propertyRepo.save(property);
  }

  async findAll() {
    return this.propertyRepo.find({ relations: ['organization'] });
  }

  async findByOrganization(orgIdOrCode: string) {
    // Check if orgIdOrCode is UUID or displayCode
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgIdOrCode);
    
    let organizationId = orgIdOrCode;
    
    if (!isUuid) {
      // It's a display code, find the organization
      const org = await this.orgRepo.findOne({ where: { displayCode: orgIdOrCode } });
      if (!org) {
        throw new NotFoundException(`Organization with display code '${orgIdOrCode}' not found`);
      }
      organizationId = org.id;
    }
    
    return this.propertyRepo.find({ 
      where: { organizationId }, 
      relations: ['organization'] 
    });
  }

  async findOne(id: string, includeTokens = false) {
    const property = await this.propertyRepo.findOne({
      where: { id },
      relations: ['organization'],
    });

    if (property && includeTokens) {
      const tokens = await this.tokenRepo.find({
        where: { propertyId: property.id, isActive: true },
        order: { displayOrder: 'ASC', createdAt: 'ASC' },
      });
      return { ...property, tokens };
    }

    return property;
  }

  async findBySlug(slug: string, includeTokens = false) {
    const property = await this.propertyRepo.findOne({
      where: { slug },
      relations: ['organization'],
    });

    if (property && includeTokens) {
      const tokens = await this.tokenRepo.find({
        where: { propertyId: property.id, isActive: true },
        order: { displayOrder: 'ASC', createdAt: 'ASC' },
      });
      return { ...property, tokens };
    }

    return property;
  }

  async findByDisplayCode(displayCode: string, includeTokens = false) {
    const property = await this.propertyRepo.findOne({
      where: { displayCode },
      relations: ['organization'],
    });

    if (property && includeTokens) {
      const tokens = await this.tokenRepo.find({
        where: { propertyId: property.id, isActive: true },
        order: { displayOrder: 'ASC', createdAt: 'ASC' },
      });
      return { ...property, tokens };
    }

    return property;
  }

  async findByIdOrDisplayCode(idOrCode: string, includeTokens = false) {
    // Check if it's a UUID format (contains hyphens and is 36 chars)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrCode,
    );

    let property: Property | null;
    if (isUuid) {
      property = await this.propertyRepo.findOne({
        where: { id: idOrCode },
        relations: ['organization'],
      });
    } else {
      property = await this.propertyRepo.findOne({
        where: { displayCode: idOrCode },
        relations: ['organization'],
      });
    }

    if (property && includeTokens) {
      const tokens = await this.tokenRepo.find({
        where: { propertyId: property.id },
        order: { displayOrder: 'ASC', createdAt: 'ASC' },
      });
      // Convert tokens to DTOs for consistent response format
      return { 
        ...property, 
        tokens: tokens.length > 0 ? PropertyTokenResponseDto.fromEntities(tokens) : []
      };
    }

    return property;
  }

  async findBySlugOrDisplayCode(slugOrCode: string) {
    return this.propertyRepo.findOne({
      where: [
        { slug: slugOrCode },
        { displayCode: slugOrCode }
      ],
      relations: ['organization']
    });
  }

  async update(id: string, dto: UpdatePropertyDto) {
    const property = await this.findByIdOrDisplayCode(id);
    if (!property) {
      throw new NotFoundException(`Property with id or displayCode '${id}' not found`);
    }

    // Handle dynamic field updates
    const updateData: Partial<Property> = {};

    // Update only provided fields
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.slug !== undefined) updateData.slug = dto.slug;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.status !== undefined) updateData.status = dto.status as any;
    if (dto.city !== undefined) updateData.city = dto.city;
    if (dto.country !== undefined) updateData.country = dto.country;
    if (dto.features !== undefined) updateData.features = dto.features;
    if (dto.images !== undefined) updateData.images = dto.images;
    if (dto.documents !== undefined) updateData.documents = dto.documents;

    // Handle decimal fields
    if (dto.totalValueUSDT !== undefined) {
      updateData.totalValueUSDT = new Decimal(dto.totalValueUSDT);
    }
    if (dto.totalTokens !== undefined) {
      updateData.totalTokens = new Decimal(dto.totalTokens);
    }
    if (dto.availableTokens !== undefined) {
      updateData.availableTokens = new Decimal(dto.availableTokens);
    }
    if (dto.pricePerTokenUSDT !== undefined) {
      updateData.pricePerTokenUSDT = new Decimal(dto.pricePerTokenUSDT);
    }
    if (dto.expectedROI !== undefined) {
      updateData.expectedROI = new Decimal(dto.expectedROI);
    }

    // Auto-recalculate pricePerTokenUSDT if totalValueUSDT or totalTokens changed
    if (dto.totalValueUSDT !== undefined || dto.totalTokens !== undefined) {
      const totalValue = dto.totalValueUSDT !== undefined ? new Decimal(dto.totalValueUSDT) : property.totalValueUSDT;
      const totalTokens = dto.totalTokens !== undefined ? new Decimal(dto.totalTokens) : property.totalTokens;
      updateData.pricePerTokenUSDT = totalValue.div(totalTokens);
    }

    await this.propertyRepo.update(property.id, updateData);
    return this.findByIdOrDisplayCode(id);
  }

  async updateStatus(id: string, dto: UpdatePropertyStatusDto) {
    const property = await this.findByIdOrDisplayCode(id);
    if (!property) {
      throw new NotFoundException(`Property with id or displayCode '${id}' not found`);
    }

    await this.propertyRepo.update(property.id, { status: dto.status as any });
    return this.findByIdOrDisplayCode(id);
  }

  async remove(id: string) {
    // Check if it's a UUID format (contains hyphens and is 36 chars)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let property: Property | null;
    if (isUuid) {
      property = await this.propertyRepo.findOne({
        where: { id },
      });
    } else {
      property = await this.propertyRepo.findOne({
        where: { displayCode: id },
      });
    }

    if (!property) {
      throw new NotFoundException(`Property with id or displayCode '${id}' not found`);
    }

    await this.propertyRepo.remove(property);
    return { message: `Property '${property.displayCode}' has been deleted successfully` };
  }

  /**
   * Upload images for a property
   * Files are saved to: docs/properties/{filename}
   * URLs are stored in database: property.images (JSONB array)
   */
  async uploadImages(id: string, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const property = await this.findByIdOrDisplayCode(id);
    if (!property) {
      throw new NotFoundException(`Property with id or displayCode '${id}' not found`);
    }

    // Upload files to docs/properties folder
    // Returns: { url: '/docs/properties/filename.jpg', filename, path, fullUrl }
    const uploadedFiles = await this.uploadService.saveFiles(files, 'properties', 'image');

    // Get existing images or initialize empty array
    const existingImages = property.images || [];
    
    // Prepare image data for database storage
    // URL format: /docs/properties/{timestamp}-{random}.{ext}
    const newImages = uploadedFiles.map(file => ({
      url: file.url, // This is saved to DB: /docs/properties/1234567890-abc123.jpg
      filename: file.filename,
      uploadedAt: new Date().toISOString(),
    }));

    // Merge with existing images
    const updatedImages = Array.isArray(existingImages) 
      ? [...existingImages, ...newImages]
      : newImages;

    // Save URLs to database in property.images field (JSONB)
    await this.propertyRepo.update(property.id, { 
      images: updatedImages 
    });

    // Return updated property with all images
    const updatedProperty = await this.findByIdOrDisplayCode(id);

    return {
      success: true,
      message: `${files.length} image(s) uploaded successfully`,
      uploadedFiles: newImages, // URLs that were just saved
      property: updatedProperty, // Full property with all images
    };
  }
}


