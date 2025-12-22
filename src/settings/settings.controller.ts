import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Get bank account details (public - users need this)
   */
  @Get('bank-account')
  @Public()
  async getBankAccountDetails() {
    const details = await this.settingsService.getBankAccountDetails();
    return {
      success: true,
      data: details,
    };
  }

  /**
   * Update bank account details (admin only)
   */
  @Patch('bank-account')
  async updateBankAccountDetails(@Body() details: any) {
    const updated = await this.settingsService.updateBankAccountDetails(details);
    return {
      success: true,
      data: updated,
      message: 'Bank account details updated successfully',
    };
  }

  /**
   * Get all settings (admin only)
   */
  @Get()
  async getAllSettings() {
    const settings = await this.settingsService.getAllSettings();
    return {
      success: true,
      data: settings,
    };
  }
}


