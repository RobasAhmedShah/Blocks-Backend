import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepo: Repository<Setting>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get setting value by key, with fallback to environment variable
   */
  async getSetting(key: string, defaultValue?: string): Promise<string | null> {
    try {
      const setting = await this.settingsRepo.findOne({ where: { key } });
      if (setting) {
        return setting.value;
      }

      // Fallback to environment variable
      const envValue = this.configService.get<string>(key);
      if (envValue) {
        return envValue;
      }

      return defaultValue || null;
    } catch (error) {
      this.logger.error(`Error getting setting ${key}:`, error);
      // Fallback to environment variable on error
      return this.configService.get<string>(key) || defaultValue || null;
    }
  }

  /**
   * Set or update a setting
   */
  async setSetting(key: string, value: string, description?: string): Promise<Setting> {
    let setting = await this.settingsRepo.findOne({ where: { key } });

    if (setting) {
      setting.value = value;
      if (description) {
        setting.description = description;
      }
    } else {
      setting = this.settingsRepo.create({
        key,
        value,
        description,
      });
    }

    return this.settingsRepo.save(setting);
  }

  /**
   * Get all settings
   */
  async getAllSettings(): Promise<Setting[]> {
    return this.settingsRepo.find({
      order: { key: 'ASC' },
    });
  }

  /**
   * Get bank account details (with fallback to env)
   */
  async getBankAccountDetails(): Promise<{
    accountName: string;
    accountNumber: string;
    iban: string;
    bankName: string;
    swiftCode: string;
    branch: string;
  }> {
    const accountName = await this.getSetting('BANK_ACCOUNT_NAME', 'Blocks Investment Platform');
    const accountNumber = await this.getSetting('BANK_ACCOUNT_NUMBER', 'PK12BLOCKS0001234567890');
    const iban = await this.getSetting('BANK_IBAN', 'PK12BLOCKS0001234567890');
    const bankName = await this.getSetting('BANK_NAME', 'Standard Chartered Bank');
    const swiftCode = await this.getSetting('BANK_SWIFT_CODE', 'SCBLPKKA');
    const branch = await this.getSetting('BANK_BRANCH', 'Main Branch, Karachi');

    return {
      accountName: accountName || 'Blocks Investment Platform',
      accountNumber: accountNumber || 'PK12BLOCKS0001234567890',
      iban: iban || 'PK12BLOCKS0001234567890',
      bankName: bankName || 'Standard Chartered Bank',
      swiftCode: swiftCode || 'SCBLPKKA',
      branch: branch || 'Main Branch, Karachi',
    };
  }

  /**
   * Update bank account details
   */
  async updateBankAccountDetails(details: {
    accountName?: string;
    accountNumber?: string;
    iban?: string;
    bankName?: string;
    swiftCode?: string;
    branch?: string;
  }) {
    const updates: Promise<Setting>[] = [];

    if (details.accountName !== undefined) {
      updates.push(
        this.setSetting('BANK_ACCOUNT_NAME', details.accountName, 'Bank account name for deposits'),
      );
    }
    if (details.accountNumber !== undefined) {
      updates.push(
        this.setSetting('BANK_ACCOUNT_NUMBER', details.accountNumber, 'Bank account number for deposits'),
      );
    }
    if (details.iban !== undefined) {
      updates.push(this.setSetting('BANK_IBAN', details.iban, 'Bank IBAN for deposits'));
    }
    if (details.bankName !== undefined) {
      updates.push(this.setSetting('BANK_NAME', details.bankName, 'Bank name for deposits'));
    }
    if (details.swiftCode !== undefined) {
      updates.push(this.setSetting('BANK_SWIFT_CODE', details.swiftCode, 'Bank SWIFT code for deposits'));
    }
    if (details.branch !== undefined) {
      updates.push(this.setSetting('BANK_BRANCH', details.branch, 'Bank branch for deposits'));
    }

    await Promise.all(updates);
    return this.getBankAccountDetails();
  }
}
