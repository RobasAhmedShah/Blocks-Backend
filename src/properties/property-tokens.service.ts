import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PropertyToken } from './entities/property-token.entity';
import { Property } from './entities/property.entity';
import { CreatePropertyTokenDto } from './dto/create-property-token.dto';
import { UpdatePropertyTokenDto } from './dto/update-property-token.dto';
import { PropertyTokenResponseDto } from './dto/property-token-response.dto';
import Decimal from 'decimal.js';

@Injectable()
export class PropertyTokensService {
  private readonly logger = new Logger(PropertyTokensService.name);

  constructor(
    @InjectRepository(PropertyToken)
    private readonly tokenRepo: Repository<PropertyToken>,
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a new token tier for a property
   */
  async create(dto: CreatePropertyTokenDto): Promise<PropertyTokenResponseDto> {
    // Validate property exists
    const isPropertyUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      dto.propertyId,
    );

    const property = await this.propertyRepo.findOne({
      where: isPropertyUuid ? { id: dto.propertyId } : { displayCode: dto.propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property not found: ${dto.propertyId}`);
    }

    // Check if token symbol (displayCode) already exists globally
    const existingToken = await this.tokenRepo.findOne({
      where: { displayCode: dto.tokenSymbol },
    });

    if (existingToken) {
      throw new BadRequestException(
        `Token symbol "${dto.tokenSymbol}" already exists. Please choose a different symbol.`,
      );
    }

    // Validate available tokens <= total tokens
    if (dto.totalTokens < 0) {
      throw new BadRequestException('Total tokens must be greater than or equal to 0');
    }

    const availableTokens = dto.totalTokens; // Initially, all tokens are available

    // Create token
    const token = this.tokenRepo.create({
      displayCode: dto.tokenSymbol, // Use tokenSymbol as displayCode
      propertyId: property.id, // Use property UUID
      name: dto.name,
      color: dto.color,
      tokenSymbol: dto.tokenSymbol,
      pricePerTokenUSDT: new Decimal(dto.pricePerTokenUSDT),
      totalTokens: new Decimal(dto.totalTokens),
      availableTokens: new Decimal(availableTokens),
      expectedROI: new Decimal(dto.expectedROI),
      apartmentType: dto.apartmentType || null,
      apartmentFeatures: dto.apartmentFeatures || null,
      description: dto.description || null,
      displayOrder: dto.displayOrder || 0,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    const savedToken = await this.tokenRepo.save(token);
    this.logger.log(`Created token tier: ${savedToken.displayCode} for property ${property.displayCode}`);

    return PropertyTokenResponseDto.fromEntity(savedToken);
  }

  /**
   * Get all tokens for a property
   */
  async findAllByProperty(
    propertyId: string,
    includeInactive = false,
  ): Promise<PropertyTokenResponseDto[]> {
    // Validate property exists
    const isPropertyUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      propertyId,
    );

    const property = await this.propertyRepo.findOne({
      where: isPropertyUuid ? { id: propertyId } : { displayCode: propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property not found: ${propertyId}`);
    }

    const where: any = { propertyId: property.id };
    if (!includeInactive) {
      where.isActive = true;
    }

    const tokens = await this.tokenRepo.find({
      where,
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });

    return PropertyTokenResponseDto.fromEntities(tokens);
  }

  /**
   * Get single token by ID or displayCode
   */
  async findOne(idOrCode: string): Promise<PropertyTokenResponseDto> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrCode,
    );

    const token = await this.tokenRepo.findOne({
      where: isUuid ? { id: idOrCode } : { displayCode: idOrCode },
      relations: ['property'],
    });

    if (!token) {
      throw new NotFoundException(`Token not found: ${idOrCode}`);
    }

    return PropertyTokenResponseDto.fromEntity(token);
  }

  /**
   * Update token
   */
  async update(
    idOrCode: string,
    dto: UpdatePropertyTokenDto,
  ): Promise<PropertyTokenResponseDto> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrCode,
    );

    const token = await this.tokenRepo.findOne({
      where: isUuid ? { id: idOrCode } : { displayCode: idOrCode },
    });

    if (!token) {
      throw new NotFoundException(`Token not found: ${idOrCode}`);
    }

    // If updating tokenSymbol, check global uniqueness
    if (dto.tokenSymbol && dto.tokenSymbol !== token.displayCode) {
      const existingToken = await this.tokenRepo.findOne({
        where: { displayCode: dto.tokenSymbol },
      });

      if (existingToken && existingToken.id !== token.id) {
        throw new BadRequestException(
          `Token symbol "${dto.tokenSymbol}" already exists. Please choose a different symbol.`,
        );
      }
    }

    // Update fields
    if (dto.name !== undefined) token.name = dto.name;
    if (dto.color !== undefined) token.color = dto.color;
    if (dto.tokenSymbol !== undefined) {
      token.tokenSymbol = dto.tokenSymbol;
      token.displayCode = dto.tokenSymbol; // Update displayCode to match tokenSymbol
    }
    if (dto.pricePerTokenUSDT !== undefined)
      token.pricePerTokenUSDT = new Decimal(dto.pricePerTokenUSDT);
    if (dto.totalTokens !== undefined) {
      const newTotalTokens = new Decimal(dto.totalTokens);
      const currentSold = (token.totalTokens as Decimal).minus(
        token.availableTokens as Decimal,
      );
      token.totalTokens = newTotalTokens;
      // Adjust available tokens: newTotal - alreadySold
      token.availableTokens = newTotalTokens.minus(currentSold);
      if (token.availableTokens.lt(0)) {
        token.availableTokens = new Decimal(0);
      }
    }
    if (dto.expectedROI !== undefined)
      token.expectedROI = new Decimal(dto.expectedROI);
    if (dto.apartmentType !== undefined) token.apartmentType = dto.apartmentType;
    if (dto.apartmentFeatures !== undefined)
      token.apartmentFeatures = dto.apartmentFeatures;
    if (dto.description !== undefined) token.description = dto.description;
    if (dto.displayOrder !== undefined) token.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) token.isActive = dto.isActive;

    const updatedToken = await this.tokenRepo.save(token);
    this.logger.log(`Updated token tier: ${updatedToken.displayCode}`);

    return PropertyTokenResponseDto.fromEntity(updatedToken);
  }

  /**
   * Delete token (soft delete by setting isActive = false)
   */
  async delete(idOrCode: string): Promise<void> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrCode,
    );

    const token = await this.tokenRepo.findOne({
      where: isUuid ? { id: idOrCode } : { displayCode: idOrCode },
    });

    if (!token) {
      throw new NotFoundException(`Token not found: ${idOrCode}`);
    }

    // Check if there are active investments
    const activeInvestments = await this.dataSource
      .getRepository('Investment')
      .count({
        where: { propertyTokenId: token.id, status: 'confirmed' },
      });

    if (activeInvestments > 0) {
      // Soft delete: set isActive = false
      token.isActive = false;
      await this.tokenRepo.save(token);
      this.logger.log(
        `Soft deleted token tier: ${token.displayCode} (has active investments)`,
      );
    } else {
      // Hard delete if no investments
      await this.tokenRepo.remove(token);
      this.logger.log(`Hard deleted token tier: ${token.displayCode}`);
    }
  }

  /**
   * Validate token availability
   */
  async validateTokenAvailability(
    tokenIdOrCode: string,
    requestedTokens: Decimal,
  ): Promise<boolean> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tokenIdOrCode,
    );

    const token = await this.tokenRepo.findOne({
      where: isUuid ? { id: tokenIdOrCode } : { displayCode: tokenIdOrCode },
    });

    if (!token) {
      throw new NotFoundException(`Token not found: ${tokenIdOrCode}`);
    }

    if (!token.isActive) {
      throw new BadRequestException(`Token ${token.displayCode} is not active`);
    }

    return (token.availableTokens as Decimal).gte(requestedTokens);
  }
}
