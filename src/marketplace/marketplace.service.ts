import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Decimal from 'decimal.js';
import { MarketplaceListing } from './entities/marketplace-listing.entity';
import { MarketplaceTrade } from './entities/marketplace-trade.entity';
import { TokenLock } from './entities/token-lock.entity';
import { Investment } from '../investments/entities/investment.entity';
import { Property } from '../properties/entities/property.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../admin/entities/user.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { BuyTokensDto } from './dto/buy-tokens.dto';
import { GetListingsDto, ListingSortBy } from './dto/get-listings.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { CertificatesService } from '../certificates/certificates.service';

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(MarketplaceListing)
    private readonly listingRepo: Repository<MarketplaceListing>,
    @InjectRepository(MarketplaceTrade)
    private readonly tradeRepo: Repository<MarketplaceTrade>,
    @InjectRepository(TokenLock)
    private readonly tokenLockRepo: Repository<TokenLock>,
    @InjectRepository(Investment)
    private readonly investmentRepo: Repository<Investment>,
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationsService: NotificationsService,
    private readonly certificatesService: CertificatesService,
  ) {}

  /**
   * Get user's available tokens for a property (excluding locked tokens)
   */
  async getUserAvailableTokens(userId: string, propertyId: string): Promise<Decimal> {
    try {
      // Get all confirmed/active investments for this user and property
      // Note: Investments typically use 'confirmed' status, not 'active'
      const investments = await this.investmentRepo.find({
        where: [
          { userId, propertyId, status: 'confirmed' },
          { userId, propertyId, status: 'active' },
        ],
      });

      if (investments.length === 0) {
        return new Decimal(0);
      }

      // Calculate total owned tokens
      let totalOwned = new Decimal(0);
      for (const investment of investments) {
        totalOwned = totalOwned.plus(investment.tokensPurchased as Decimal);
      }

      // Get total locked tokens from active listings
      // Use explicit join with table names to avoid column name issues
      const investmentIds = investments.map((inv) => inv.id);
      if (investmentIds.length === 0) {
        return totalOwned;
      }

      const locks = await this.tokenLockRepo
        .createQueryBuilder('lock')
        .innerJoin(
          'marketplace_listings',
          'listing',
          'listing.id = lock.listing_id AND listing.status = :status',
          { status: 'active' },
        )
        .where('lock.investment_id IN (:...investmentIds)', {
          investmentIds,
        })
        .getMany();

      let totalLocked = new Decimal(0);
      for (const lock of locks) {
        totalLocked = totalLocked.plus(lock.lockedTokens as Decimal);
      }

      return totalOwned.minus(totalLocked);
    } catch (error) {
      this.logger.error(`Error getting available tokens for user ${userId}, property ${propertyId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new marketplace listing
   */
  async createListing(userId: string, dto: CreateListingDto): Promise<MarketplaceListing> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Validate property exists
      const property = await manager.findOne(Property, {
        where: { id: dto.propertyId },
      });
      if (!property) {
        throw new NotFoundException('Property not found');
      }

      // 2. Check user has available tokens
      const availableTokens = await this.getUserAvailableTokens(userId, dto.propertyId);
      const tokensToLock = new Decimal(dto.totalTokens);

      if (availableTokens.lt(tokensToLock)) {
        throw new BadRequestException(
          `Insufficient tokens. Available: ${availableTokens.toString()}, Requested: ${tokensToLock.toString()}`,
        );
      }

      // 3. Validate min/max order limits
      const minOrder = new Decimal(dto.minOrderUSDT);
      const maxOrder = new Decimal(dto.maxOrderUSDT);
      if (maxOrder.lt(minOrder)) {
        throw new BadRequestException('maxOrderUSDT must be >= minOrderUSDT');
      }

      const pricePerToken = new Decimal(dto.pricePerToken);
      const minTokensForMinOrder = minOrder.div(pricePerToken);
      const maxTokensForMaxOrder = maxOrder.div(pricePerToken);

      if (tokensToLock.lt(minTokensForMinOrder)) {
        throw new BadRequestException(
          `Total tokens (${tokensToLock.toString()}) must be at least enough for min order (${minTokensForMinOrder.toString()} tokens)`,
        );
      }

      // 4. Get user's investments for this property to lock tokens
      // Note: Investments typically use 'confirmed' status, not 'active'
      const investments = await manager.find(Investment, {
        where: [
          { userId, propertyId: dto.propertyId, status: 'confirmed' },
          { userId, propertyId: dto.propertyId, status: 'active' },
        ],
        order: {
          createdAt: 'ASC', // Lock from oldest investments first
        },
      });

      // 5. Create listing
      const listingResult = await manager.query(
        'SELECT nextval(\'marketplace_listing_display_seq\') as nextval',
      );
      const displayCode = `MKT-${listingResult[0].nextval.toString().padStart(6, '0')}`;

      const listing = manager.create(MarketplaceListing, {
        displayCode,
        sellerId: userId,
        propertyId: dto.propertyId,
        pricePerToken,
        totalTokens: tokensToLock,
        remainingTokens: tokensToLock,
        minOrderUSDT: minOrder,
        maxOrderUSDT: maxOrder,
        status: 'active',
      });
      const savedListing = await manager.save(MarketplaceListing, listing);

      // 6. Lock tokens from investments
      let remainingToLock = tokensToLock;
      for (const investment of investments) {
        if (remainingToLock.lte(0)) break;

        // Check how much is already locked from this investment
        const existingLocks = await manager
          .createQueryBuilder(TokenLock, 'lock')
          .where('lock.investment_id = :investmentId', { investmentId: investment.id })
          .getMany();
        let alreadyLocked = new Decimal(0);
        for (const lock of existingLocks) {
          // Check if lock is for an active listing
          const lockListing = await manager
            .createQueryBuilder(MarketplaceListing, 'listing')
            .where('listing.id = :listingId', { listingId: lock.listingId })
            .andWhere('listing.status = :status', { status: 'active' })
            .getOne();
          if (lockListing) {
            alreadyLocked = alreadyLocked.plus(lock.lockedTokens as Decimal);
          }
        }

        const availableFromInvestment = (investment.tokensPurchased as Decimal).minus(
          alreadyLocked,
        );

        if (availableFromInvestment.gt(0)) {
          const toLock = Decimal.min(remainingToLock, availableFromInvestment);
          const tokenLock = manager.create(TokenLock, {
            investmentId: investment.id,
            listingId: savedListing.id,
            lockedTokens: toLock,
          });
          await manager.save(TokenLock, tokenLock);
          remainingToLock = remainingToLock.minus(toLock);
        }
      }

      if (remainingToLock.gt(0)) {
        throw new BadRequestException('Failed to lock all requested tokens');
      }

      this.logger.log(`Listing created: ${displayCode} by user ${userId}`);

      // 7. Send notification to seller
      try {
        await this.notificationsService.queueNotification({
          userId,
          title: 'Listing Published',
          message: `Your listing for ${property.title} has been published on the marketplace`,
          data: {
            type: 'marketplace',
            listingId: savedListing.id,
            displayCode: savedListing.displayCode,
            propertyId: property.id,
            propertyTitle: property.title,
          },
        });
      } catch (error) {
        this.logger.error('Failed to send listing notification:', error);
      }

      // Load relations for response
      const listingWithRelations = await manager.findOne(MarketplaceListing, {
        where: { id: savedListing.id },
        relations: ['property', 'seller'],
      });
      
      if (!listingWithRelations) {
        throw new Error('Failed to load created listing');
      }
      
      return listingWithRelations;
    });
  }

  /**
   * Get all active listings with filters and sorting
   */
  async getListings(dto: GetListingsDto, currentUserId?: string) {
    const query = this.listingRepo
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.property', 'property')
      .leftJoinAndSelect('listing.seller', 'seller')
      .where('listing.status = :status', { status: 'active' })
      .andWhere('listing.remainingTokens > 0');

    // Filter by property
    if (dto.propertyId) {
      query.andWhere('listing.propertyId = :propertyId', { propertyId: dto.propertyId });
    }

    // Exclude seller's own listings
    if (currentUserId) {
      query.andWhere('listing.sellerId != :currentUserId', { currentUserId });
    }

    // Sorting
    switch (dto.sortBy) {
      case ListingSortBy.PRICE_ASC:
        query.orderBy('listing.pricePerToken', 'ASC');
        break;
      case ListingSortBy.PRICE_DESC:
        query.orderBy('listing.pricePerToken', 'DESC');
        break;
      case ListingSortBy.CREATED_AT_ASC:
        query.orderBy('listing.createdAt', 'ASC');
        break;
      case ListingSortBy.ROI_DESC:
        query.orderBy('property.expectedROI', 'DESC');
        break;
      case ListingSortBy.CREATED_AT_DESC:
      default:
        query.orderBy('listing.createdAt', 'DESC');
        break;
    }

    // Pagination
    const limit = dto.limit || 20;
    const offset = dto.offset || 0;
    query.take(limit).skip(offset);

    const [listings, total] = await query.getManyAndCount();

    // Anonymize seller information and ensure Decimal fields are converted to numbers
    const anonymizedListings = listings.map((listing) => {
      const seller = listing.seller;
      // Convert property.expectedROI to number if it's a Decimal
      const property = listing.property ? {
        ...listing.property,
        expectedROI: listing.property.expectedROI instanceof Decimal 
          ? listing.property.expectedROI.toNumber() 
          : (typeof listing.property.expectedROI === 'number' ? listing.property.expectedROI : Number(listing.property.expectedROI || 0)),
        images: listing.property.images || null, // Ensure images are included
      } : listing.property;

      const baseListing: any = {
        id: listing.id,
        displayCode: listing.displayCode,
        sellerId: listing.sellerId,
        propertyId: listing.propertyId,
        property: property,
        status: listing.status,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        // Convert Decimal fields to numbers for JSON serialization
        pricePerToken: listing.pricePerToken instanceof Decimal ? listing.pricePerToken.toNumber() : Number(listing.pricePerToken || 0),
        totalTokens: listing.totalTokens instanceof Decimal ? listing.totalTokens.toNumber() : Number(listing.totalTokens || 0),
        remainingTokens: listing.remainingTokens instanceof Decimal ? listing.remainingTokens.toNumber() : Number(listing.remainingTokens || 0),
        minOrderUSDT: listing.minOrderUSDT instanceof Decimal ? listing.minOrderUSDT.toNumber() : Number(listing.minOrderUSDT || 0),
        maxOrderUSDT: listing.maxOrderUSDT instanceof Decimal ? listing.maxOrderUSDT.toNumber() : Number(listing.maxOrderUSDT || 0),
      };
      
      if (seller) {
        const anonymizedId = `${seller.displayCode.substring(0, 3)}***${seller.displayCode.substring(seller.displayCode.length - 2)}`;
        baseListing.seller = {
          id: anonymizedId,
          displayCode: anonymizedId,
          // Don't expose fullName, email, etc.
        };
      }
      
      return baseListing;
    });

    return {
      listings: anonymizedListings,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get a single listing by ID
   */
  async getListingById(listingId: string, currentUserId?: string): Promise<MarketplaceListing> {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId },
      relations: ['property', 'seller'],
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Anonymize seller if not the current user
    if (currentUserId && listing.sellerId !== currentUserId && listing.seller) {
      const seller = listing.seller;
      const anonymizedId = `${seller.displayCode.substring(0, 3)}***${seller.displayCode.substring(seller.displayCode.length - 2)}`;
      listing.seller = {
        ...seller,
        id: anonymizedId,
        displayCode: anonymizedId,
        fullName: 'Seller',
        email: '',
        phone: null,
      } as User;
    }

    // Convert Decimal fields to numbers for JSON serialization
    return {
      id: listing.id,
      displayCode: listing.displayCode,
      sellerId: listing.sellerId,
      seller: listing.seller,
      propertyId: listing.propertyId,
      property: listing.property,
      status: listing.status,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      // Convert Decimal fields to numbers for JSON serialization
      pricePerToken: listing.pricePerToken instanceof Decimal ? listing.pricePerToken.toNumber() : Number(listing.pricePerToken || 0),
      totalTokens: listing.totalTokens instanceof Decimal ? listing.totalTokens.toNumber() : Number(listing.totalTokens || 0),
      remainingTokens: listing.remainingTokens instanceof Decimal ? listing.remainingTokens.toNumber() : Number(listing.remainingTokens || 0),
      minOrderUSDT: listing.minOrderUSDT instanceof Decimal ? listing.minOrderUSDT.toNumber() : Number(listing.minOrderUSDT || 0),
      maxOrderUSDT: listing.maxOrderUSDT instanceof Decimal ? listing.maxOrderUSDT.toNumber() : Number(listing.maxOrderUSDT || 0),
    } as any;
  }

  /**
   * Buy tokens from a listing (atomic transaction)
   */
  async buyTokens(buyerId: string, dto: BuyTokensDto): Promise<MarketplaceTrade> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Lock listing (pessimistic lock)
      // Note: Cannot use FOR UPDATE with LEFT JOIN, so load listing first, then relations
      const listing = await manager.findOne(MarketplaceListing, {
        where: { id: dto.listingId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!listing) {
        throw new NotFoundException('Listing not found');
      }

      // Load relations separately (after lock is acquired)
      // Use innerJoin since property and seller are required
      const fullListing = await manager
        .createQueryBuilder(MarketplaceListing, 'listing')
        .innerJoinAndSelect('listing.property', 'property')
        .innerJoinAndSelect('listing.seller', 'seller')
        .where('listing.id = :id', { id: listing.id })
        .getOne();

      if (!fullListing) {
        throw new NotFoundException('Listing with relations not found');
      }

      // Copy relations to the locked listing object
      listing.property = fullListing.property;
      listing.seller = fullListing.seller;

      if (listing.status !== 'active') {
        throw new BadRequestException('Listing is not active');
      }

      // 2. Prevent self-buying
      if (listing.sellerId === buyerId) {
        throw new ForbiddenException('Cannot buy your own listing');
      }

      // 3. Validate tokens to buy
      const tokensToBuy = new Decimal(dto.tokensToBuy);
      if (tokensToBuy.lte(0)) {
        throw new BadRequestException('Tokens to buy must be greater than 0');
      }

      if (tokensToBuy.gt(listing.remainingTokens as Decimal)) {
        throw new BadRequestException(
          `Insufficient tokens. Available: ${listing.remainingTokens.toString()}, Requested: ${tokensToBuy.toString()}`,
        );
      }

      // 4. Calculate total USDT
      const totalUSDT = (listing.pricePerToken as Decimal).mul(tokensToBuy);

      // 5. Validate min/max order limits
      if (totalUSDT.lt(listing.minOrderUSDT as Decimal)) {
        throw new BadRequestException(
          `Order amount (${totalUSDT.toString()} USDT) is below minimum (${listing.minOrderUSDT.toString()} USDT)`,
        );
      }

      if (totalUSDT.gt(listing.maxOrderUSDT as Decimal)) {
        throw new BadRequestException(
          `Order amount (${totalUSDT.toString()} USDT) exceeds maximum (${listing.maxOrderUSDT.toString()} USDT)`,
        );
      }

      // 6. Lock buyer wallet
      const buyerWallet = await manager.findOne(Wallet, {
        where: { userId: buyerId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!buyerWallet) {
        throw new NotFoundException('Buyer wallet not found');
      }

      // 7. Validate buyer balance
      if ((buyerWallet.balanceUSDT as Decimal).lt(totalUSDT)) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      // 8. Lock seller wallet
      const sellerWallet = await manager.findOne(Wallet, {
        where: { userId: listing.sellerId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!sellerWallet) {
        throw new NotFoundException('Seller wallet not found');
      }

      // 9. Execute wallet transfers
      buyerWallet.balanceUSDT = (buyerWallet.balanceUSDT as Decimal).minus(totalUSDT);
      sellerWallet.balanceUSDT = (sellerWallet.balanceUSDT as Decimal).plus(totalUSDT);
      sellerWallet.totalDepositedUSDT = (sellerWallet.totalDepositedUSDT as Decimal).plus(
        totalUSDT,
      );

      await manager.save([buyerWallet, sellerWallet]);

      // 10. Update listing
      listing.remainingTokens = (listing.remainingTokens as Decimal).minus(tokensToBuy);
      if (listing.remainingTokens.lte(0)) {
        listing.status = 'sold';
      }
      await manager.save(MarketplaceListing, listing);

      // 11. Transfer tokens: Update seller's investment and create/update buyer's investment
      // Get token locks for this listing
      const locks = await manager
        .createQueryBuilder(TokenLock, 'lock')
        .leftJoinAndSelect('lock.investment', 'investment')
        .where('lock.listing_id = :listingId', { listingId: listing.id })
        .getMany();

      // Reduce tokens from seller's investments (proportionally)
      // Track which investment was updated for certificate regeneration
      let sellerInvestmentId: string | undefined;
      let remainingToDeduct = tokensToBuy;
      for (const lock of locks) {
        if (remainingToDeduct.lte(0)) break;

        const investment = lock.investment;
        const lockedAmount = lock.lockedTokens as Decimal;
        const toDeduct = Decimal.min(remainingToDeduct, lockedAmount);

        // Update seller's investment
        investment.tokensPurchased = (investment.tokensPurchased as Decimal).minus(toDeduct);
        if (investment.tokensPurchased.lte(0)) {
          investment.status = 'sold';
        }
        await manager.save(Investment, investment);
        
        // Track the first investment that was updated (for certificate regeneration)
        if (!sellerInvestmentId && investment.tokensPurchased.gt(0)) {
          sellerInvestmentId = investment.id;
        }

        // Update lock
        lock.lockedTokens = lockedAmount.minus(toDeduct);
        if (lock.lockedTokens.lte(0)) {
          await manager.remove(TokenLock, lock);
        } else {
          await manager.save(TokenLock, lock);
        }

        remainingToDeduct = remainingToDeduct.minus(toDeduct);
      }
      
      // If no investment with remaining tokens, find the most recent one that was updated
      if (!sellerInvestmentId && locks.length > 0) {
        sellerInvestmentId = locks[0].investment.id;
      }

      // 12. Create or update buyer's investment
      // Note: Investments typically use 'confirmed' status, not 'active'
      let buyerInvestment = await manager.findOne(Investment, {
        where: [
          { userId: buyerId, propertyId: listing.propertyId, status: 'confirmed' },
          { userId: buyerId, propertyId: listing.propertyId, status: 'active' },
        ],
      });

      if (buyerInvestment) {
        // Update existing investment
        buyerInvestment.tokensPurchased = (buyerInvestment.tokensPurchased as Decimal).plus(
          tokensToBuy,
        );
        buyerInvestment.amountUSDT = (buyerInvestment.amountUSDT as Decimal).plus(totalUSDT);
        await manager.save(Investment, buyerInvestment);
      } else {
        // Create new investment for buyer
        const invResult = await manager.query(
          'SELECT nextval(\'investment_display_seq\') as nextval',
        );
        const invDisplayCode = `INV-${invResult[0].nextval.toString().padStart(6, '0')}`;

        // Get expectedROI from property - ensure it's a Decimal
        const propertyExpectedROI = listing.property.expectedROI instanceof Decimal 
          ? listing.property.expectedROI 
          : new Decimal(listing.property.expectedROI || 0);

        buyerInvestment = manager.create(Investment, {
          displayCode: invDisplayCode,
          userId: buyerId,
          propertyId: listing.propertyId,
          tokensPurchased: tokensToBuy,
          amountUSDT: totalUSDT,
          status: 'confirmed', // Use 'confirmed' status for new investments
          paymentStatus: 'completed',
          expectedROI: propertyExpectedROI,
        });
        await manager.save(Investment, buyerInvestment);
      }

      // 13. Create transactions
      const txnResult = await manager.query(
        'SELECT nextval(\'transaction_display_seq\') as nextval',
      );
      const txnDisplayCode = `TXN-${txnResult[0].nextval.toString().padStart(6, '0')}`;

      // Buyer transaction (debit)
      const buyerTransaction = manager.create(Transaction, {
        displayCode: txnDisplayCode,
        userId: buyerId,
        walletId: buyerWallet.id,
        propertyId: listing.propertyId,
        type: 'marketplace_buy',
        amountUSDT: totalUSDT,
        status: 'completed',
        description: `Purchased ${tokensToBuy.toString()} tokens from marketplace`,
        referenceId: listing.displayCode,
        metadata: {
          listingId: listing.id,
          tokensBought: tokensToBuy.toString(),
          pricePerToken: listing.pricePerToken.toString(),
        },
      });
      await manager.save(Transaction, buyerTransaction);

      // Seller transaction (credit)
      const sellerTxnResult = await manager.query(
        'SELECT nextval(\'transaction_display_seq\') as nextval',
      );
      const sellerTxnDisplayCode = `TXN-${sellerTxnResult[0].nextval.toString().padStart(6, '0')}`;

      const sellerTransaction = manager.create(Transaction, {
        displayCode: sellerTxnDisplayCode,
        userId: listing.sellerId,
        walletId: sellerWallet.id,
        propertyId: listing.propertyId,
        type: 'marketplace_sell',
        amountUSDT: totalUSDT,
        status: 'completed',
        description: `Sold ${tokensToBuy.toString()} tokens on marketplace`,
        referenceId: listing.displayCode,
        metadata: {
          listingId: listing.id,
          tokensSold: tokensToBuy.toString(),
          pricePerToken: listing.pricePerToken.toString(),
        },
      });
      await manager.save(Transaction, sellerTransaction);

      // 14. Create trade record
      const tradeResult = await manager.query(
        'SELECT nextval(\'marketplace_trade_display_seq\') as nextval',
      );
      const tradeDisplayCode = `TRD-${tradeResult[0].nextval.toString().padStart(6, '0')}`;

      const trade = manager.create(MarketplaceTrade, {
        displayCode: tradeDisplayCode,
        listingId: listing.id,
        buyerId,
        sellerId: listing.sellerId,
        propertyId: listing.propertyId,
        tokensBought: tokensToBuy,
        totalUSDT,
        pricePerToken: listing.pricePerToken,
        buyerTransactionId: buyerTransaction.id,
        sellerTransactionId: sellerTransaction.id,
        metadata: {
          listingDisplayCode: listing.displayCode,
          buyerInvestmentId: buyerInvestment.id, // Store investment ID in metadata for certificate linking
        },
      });
      await manager.save(MarketplaceTrade, trade);

      this.logger.log(
        `Trade completed: ${tradeDisplayCode} - Buyer: ${buyerId}, Seller: ${listing.sellerId}, Tokens: ${tokensToBuy.toString()}`,
      );

      // 15. Emit event for certificate generation (after transaction commits)
      this.eventEmitter.emit('marketplace.trade.completed', {
        tradeId: trade.id,
        tradeDisplayCode: trade.displayCode,
        buyerId,
        sellerId: listing.sellerId,
        propertyId: listing.propertyId,
        propertyTitle: listing.property.title,
        tokensBought: tokensToBuy.toString(),
        totalUSDT: totalUSDT.toString(),
        buyerInvestmentId: buyerInvestment.id, // Pass investment ID for certificate linking
        sellerInvestmentId: sellerInvestmentId, // Pass seller investment ID for certificate regeneration
      });

      // 16. Send notifications
      try {
        // Notify buyer
        await this.notificationsService.queueNotification({
          userId: buyerId,
          title: 'Purchase Successful',
          message: `You successfully purchased ${tokensToBuy.toString()} tokens of ${listing.property.title}`,
          data: {
            type: 'marketplace',
            tradeId: trade.id,
            displayCode: trade.displayCode,
            propertyId: listing.propertyId,
            propertyTitle: listing.property.title,
            tokensBought: tokensToBuy.toString(),
          },
        });

        // Notify seller
        await this.notificationsService.queueNotification({
          userId: listing.sellerId,
          title: 'Tokens Sold',
          message: `You sold ${tokensToBuy.toString()} tokens of ${listing.property.title} for ${totalUSDT.toString()} USDT`,
          data: {
            type: 'marketplace',
            tradeId: trade.id,
            displayCode: trade.displayCode,
            propertyId: listing.propertyId,
            propertyTitle: listing.property.title,
            tokensSold: tokensToBuy.toString(),
            amountReceived: totalUSDT.toString(),
          },
        });
      } catch (error) {
        this.logger.error('Failed to send trade notifications:', error);
      }

      // Load relations for response
      const tradeWithRelations = await manager.findOne(MarketplaceTrade, {
        where: { id: trade.id },
        relations: ['listing', 'buyer', 'seller', 'property'],
      });
      
      if (!tradeWithRelations) {
        throw new Error('Failed to load created trade');
      }
      
      return tradeWithRelations;
    });
  }

  /**
   * Cancel a listing (unlock tokens)
   */
  async cancelListing(userId: string, listingId: string): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const listing = await manager.findOne(MarketplaceListing, {
        where: { id: listingId },
      });

      if (!listing) {
        throw new NotFoundException('Listing not found');
      }

      if (listing.sellerId !== userId) {
        throw new ForbiddenException('Cannot cancel someone else\'s listing');
      }

      if (listing.status !== 'active') {
        throw new BadRequestException('Only active listings can be cancelled');
      }

      // Delete token locks (CASCADE will handle this, but we do it explicitly)
      await manager
        .createQueryBuilder()
        .delete()
        .from(TokenLock)
        .where('listing_id = :listingId', { listingId: listing.id })
        .execute();

      // Update listing status
      listing.status = 'cancelled';
      await manager.save(MarketplaceListing, listing);

      this.logger.log(`Listing cancelled: ${listing.displayCode} by user ${userId}`);
    });
  }

  /**
   * Get user's listings
   */
  async getMyListings(userId: string) {
    const listings = await this.listingRepo.find({
      where: { sellerId: userId },
      relations: ['property', 'seller'],
      order: { createdAt: 'DESC' },
    });

    // Convert Decimal fields to numbers and ensure property images are included
    return listings.map((listing) => {
      const property = listing.property ? {
        ...listing.property,
        expectedROI: listing.property.expectedROI instanceof Decimal 
          ? listing.property.expectedROI.toNumber() 
          : (typeof listing.property.expectedROI === 'number' ? listing.property.expectedROI : Number(listing.property.expectedROI || 0)),
        images: listing.property.images || null, // Ensure images are included
      } : listing.property;

      return {
        id: listing.id,
        displayCode: listing.displayCode,
        sellerId: listing.sellerId,
        propertyId: listing.propertyId,
        property: property,
        seller: listing.seller ? {
          id: listing.seller.id,
          displayCode: listing.seller.displayCode,
        } : null,
        status: listing.status,
        createdAt: listing.createdAt,
        updatedAt: listing.updatedAt,
        // Convert Decimal fields to numbers for JSON serialization
        pricePerToken: listing.pricePerToken instanceof Decimal ? listing.pricePerToken.toNumber() : Number(listing.pricePerToken || 0),
        totalTokens: listing.totalTokens instanceof Decimal ? listing.totalTokens.toNumber() : Number(listing.totalTokens || 0),
        remainingTokens: listing.remainingTokens instanceof Decimal ? listing.remainingTokens.toNumber() : Number(listing.remainingTokens || 0),
        minOrderUSDT: listing.minOrderUSDT instanceof Decimal ? listing.minOrderUSDT.toNumber() : Number(listing.minOrderUSDT || 0),
        maxOrderUSDT: listing.maxOrderUSDT instanceof Decimal ? listing.maxOrderUSDT.toNumber() : Number(listing.maxOrderUSDT || 0),
      };
    });
  }

  /**
   * Get user's trade history
   */
  async getMyTrades(userId: string) {
    const trades = await this.tradeRepo.find({
      where: [{ buyerId: userId }, { sellerId: userId }],
      relations: ['listing', 'property', 'buyer', 'seller'],
      order: { createdAt: 'DESC' },
    });

    // Convert Decimal fields to numbers for JSON serialization
    return trades.map((trade) => ({
      id: trade.id,
      displayCode: trade.displayCode,
      listingId: trade.listingId,
      buyerId: trade.buyerId,
      sellerId: trade.sellerId,
      propertyId: trade.propertyId,
      property: trade.property,
      tokensBought: trade.tokensBought instanceof Decimal ? trade.tokensBought.toNumber() : Number(trade.tokensBought || 0),
      totalUSDT: trade.totalUSDT instanceof Decimal ? trade.totalUSDT.toNumber() : Number(trade.totalUSDT || 0),
      pricePerToken: trade.pricePerToken instanceof Decimal ? trade.pricePerToken.toNumber() : Number(trade.pricePerToken || 0),
      certificatePath: trade.certificatePath,
      createdAt: trade.createdAt,
    }));
  }
}

