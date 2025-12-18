/**
 * Event emitted when a user is created with auto-creation
 */
export interface UserCreatedEvent {
  eventId: string;
  timestamp: Date;
  userId: string;
  userDisplayCode: string;
  fullName: string;
  email: string;
  phone?: string;
  walletId: string;
  kycId: string;
  portfolioId: string;
}
