import { PropertyToken } from '../entities/property-token.entity';
import Decimal from 'decimal.js';

export class PropertyTokenResponseDto {
  id: string;
  displayCode: string;
  propertyId: string;
  name: string;
  color: string;
  tokenSymbol: string;
  pricePerTokenUSDT: number;
  totalTokens: number;
  availableTokens: number;
  expectedROI: number;
  apartmentType?: string | null;
  apartmentFeatures?: any | null;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(token: PropertyToken): PropertyTokenResponseDto {
    return {
      id: token.id,
      displayCode: token.displayCode,
      propertyId: token.propertyId,
      name: token.name,
      color: token.color,
      tokenSymbol: token.tokenSymbol,
      pricePerTokenUSDT: (token.pricePerTokenUSDT as Decimal).toNumber(),
      totalTokens: (token.totalTokens as Decimal).toNumber(),
      availableTokens: (token.availableTokens as Decimal).toNumber(),
      expectedROI: (token.expectedROI as Decimal).toNumber(),
      apartmentType: token.apartmentType,
      apartmentFeatures: token.apartmentFeatures,
      description: token.description,
      displayOrder: token.displayOrder,
      isActive: token.isActive,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    };
  }

  static fromEntities(tokens: PropertyToken[]): PropertyTokenResponseDto[] {
    return tokens.map((token) => this.fromEntity(token));
  }
}
