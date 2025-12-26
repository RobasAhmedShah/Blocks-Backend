import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { BuyTokensDto } from './dto/buy-tokens.dto';
import { GetListingsDto } from './dto/get-listings.dto';
import { JwtAuthGuard } from '../mobile-auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../admin/entities/user.entity';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  /**
   * Get all active listings (public, but can filter by current user)
   */
  @Get('listings')
  @Public()
  async getListings(@Query() dto: GetListingsDto, @CurrentUser() user?: User) {
    return this.marketplaceService.getListings(dto, user?.id);
  }

  /**
   * Get a single listing by ID
   */
  @Get('listings/:id')
  @Public()
  async getListing(@Param('id') id: string, @CurrentUser() user?: User) {
    return this.marketplaceService.getListingById(id, user?.id);
  }

  /**
   * Create a new listing (authenticated)
   */
  @Post('listings')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createListing(
    @CurrentUser() user: User,
    @Body() dto: CreateListingDto,
  ) {
    return this.marketplaceService.createListing(user.id, dto);
  }

  /**
   * Buy tokens from a listing (authenticated)
   */
  @Post('listings/:id/buy')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async buyTokens(
    @CurrentUser() user: User,
    @Param('id') listingId: string,
    @Body() dto: Omit<BuyTokensDto, 'listingId'>,
  ) {
    // Use listingId from URL path
    const buyDto: BuyTokensDto = {
      ...dto,
      listingId,
    };
    return this.marketplaceService.buyTokens(user.id, buyDto);
  }

  /**
   * Cancel a listing (authenticated, seller only)
   */
  @Delete('listings/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelListing(@CurrentUser() user: User, @Param('id') id: string) {
    await this.marketplaceService.cancelListing(user.id, id);
  }

  /**
   * Get current user's listings
   */
  @Get('my-listings')
  @UseGuards(JwtAuthGuard)
  async getMyListings(@CurrentUser() user: User) {
    return this.marketplaceService.getMyListings(user.id);
  }

  /**
   * Get current user's trade history (both as buyer and seller)
   */
  @Get('my-trades')
  @UseGuards(JwtAuthGuard)
  async getMyTrades(@CurrentUser() user: User) {
    return this.marketplaceService.getMyTrades(user.id);
  }

  /**
   * Get user's available tokens for a property (for sell form)
   */
  @Get('available-tokens/:propertyId')
  @UseGuards(JwtAuthGuard)
  async getAvailableTokens(
    @CurrentUser() user: User,
    @Param('propertyId') propertyId: string,
  ) {
    // Validate propertyId
    if (!propertyId || propertyId === 'undefined' || propertyId === 'null') {
      throw new BadRequestException('Property ID is required');
    }

    const available = await this.marketplaceService.getUserAvailableTokens(
      user.id,
      propertyId,
    );
    return { availableTokens: available.toString() };
  }
}

