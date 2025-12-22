import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  Headers,
} from '@nestjs/common';
import { BankWithdrawalsService } from './bank-withdrawals.service';
import { CreateBankWithdrawalDto } from './dto/create-bank-withdrawal.dto';
import { CompleteBankWithdrawalDto } from './dto/complete-bank-withdrawal.dto';
import { RejectBankWithdrawalDto } from './dto/reject-bank-withdrawal.dto';
import { JwtAuthGuard } from '../mobile-auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../admin/entities/user.entity';
import { Public } from '../common/decorators/public.decorator';

/**
 * Mobile endpoints for bank withdrawals
 */
@Controller('api/mobile/bank-withdrawals')
export class BankWithdrawalsController {
  private readonly logger = new Logger(BankWithdrawalsController.name);

  constructor(private readonly withdrawalsService: BankWithdrawalsService) {}

  /**
   * Create withdrawal request (mobile, JWT auth)
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async createRequest(
    @CurrentUser() user: User,
    @Body() dto: CreateBankWithdrawalDto,
  ) {
    const request = await this.withdrawalsService.createRequest(user.id, dto);
    return {
      success: true,
      data: request,
      message: 'Withdrawal request created successfully',
    };
  }

  /**
   * Get user's withdrawal requests (mobile, JWT auth)
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserRequests(@CurrentUser() user: User) {
    const requests = await this.withdrawalsService.getUserRequests(user.id);
    return {
      success: true,
      data: requests,
      count: requests.length,
    };
  }

  /**
   * Get single withdrawal request by ID (mobile, JWT auth)
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getRequest(@CurrentUser() user: User, @Param('id') id: string) {
    const request = await this.withdrawalsService.getRequestById(id);

    // Verify request belongs to user
    if (request.userId !== user.id) {
      throw new Error('Unauthorized: This withdrawal request does not belong to you');
    }

    return {
      success: true,
      data: request,
    };
  }
}

/**
 * Admin endpoints for managing withdrawal requests
 */
@Controller('admin/bank-withdrawals')
export class AdminBankWithdrawalsController {
  private readonly logger = new Logger(AdminBankWithdrawalsController.name);

  constructor(private readonly withdrawalsService: BankWithdrawalsService) {
    this.logger.log('AdminBankWithdrawalsController initialized');
  }

  /**
   * Test endpoint to verify route registration
   */
  @Get('test')
  @Public()
  testRoute() {
    return {
      success: true,
      message: 'Admin bank withdrawals route is working',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get all withdrawal requests (admin)
   */
  @Get()
  async getAllRequests(
    @Query('status') status?: 'pending' | 'completed' | 'rejected',
  ) {
    const requests = await this.withdrawalsService.getAllRequests(status);
    return {
      success: true,
      data: requests,
      count: requests.length,
    };
  }

  /**
   * Complete withdrawal (admin confirms transfer and debits wallet)
   * IMPORTANT: This route must come BEFORE @Get(':id') to avoid route conflicts
   */
  @Patch(':id/complete')
  @Public() // No JWT required - works with just adminId
  async completeWithdrawal(
    @Param('id') id: string,
    @Body() body: CompleteBankWithdrawalDto & { adminId?: string },
    @Headers('x-admin-id') adminIdHeader?: string,
  ) {
    this.logger.log(
      `Complete withdrawal called: id=${id}, adminId=${adminIdHeader || body.adminId}, bankTransactionId=${body.bankTransactionId}`,
    );

    const adminId = adminIdHeader || body.adminId;
    if (!adminId) {
      this.logger.error('adminId is missing in request');
      throw new Error('adminId is required (in header x-admin-id or request body)');
    }

    const dto: CompleteBankWithdrawalDto = {
      bankTransactionId: body.bankTransactionId,
      bankTransactionProofUrl: body.bankTransactionProofUrl,
    };

    if (!dto.bankTransactionId) {
      this.logger.error('bankTransactionId is missing in request body');
      throw new Error('bankTransactionId is required in request body');
    }

    try {
      const request = await this.withdrawalsService.completeWithdrawal(id, adminId, dto);
      this.logger.log(`Withdrawal ${id} completed successfully by admin ${adminId}`);

      return {
        success: true,
        data: request,
        message: 'Withdrawal completed successfully. Wallet debited.',
      };
    } catch (error) {
      this.logger.error(`Error completing withdrawal ${id}:`, error);
      throw error;
    }
  }

  /**
   * Reject withdrawal request (admin)
   * IMPORTANT: This route must come AFTER @Patch(':id/complete') but BEFORE @Get(':id')
   */
  @Patch(':id/reject')
  @Public() // No JWT required - works with just adminId
  async rejectWithdrawal(
    @Param('id') id: string,
    @Body() body: RejectBankWithdrawalDto & { adminId?: string },
    @Headers('x-admin-id') adminIdHeader?: string,
  ) {
    this.logger.log(
      `Reject withdrawal called: id=${id}, adminId=${adminIdHeader || body.adminId}`,
    );

    const adminId = adminIdHeader || body.adminId;
    if (!adminId) {
      this.logger.error('adminId is missing in request');
      throw new Error('adminId is required (in header x-admin-id or request body)');
    }

    const dto: RejectBankWithdrawalDto = {
      rejectionReason: body.rejectionReason,
    };

    if (!dto.rejectionReason) {
      this.logger.error('rejectionReason is missing in request body');
      throw new Error('rejectionReason is required in request body');
    }

    try {
      const request = await this.withdrawalsService.rejectWithdrawal(id, adminId, dto);
      this.logger.log(`Withdrawal ${id} rejected by admin ${adminId}`);

      return {
        success: true,
        data: request,
        message: 'Withdrawal rejected successfully',
      };
    } catch (error) {
      this.logger.error(`Error rejecting withdrawal ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get single withdrawal request by ID (admin)
   * IMPORTANT: This catch-all route must come LAST to avoid route conflicts
   */
  @Get(':id')
  async getRequest(@Param('id') id: string) {
    const request = await this.withdrawalsService.getRequestById(id);
    return {
      success: true,
      data: request,
    };
  }
}


