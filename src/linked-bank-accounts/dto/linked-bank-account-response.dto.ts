import { LinkedBankAccount } from '../entities/linked-bank-account.entity';

export class LinkedBankAccountResponseDto {
  id: string;
  userId: string;
  accountHolderName: string;
  accountNumber: string;
  iban?: string;
  bankName: string;
  swiftCode?: string;
  branch?: string;
  accountType?: string;
  status: 'pending' | 'verified' | 'disabled';
  isDefault: boolean;
  displayName?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;

  // Mask account number for security (show only last 4 digits)
  get maskedAccountNumber(): string {
    if (!this.accountNumber || this.accountNumber.length <= 4) {
      return '****';
    }
    return `****${this.accountNumber.slice(-4)}`;
  }

  static fromEntity(entity: LinkedBankAccount): LinkedBankAccountResponseDto {
    const dto = new LinkedBankAccountResponseDto();
    dto.id = entity.id;
    dto.userId = entity.userId;
    dto.accountHolderName = entity.accountHolderName;
    dto.accountNumber = entity.accountNumber; // Include full number in DTO, frontend can mask
    dto.iban = entity.iban;
    dto.bankName = entity.bankName;
    dto.swiftCode = entity.swiftCode;
    dto.branch = entity.branch;
    dto.accountType = entity.accountType;
    dto.status = entity.status;
    dto.isDefault = entity.isDefault;
    dto.displayName = entity.displayName;
    dto.metadata = entity.metadata;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  static fromEntities(entities: LinkedBankAccount[]): LinkedBankAccountResponseDto[] {
    return entities.map(entity => this.fromEntity(entity));
  }
}
