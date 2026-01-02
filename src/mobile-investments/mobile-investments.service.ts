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
    
    // Prioritize token-specific price if investment is in a specific token tier
    const tokenPrice = investment.propertyToken?.pricePerTokenUSDT
      ? new Decimal(investment.propertyToken.pricePerTokenUSDT)
      : (investment.property?.pricePerTokenUSDT 
          ? new Decimal(investment.property.pricePerTokenUSDT) 
          : new Decimal(0));
    
    // Prioritize token-specific expectedROI (this IS the rental yield)
    // The ExpectedROI% inputted by the user IS the rental yield
    const expectedROI = investment.propertyToken?.expectedROI
      ? new Decimal(investment.propertyToken.expectedROI)
      : (investment.expectedROI 
          ? new Decimal(investment.expectedROI) 
          : (investment.property?.expectedROI 
              ? new Decimal(investment.property.expectedROI) 
              : new Decimal(0)));

    // Calculate current value: tokens × current token price
    const currentValue = tokensPurchased.mul(tokenPrice);

    // Calculate ROI percentage: ((currentValue - investedAmount) / investedAmount) × 100
    const roiDecimal = amountUSDT.gt(0)
      ? currentValue.minus(amountUSDT).div(amountUSDT).mul(100)
      : new Decimal(0);

    // Rental yield = expectedROI% (the ExpectedROI% inputted by the user IS the rental yield)
    const rentalYield = expectedROI;

    // Calculate monthly rental income
    // Formula: (tokens × tokenPrice × expectedROI%) / 12
    // Or: (currentValue × expectedROI%) / 12
    // This is the rent per month for that amount of tokens
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
            tokenPrice: tokenPrice.toNumber(),
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
      propertyToken: investment.propertyToken ? {
        id: investment.propertyToken.id,
        displayCode: investment.propertyToken.displayCode,
        name: investment.propertyToken.name,
        tokenSymbol: investment.propertyToken.tokenSymbol,
        pricePerTokenUSDT: investment.propertyToken.pricePerTokenUSDT 
          ? new Decimal(investment.propertyToken.pricePerTokenUSDT).toNumber() 
          : null,
        expectedROI: investment.propertyToken.expectedROI 
          ? new Decimal(investment.propertyToken.expectedROI).toNumber() 
          : null,
        color: investment.propertyToken.color,
        totalTokens: investment.propertyToken.totalTokens 
          ? new Decimal(investment.propertyToken.totalTokens).toNumber() 
          : null,
        availableTokens: investment.propertyToken.availableTokens 
          ? new Decimal(investment.propertyToken.availableTokens).toNumber() 
          : null,
      } : null,
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

