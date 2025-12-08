import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Property } from '../properties/entities/property.entity';
import { PropertyFilterDto, PropertyFilter } from './dto/property-filter.dto';
import Decimal from 'decimal.js';

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class MobilePropertiesService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
  ) {}

  async findAllWithFilters(query: PropertyFilterDto): Promise<PaginatedResponse<any>> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    // Build query
    let qb = this.propertyRepo
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.organization', 'organization');

    // Apply filters
    if (query.city) {
      qb = qb.andWhere('property.city = :city', { city: query.city });
    }

    if (query.status) {
      qb = qb.andWhere('property.status = :status', { status: query.status });
    }

    if (query.minROI !== undefined) {
      qb = qb.andWhere('property.expectedROI >= :minROI', { minROI: query.minROI });
    }

    if (query.maxPricePerToken !== undefined) {
      qb = qb.andWhere('property.pricePerTokenUSDT <= :maxPricePerToken', {
        maxPricePerToken: query.maxPricePerToken,
      });
    }

    // Search filter (searches in title, description, city)
    if (query.search) {
      qb = qb.andWhere(
        '(property.title ILIKE :search OR property.description ILIKE :search OR property.city ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Apply predefined filters
    if (query.filter) {
      qb = this.applyPredefinedFilter(qb, query.filter);
    }

    // Get total count before pagination
    const total = await qb.getCount();

    // Apply pagination
    const properties = await qb
      .orderBy('property.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    // Transform properties with error handling
    const transformedProperties = properties
      .map((p) => {
        try {
          return this.transformProperty(p);
        } catch (error) {
          console.error(`[MobilePropertiesService] Error transforming property ${p.id}:`, error);
          return null;
        }
      })
      .filter((p) => p !== null); // Remove failed transformations

    return {
      data: transformedProperties,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<any> {
    // Check if it's a UUID format (contains hyphens and is 36 chars)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let property: Property | null;

    if (isUuid) {
      property = await this.propertyRepo.findOne({
        where: { id },
        relations: ['organization'],
      });
    } else {
      property = await this.propertyRepo.findOne({
        where: { displayCode: id },
        relations: ['organization'],
      });
    }

    if (!property) {
      throw new NotFoundException(`Property with id or displayCode '${id}' not found`);
    }

    return this.transformProperty(property);
  }

  private applyPredefinedFilter(
    qb: SelectQueryBuilder<Property>,
    filter: PropertyFilter,
  ): SelectQueryBuilder<Property> {
    switch (filter) {
      case PropertyFilter.TRENDING:
        // High funding progress - properties with more than 30% tokens sold
        // TODO: Implement actual trending logic based on recent investments (last 7 days)
        // For now, using sold percentage as a proxy
        qb = qb.andWhere(
          '(CAST(property.totalTokens AS DECIMAL) - CAST(property.availableTokens AS DECIMAL)) / NULLIF(CAST(property.totalTokens AS DECIMAL), 0) > 0.3',
        );
        break;

      case PropertyFilter.HIGH_YIELD:
        // ROI >= 10%
        qb = qb.andWhere('property.expectedROI >= :highYield', { highYield: 10 });
        break;

      case PropertyFilter.NEW_LISTINGS:
        // Created in last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        qb = qb.andWhere('property.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo });
        break;

      case PropertyFilter.COMPLETED:
        // Status is completed
        qb = qb.andWhere('property.status = :completed', { completed: 'completed' });
        break;
    }

    return qb;
  }

  private transformProperty(property: Property): any {
    // ✅ Safe Decimal conversion with null checks
    const totalTokens = property.totalTokens ? new Decimal(property.totalTokens) : new Decimal(0);
    const availableTokens = property.availableTokens ? new Decimal(property.availableTokens) : new Decimal(0);
    const soldTokens = totalTokens.minus(availableTokens);
    
    const totalValueUSDT = property.totalValueUSDT ? new Decimal(property.totalValueUSDT) : new Decimal(0);
    const pricePerTokenUSDT = property.pricePerTokenUSDT ? new Decimal(property.pricePerTokenUSDT) : new Decimal(0);
    const expectedROI = property.expectedROI ? new Decimal(property.expectedROI) : new Decimal(0);

    return {
      id: property.id,
      displayCode: property.displayCode,
      title: property.title || '',
      location: property.city ? `${property.city}, ${property.country || ''}`.trim() : null,
      city: property.city || null,
      country: property.country || null,
      valuation: totalValueUSDT.toNumber(),
      tokenPrice: pricePerTokenUSDT.toNumber(),
      minInvestment: pricePerTokenUSDT.toNumber(), // Minimum is one token
      totalTokens: totalTokens.toNumber(),
      soldTokens: soldTokens.toNumber(),
      availableTokens: availableTokens.toNumber(),
      estimatedROI: expectedROI.toNumber(),
      estimatedYield: expectedROI.toNumber(), // Same as ROI for now
      completionDate: null, // TODO: Add completionDate field to Property entity
      status: property.status || 'active',
      images: this.extractImages(property.images),
      description: property.description || '',
      amenities: this.extractAmenities(property.features),
      builder: {
        id: property.organization?.id || null,
        name: property.organization?.name || null,
        logo: property.organization?.logoUrl || null,
        rating: 0, // TODO: Implement rating system
        projectsCompleted: 0, // TODO: Count completed properties for this organization
      },
      features: this.extractFeatures(property.features),
      documents: this.extractDocuments(property.documents, property.legalDocPath),
      type: property.type || 'residential',
      slug: property.slug || '',
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
    };
  }

  private extractDocuments(documents: any, legalDocPath?: string | null): any[] {
    const docArray: any[] = [];
    
    // If documents is already an array, transform it
    if (Array.isArray(documents)) {
      documents.forEach((doc) => {
        if (doc && (doc.url || doc.name)) {
          docArray.push({
            name: doc.name || 'Document',
            type: doc.type || (doc.url?.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Document'),
            verified: doc.verified !== undefined ? doc.verified : true,
            url: doc.url || null,
          });
        }
      });
    }
    // If documents is an object (backend format: { brochure: {...}, legalDocPath: {...} })
    else if (documents && typeof documents === 'object' && !Array.isArray(documents)) {
      // Check if it has a 'items', 'list', or 'docs' property (nested array)
      const nestedArray = documents.items || documents.list || documents.docs;
      if (Array.isArray(nestedArray)) {
        nestedArray.forEach((doc) => {
          if (doc && (doc.url || doc.name)) {
            docArray.push({
              name: doc.name || 'Document',
              type: doc.type || (doc.url?.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Document'),
              verified: doc.verified !== undefined ? doc.verified : true,
              url: doc.url || null,
            });
          }
        });
      } else {
        // Iterate over object keys (brochure, legalDocPath, etc.)
        Object.keys(documents).forEach(key => {
          const doc = documents[key];
          
          // Skip if the value is null or not an object
          if (!doc || typeof doc !== 'object') {
            return;
          }

          // Handle document object structure
          if (doc.url || doc.name) {
            docArray.push({
              name: doc.name || this.formatDocumentName(key),
              type: doc.type || (doc.url?.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Document'),
              verified: doc.verified !== undefined ? doc.verified : true,
              url: doc.url || null,
            });
          } else if (typeof doc === 'string') {
            // If the value is a string (like legalDocPath), treat it as a URL
            docArray.push({
              name: this.formatDocumentName(key),
              type: 'PDF',
              verified: true,
              url: doc,
            });
          }
        });
      }
    }
    
    // Also check for legalDocPath field if it exists separately
    if (legalDocPath && typeof legalDocPath === 'string') {
      // Check if legalDocPath is already in documents
      const hasLegalDoc = docArray.some(doc => 
        doc.url === legalDocPath || 
        doc.name.toLowerCase().includes('legal')
      );
      
      if (!hasLegalDoc) {
        docArray.push({
          name: 'Legal Document',
          type: 'PDF',
          verified: true,
          url: legalDocPath,
        });
      }
    }
    
    return docArray;
  }

  private formatDocumentName(key: string): string {
    // Convert camelCase or snake_case to readable format
    // e.g., "brochure" -> "Brochure", "legalDocPath" -> "Legal Doc Path"
    return key
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
      .trim();
  }

  private extractImages(images: any): string[] {
    if (!images) return [];
    
    // If it's a JSON string, parse it first
    if (typeof images === 'string') {
      const trimmed = images.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          images = JSON.parse(images);
        } catch (e) {
          console.warn('[extractImages] Failed to parse JSON:', e);
          return [];
        }
      } else {
        // Single URL string
        return [images];
      }
    }
    
    // If it's an object with urls array: { urls: ["https://..."] }
    if (typeof images === 'object' && !Array.isArray(images) && images.urls && Array.isArray(images.urls)) {
      return images.urls
        .map((url: any) => (typeof url === 'string' ? url : url.url || ''))
        .filter(Boolean);
    }
    
    // If it's already an array
    if (Array.isArray(images)) {
      return images.map((img) => (typeof img === 'string' ? img : img.url || '')).filter(Boolean);
    }
    return [];
  }

  private extractAmenities(features: any): string[] {
    if (!features) return [];
    if (typeof features === 'object') {
      // Extract amenities from features object
      const amenities: string[] = [];
      if (features.amenities && Array.isArray(features.amenities)) {
        return features.amenities;
      }
      // Try to extract common amenities
      if (features.pool) amenities.push('pool');
      if (features.gym) amenities.push('gym');
      if (features.parking) amenities.push('parking');
      if (features.security) amenities.push('security');
      return amenities;
    }
    return [];
  }

  private extractFeatures(features: any): any {
    if (!features) return {};
    if (typeof features === 'object') {
      return {
        bedrooms: features.bedrooms || null,
        bathrooms: features.bathrooms || null,
        area: features.area || null,
        floors: features.floors || null,
        units: features.units || null,
      };
    }
    return {};
  }
}

