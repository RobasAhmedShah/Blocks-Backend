/**
 * Marketplace-related events
 */

export interface MarketplaceTradeCompletedEvent {
  tradeId: string;
  tradeDisplayCode: string;
  buyerId: string;
  sellerId: string;
  propertyId: string;
  propertyTitle: string;
  tokensBought: string;
  totalUSDT: string;
  buyerInvestmentId?: string; // Investment ID created/updated for the buyer
  sellerInvestmentId?: string; // Investment ID that was updated for the seller (tokens reduced)
}

