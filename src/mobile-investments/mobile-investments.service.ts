import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InvestmentsService } from '../investments/investments.service';
import { Investment } from '../investments/entities/investment.entity';
import Decimal from 'decimal.js';

@Injectable()
export class MobileInvestmentsService {
  constructor(private readonly investmentsService: InvestmentsService) {}

  async create(userId: string, propertyId: string, tokenCount: number): Promise<any> {
    // Use existing invest method
    const investment = await this.investmentsService.invest(
      userId,
      propertyId,
      new Decimal(tokenCount),
    );

    return this.transformInvestment(investment);
  }

  async findByUserId(userId: string): Promise<any[]> {
    const investments = await this.investmentsService.findByUserId(userId);
    return investments
      .map((inv) => {
        try {
          return this.transformInvestment(inv);
        } catch (error) {
          console.error(`[MobileInvestmentsService] Error transforming investment ${inv.id}:`, error);
          return null;
        }
      })
      .filter((inv) => {
        // Remove failed transformations
        if (inv === null) return false;
        // Filter out investments with zero or very small token counts (< 0.001)
        // These shouldn't appear in the portfolio
        return inv.tokens >= 0.001;
      });
  }

  async findOne(id: string, userId?: string): Promise<any> {
    const investment = await this.investmentsService.findByIdOrDisplayCode(id);

    if (!investment) {
      throw new NotFoundException(`Investment with id or displayCode '${id}' not found`);
    }

    // If userId is provided, verify ownership
    if (userId && investment.userId !== userId) {
      throw new ForbiddenException('You do not have access to this investment');
    }

    return this.transformInvestment(investment);
  }

  private transformInvestment(investment: Investment): any {
    // ✅ Safe Decimal conversion with null checks
    const tokensPurchased = investment.tokensPurchased ? new Decimal(investment.tokensPurchased) : new Decimal(0);
    const amountUSDT = investment.amountUSDT ? new Decimal(investment.amountUSDT) : new Decimal(0);
    const propertyTokenPrice = investment.property?.pricePerTokenUSDT 
      ? new Decimal(investment.property.pricePerTokenUSDT) 
      : new Decimal(0);
    const expectedROI = investment.expectedROI ? new Decimal(investment.expectedROI) : new Decimal(0);
    const propertyROI = investment.property?.expectedROI 
      ? new Decimal(investment.property.expectedROI) 
      : expectedROI;

    // Calculate current value (tokens * current token price * 1.15)
    // Mobile app expects: currentValue = tokensPurchased × property.tokenPrice × 1.15
    // 1.15 = 15% growth estimate (matching mobile app calculation)
    const baseValue = tokensPurchased.mul(propertyTokenPrice);
    const currentValue = baseValue.mul(1.15); // Apply 15% growth multiplier

    // Calculate ROI percentage
    const roiDecimal = amountUSDT.gt(0)
      ? currentValue.minus(amountUSDT).div(amountUSDT).mul(100)
      : new Decimal(0);

    // Calculate rental yield (using property's expectedROI)
    const rentalYield = propertyROI;

    // Calculate monthly rental income
    // Mobile app expects: monthlyRentalIncome = (currentValue × property.estimatedYield / 100) / 12
    const annualIncome = currentValue.mul(rentalYield).div(100);
    const monthlyRentalIncome = annualIncome.div(12);

    return {
      id: investment.id,
      displayCode: investment.displayCode,
      property: investment.property
        ? {
            id: investment.property.id,
            displayCode: investment.property.displayCode,
            title: investment.property.title || '',
            images: this.extractImages(investment.property.images),
            tokenPrice: propertyTokenPrice.toNumber(),
            status: investment.property.status || 'active',
            city: investment.property.city || null,
            country: investment.property.country || null,
          }
        : null,
      tokens: tokensPurchased.toNumber(),
      investedAmount: amountUSDT.toNumber(),
      currentValue: currentValue.toNumber(),
      roi: roiDecimal.toNumber(),
      rentalYield: rentalYield.toNumber(),
      monthlyRentalIncome: monthlyRentalIncome.toNumber(),
      status: investment.status,
      paymentStatus: investment.paymentStatus,
      purchaseDate: investment.createdAt,
      createdAt: investment.createdAt,
      updatedAt: investment.updatedAt,
      certificatePath: investment.certificatePath || null,
    };
  }

  private extractImages(images: any): string[] {
    if (!images) return [];
    if (Array.isArray(images)) {
      return images.map((img) => (typeof img === 'string' ? img : img.url || '')).filter(Boolean);
    }
    return [];
  }
}

