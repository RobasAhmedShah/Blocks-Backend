import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from '../properties/entities/property.entity';

@Injectable()
export class ChatbotDatabaseService {
  constructor(
    @InjectRepository(Property)
    private propertyRepository: Repository<Property>,
  ) {}

  async getPropertyDetails(args: {
    propertyId?: string;
    propertyTitle?: string;
    displayCode?: string;
  }) {
    const { propertyId, propertyTitle, displayCode } = args;
    
    // Use findOne with explicit where clause to avoid query builder column name issues
    // TypeORM's findOne automatically handles column name mapping from entity to database
    if (propertyId) {
      return await this.propertyRepository.findOne({ where: { id: propertyId } });
    } else if (displayCode) {
      return await this.propertyRepository.findOne({ where: { displayCode } });
    } else if (propertyTitle) {
      // For title search, use raw SQL to get the ID first, then use findOne
      // This avoids TypeORM query builder column name mapping issues with documents
      try {
        const rawResult = await this.propertyRepository.query(
          `SELECT id FROM properties WHERE title ILIKE $1 LIMIT 1`,
          [`%${propertyTitle}%`],
        );
        
        if (rawResult && rawResult.length > 0) {
          // Use findOne with the ID - this uses the entity mapping which handles documents correctly
          // findOne generates SQL without aliases, so it should work correctly
          const property = await this.propertyRepository.findOne({ where: { id: rawResult[0].id } });
          return property;
        }
        
        return null;
      } catch (error) {
        // If findOne fails due to documents column issue, fall back to raw SQL for all columns
        console.error('Error in getPropertyDetails with findOne, falling back to raw SQL:', error);
        const rawResult = await this.propertyRepository.query(
          `SELECT * FROM properties WHERE title ILIKE $1 LIMIT 1`,
          [`%${propertyTitle}%`],
        );
        return rawResult && rawResult.length > 0 ? (rawResult[0] as any) : null;
      }
    } else {
      throw new Error('Please provide propertyId, propertyTitle, or displayCode');
    }
  }

  async searchProperties(args: {
    city?: string;
    country?: string;
    status?: string;
    type?: string;
    minROI?: number;
    maxPricePerToken?: number;
  }) {
    const { city, country, status, type, minROI, maxPricePerToken } = args;
    const queryBuilder = this.propertyRepository.createQueryBuilder('property');

    if (city) {
      queryBuilder.andWhere('property.city ILIKE :city', { city: `%${city}%` });
    }

    if (country) {
      queryBuilder.andWhere('property.country ILIKE :country', { country: `%${country}%` });
    }

    if (status) {
      queryBuilder.andWhere('property.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('property.type = :type', { type });
    }

    if (minROI !== undefined) {
      queryBuilder.andWhere('property.expectedROI >= :minROI', { minROI });
    }

    if (maxPricePerToken !== undefined) {
      queryBuilder.andWhere('property.pricePerTokenUSDT <= :maxPrice', { maxPrice: maxPricePerToken });
    }

    queryBuilder.orderBy('property.createdAt', 'DESC').limit(20);

    return await queryBuilder.getMany();
  }

  async getPropertyFinancials(args: {
    propertyId?: string;
    propertyTitle?: string;
  }) {
    const { propertyId, propertyTitle } = args;
    const queryBuilder = this.propertyRepository
      .createQueryBuilder('property')
      .select([
        'property.id',
        'property.title',
        'property.pricePerTokenUSDT',
        'property.expectedROI',
        'property.totalValueUSDT',
        'property.totalTokens',
        'property.availableTokens',
      ])
      .addSelect('(property.totalTokens - property.availableTokens)', 'soldTokens');

    if (propertyId) {
      queryBuilder.where('property.id = :id', { id: propertyId });
    } else if (propertyTitle) {
      queryBuilder.where('property.title ILIKE :title', { title: `%${propertyTitle}%` });
    } else {
      throw new Error('Please provide propertyId or propertyTitle');
    }

    return await queryBuilder.getRawOne();
  }
}

