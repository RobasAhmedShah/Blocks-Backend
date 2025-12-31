import Decimal from 'decimal.js';

/**
 * Event emitted when an investment is successfully completed
 */
export interface InvestmentCompletedEvent {
  eventId: string;
  timestamp: Date;
  userId: string;
  userDisplayCode: string;
  propertyId: string;
  propertyDisplayCode: string;
  propertyTokenId?: string | null; // NEW: Token tier ID (if investing in specific token)
  propertyTokenDisplayCode?: string | null; // NEW: Token symbol (e.g., "MBT")
  organizationId: string;
  organizationDisplayCode: string;
  tokensPurchased: Decimal;
  amountUSDT: Decimal;
  investmentId: string;
  investmentDisplayCode: string;
  transactionId: string; // Transaction ID for certificate generation
  transactionDisplayCode: string; // Transaction display code
}

/**
 * Event emitted when an investment fails
 */
export interface InvestmentFailedEvent {
  eventId: string;
  timestamp: Date;
  userId: string;
  userDisplayCode: string;
  propertyId: string;
  propertyDisplayCode: string;
  reason: string;
  error?: Error;
}

