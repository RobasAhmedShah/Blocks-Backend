import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../../admin/entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { Property } from '../../properties/entities/property.entity';
import { Investment } from '../../investments/entities/investment.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Reward } from '../../rewards/entities/reward.entity';
import { KycVerification } from '../../kyc/entities/kyc-verification.entity';
import { Wallet } from '../../wallet/entities/wallet.entity';
import { PaymentMethod } from '../../payment-methods/entities/payment-method.entity';
import { Portfolio } from '../../portfolio/entities/portfolio.entity';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import Decimal from 'decimal.js';

@Injectable()
export class AdminAnalyticsService {
  private readonly logger = new Logger(AdminAnalyticsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(Investment)
    private readonly investmentRepo: Repository<Investment>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Reward)
    private readonly rewardRepo: Repository<Reward>,
    @InjectRepository(KycVerification)
    private readonly kycRepo: Repository<KycVerification>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepo: Repository<PaymentMethod>,
    @InjectRepository(Portfolio)
    private readonly portfolioRepo: Repository<Portfolio>,
  ) {}

  async getDashboardStats(query: DashboardQueryDto) {
    const resolvedFilters = await this.resolveFilters(query);
    
    this.logger.log(`Dashboard query filters:`, { original: query, resolved: resolvedFilters });
    
    // If filtering by a specific user, return user-specific dashboard
    if (resolvedFilters.userId) {
      this.logger.log(`Returning user-specific dashboard for userId: ${resolvedFilters.userId}`);
      return this.getUserSpecificDashboard(resolvedFilters);
    }
    
    // If filtering by organization or property, return filtered platform dashboard
    if (resolvedFilters.organizationId || resolvedFilters.propertyId) {
      this.logger.log(`Returning filtered platform dashboard`);
      return this.getFilteredPlatformDashboard(resolvedFilters);
    }
    
    // Default: return platform-wide dashboard
    this.logger.log(`Returning platform-wide dashboard`);
    return this.getPlatformDashboard(resolvedFilters);
  }

  private async getPlatformDashboard(filters: any) {
    const [
      overview,
      users,
      kyc,
      properties,
      investments,
      transactions,
      recentActivity
    ] = await Promise.all([
      this.getOverviewStats(filters),
      this.getUserEngagement(filters),
      this.getKycStats(filters),
      this.getPropertyMetrics(filters),
      this.getInvestmentMetrics(filters),
      this.getTransactionMetrics(filters),
      this.getRecentActivity(filters)
    ]);

    return {
      overview,
      users,
      kyc,
      properties,
      investments,
      transactions,
      recentActivity
    };
  }

  private async getFilteredPlatformDashboard(filters: any) {
    // If filtering by organization, return organization-specific dashboard
    if (filters.organizationId) {
      return this.getOrganizationSpecificDashboard(filters);
    }
    
    // If filtering by property, return property-specific dashboard
    if (filters.propertyId) {
      return this.getPropertySpecificDashboard(filters);
    }
    
    // Default filtered platform dashboard
    const [
      overview,
      users,
      kyc,
      properties,
      investments,
      transactions,
      recentActivity
    ] = await Promise.all([
      this.getOverviewStats(filters),
      this.getUserEngagement(filters),
      this.getKycStats(filters),
      this.getPropertyMetrics(filters),
      this.getInvestmentMetrics(filters),
      this.getTransactionMetrics(filters),
      this.getRecentActivity(filters)
    ]);

    return {
      overview,
      users,
      kyc,
      properties,
      investments,
      transactions,
      recentActivity
    };
  }

  private async getUserSpecificDashboard(filters: any) {
    const userId = filters.userId;
    
    const [
      user,
      wallet,
      kyc,
      investments,
      rewards,
      transactions,
      paymentMethods,
      portfolio
    ] = await Promise.all([
      this.getUserDetails(userId),
      this.getUserWallet(userId),
      this.getUserKyc(userId),
      this.getUserInvestments(userId),
      this.getUserRewards(userId),
      this.getUserTransactions(userId),
      this.getUserPaymentMethods(userId),
      this.getUserPortfolio(userId)
    ]);

    return {
      user,
      wallet,
      kyc,
      investments,
      rewards,
      transactions,
      paymentMethods,
      portfolio
    };
  }

  async getAnalytics(query: AnalyticsQueryDto) {
    const { fromDate, toDate } = this.calculateDateRange(query);
    const resolvedFilters = await this.resolveFilters(query);
    
    const [
      timeSeries,
      aggregated,
      comparison
    ] = await Promise.all([
      this.getTimeSeriesData(fromDate, toDate, resolvedFilters),
      this.getAggregatedMetrics(fromDate, toDate, resolvedFilters),
      this.getPeriodComparison(fromDate, toDate, resolvedFilters)
    ]);

    return {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      timeSeries,
      aggregated,
      comparison
    };
  }

  private async resolveFilters(filters: any) {
    const resolved = { ...filters };
    
    if (filters.userId && !this.isUUID(filters.userId)) {
      const user = await this.userRepo.findOne({ where: { displayCode: filters.userId } });
      if (!user) {
        throw new Error(`User with displayCode '${filters.userId}' not found`);
      }
      resolved.userId = user.id;
      this.logger.log(`Resolved user displayCode '${filters.userId}' to UUID '${user.id}'`);
    }
    if (filters.organizationId && !this.isUUID(filters.organizationId)) {
      const org = await this.orgRepo.findOne({ where: { displayCode: filters.organizationId } });
      if (!org) {
        throw new Error(`Organization with displayCode '${filters.organizationId}' not found`);
      }
      resolved.organizationId = org.id;
      this.logger.log(`Resolved organization displayCode '${filters.organizationId}' to UUID '${org.id}'`);
    }
    if (filters.propertyId && !this.isUUID(filters.propertyId)) {
      const prop = await this.propertyRepo.findOne({ where: { displayCode: filters.propertyId } });
      if (!prop) {
        throw new Error(`Property with displayCode '${filters.propertyId}' not found`);
      }
      resolved.propertyId = prop.id;
      this.logger.log(`Resolved property displayCode '${filters.propertyId}' to UUID '${prop.id}'`);
    }
    
    return resolved;
  }

  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  private calculateDateRange(query: AnalyticsQueryDto) {
    const now = new Date();
    let fromDate: Date;
    let toDate: Date = now;

    if (query.period) {
      switch (query.period) {
        case '7d':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
    } else if (query.from && query.to) {
      fromDate = new Date(query.from);
      toDate = new Date(query.to);
    } else {
      // Default to last 30 days
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { fromDate, toDate };
  }

  private async getOverviewStats(filters: any) {
    const userQuery = this.userRepo.createQueryBuilder('user');
    const orgQuery = this.orgRepo.createQueryBuilder('org');
    const propertyQuery = this.propertyRepo.createQueryBuilder('property');
    const investmentQuery = this.investmentRepo.createQueryBuilder('investment');
    const transactionQuery = this.transactionRepo.createQueryBuilder('transaction');
    const rewardQuery = this.rewardRepo.createQueryBuilder('reward');

    // Apply filters
    if (filters.userId) {
      investmentQuery.andWhere('investment.userId = :userId', { userId: filters.userId });
      transactionQuery.andWhere('transaction.userId = :userId', { userId: filters.userId });
      rewardQuery.andWhere('reward.userId = :userId', { userId: filters.userId });
    }
    if (filters.organizationId) {
      propertyQuery.andWhere('property.organizationId = :orgId', { orgId: filters.organizationId });
      investmentQuery.innerJoin('investment.property', 'prop')
        .andWhere('prop.organizationId = :orgId', { orgId: filters.organizationId });
    }
    if (filters.propertyId) {
      investmentQuery.andWhere('investment.propertyId = :propertyId', { propertyId: filters.propertyId });
    }

    const [
      totalUsers,
      activeUsers,
      totalOrgs,
      totalProperties,
      totalInvestments,
      totalInvestmentValue,
      totalTransactions,
      totalTransactionVolume,
      totalRewards
    ] = await Promise.all([
      userQuery.getCount(),
      userQuery.clone().andWhere('user.isActive = true').getCount(),
      orgQuery.getCount(),
      propertyQuery.getCount(),
      investmentQuery.getCount(),
      investmentQuery.clone().select('SUM(investment.amountUSDT)', 'total').getRawOne(),
      transactionQuery.getCount(),
      transactionQuery.clone().select('SUM(transaction.amountUSDT)', 'total').getRawOne(),
      rewardQuery.clone().select('SUM(reward.amountUSDT)', 'total').getRawOne()
    ]);

    // Get platform revenue (sum of organization liquidity)
    const platformRevenueQuery = this.orgRepo.createQueryBuilder('org')
      .select('SUM(org.liquidityUSDT)', 'total');
    const platformRevenue = await platformRevenueQuery.getRawOne();

    return {
      totalUsers,
      activeUsers,
      totalOrganizations: totalOrgs,
      totalProperties,
      totalInvestments,
      totalInvestmentValue: totalInvestmentValue?.total || '0',
      totalTransactions,
      totalTransactionVolume: totalTransactionVolume?.total || '0',
      platformRevenue: platformRevenue?.total || '0',
      totalRewardsDistributed: totalRewards?.total || '0'
    };
  }

  private async getUserEngagement(filters: any) {
    const userQuery = this.userRepo.createQueryBuilder('user');
    
    if (filters.userId) {
      userQuery.andWhere('user.id = :userId', { userId: filters.userId });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [
      total,
      active,
      inactive,
      newThisMonth
    ] = await Promise.all([
      userQuery.getCount(),
      userQuery.clone().andWhere('user.isActive = true').getCount(),
      userQuery.clone().andWhere('user.isActive = false').getCount(),
      userQuery.clone().andWhere('user.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo }).getCount()
    ]);

    return {
      total,
      active,
      inactive,
      newThisMonth
    };
  }

  private async getKycStats(filters: any) {
    const kycQuery = this.kycRepo.createQueryBuilder('kyc');
    
    if (filters.userId) {
      kycQuery.andWhere('kyc.userId = :userId', { userId: filters.userId });
    }

    const [pending, verified, rejected] = await Promise.all([
      kycQuery.clone().andWhere('kyc.status = :status', { status: 'pending' }).getCount(),
      kycQuery.clone().andWhere('kyc.status = :status', { status: 'verified' }).getCount(),
      kycQuery.clone().andWhere('kyc.status = :status', { status: 'rejected' }).getCount()
    ]);

    return { pending, verified, rejected };
  }

  private async getPropertyMetrics(filters: any) {
    const propertyQuery = this.propertyRepo.createQueryBuilder('property');
    
    if (filters.organizationId) {
      propertyQuery.andWhere('property.organizationId = :orgId', { orgId: filters.organizationId });
    }
    if (filters.propertyId) {
      propertyQuery.andWhere('property.id = :propertyId', { propertyId: filters.propertyId });
    }

    const [active, soldout, construction, total] = await Promise.all([
      propertyQuery.clone().andWhere('property.status = :status', { status: 'active' }).getCount(),
      propertyQuery.clone().andWhere('property.status = :status', { status: 'soldout' }).getCount(),
      propertyQuery.clone().andWhere('property.status = :status', { status: 'construction' }).getCount(),
      propertyQuery.getCount()
    ]);

    return { active, soldout, construction, total };
  }

  private async getInvestmentMetrics(filters: any) {
    const investmentQuery = this.investmentRepo.createQueryBuilder('investment');
    
    if (filters.userId) {
      investmentQuery.andWhere('investment.userId = :userId', { userId: filters.userId });
    }
    if (filters.organizationId) {
      investmentQuery.innerJoin('investment.property', 'prop')
        .andWhere('prop.organizationId = :orgId', { orgId: filters.organizationId });
    }
    if (filters.propertyId) {
      investmentQuery.andWhere('investment.propertyId = :propertyId', { propertyId: filters.propertyId });
    }

    const [count, totalValue, averageInvestment] = await Promise.all([
      investmentQuery.getCount(),
      investmentQuery.clone().select('SUM(investment.amountUSDT)', 'total').getRawOne(),
      investmentQuery.clone().select('AVG(investment.amountUSDT)', 'avg').getRawOne()
    ]);

    return {
      count,
      totalValue: totalValue?.total || '0',
      averageInvestment: averageInvestment?.avg || '0'
    };
  }

  private async getTransactionMetrics(filters: any) {
    const transactionQuery = this.transactionRepo.createQueryBuilder('transaction');
    
    if (filters.userId) {
      transactionQuery.andWhere('transaction.userId = :userId', { userId: filters.userId });
    }
    if (filters.organizationId) {
      transactionQuery.andWhere('transaction.organizationId = :orgId', { orgId: filters.organizationId });
    }
    if (filters.propertyId) {
      transactionQuery.andWhere('transaction.propertyId = :propertyId', { propertyId: filters.propertyId });
    }

    const [count, totalVolume, byType] = await Promise.all([
      transactionQuery.getCount(),
      transactionQuery.clone().select('SUM(transaction.amountUSDT)', 'total').getRawOne(),
      this.getTransactionByType(filters)
    ]);

    return {
      count,
      totalVolume: totalVolume?.total || '0',
      byType
    };
  }

  private async getTransactionByType(filters: any) {
    const transactionQuery = this.transactionRepo.createQueryBuilder('transaction');
    
    if (filters.userId) {
      transactionQuery.andWhere('transaction.userId = :userId', { userId: filters.userId });
    }
    if (filters.organizationId) {
      transactionQuery.andWhere('transaction.organizationId = :orgId', { orgId: filters.organizationId });
    }
    if (filters.propertyId) {
      transactionQuery.andWhere('transaction.propertyId = :propertyId', { propertyId: filters.propertyId });
    }

    const types = ['deposit', 'investment', 'reward', 'withdrawal', 'inflow'];
    const byType = {};

    for (const type of types) {
      const count = await transactionQuery.clone()
        .andWhere('transaction.type = :type', { type })
        .getCount();
      byType[type] = count;
    }

    return byType;
  }

  private async getRecentActivity(filters: any) {
    const recentInvestments = await this.investmentRepo.createQueryBuilder('investment')
      .leftJoinAndSelect('investment.user', 'user')
      .leftJoinAndSelect('investment.property', 'property')
      .orderBy('investment.createdAt', 'DESC')
      .limit(5)
      .getMany();

    const recentTransactions = await this.transactionRepo.createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.user', 'user')
      .orderBy('transaction.createdAt', 'DESC')
      .limit(5)
      .getMany();

    const recentUsers = await this.userRepo.createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .limit(5)
      .getMany();

    const pendingKycReviews = await this.kycRepo.createQueryBuilder('kyc')
      .leftJoinAndSelect('kyc.user', 'user')
      .where('kyc.status = :status', { status: 'pending' })
      .orderBy('kyc.submittedAt', 'DESC')
      .limit(10)
      .getMany();

    return {
      recentInvestments,
      recentTransactions,
      recentUsers,
      pendingKycReviews
    };
  }

  private async getTimeSeriesData(fromDate: Date, toDate: Date, filters: any) {
    const users = await this.getUserTimeSeries(fromDate, toDate, filters);
    const investments = await this.getInvestmentTimeSeries(fromDate, toDate, filters);
    const rewards = await this.getRewardTimeSeries(fromDate, toDate, filters);
    const transactions = await this.getTransactionTimeSeries(fromDate, toDate, filters);
    const kycVerifications = await this.getKycTimeSeries(fromDate, toDate, filters);

    return {
      users,
      investments,
      rewards,
      transactions,
      kycVerifications
    };
  }

  private async getUserTimeSeries(fromDate: Date, toDate: Date, filters: any) {
    const query = this.userRepo.createQueryBuilder('user')
      .select("DATE_TRUNC('day', user.createdAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('user.createdAt >= :fromDate', { fromDate })
      .andWhere('user.createdAt <= :toDate', { toDate })
      .groupBy("DATE_TRUNC('day', user.createdAt)")
      .orderBy('date', 'ASC');

    if (filters.userId) {
      query.andWhere('user.id = :userId', { userId: filters.userId });
    }

    return query.getRawMany();
  }

  private async getInvestmentTimeSeries(fromDate: Date, toDate: Date, filters: any) {
    const query = this.investmentRepo.createQueryBuilder('investment')
      .select("DATE_TRUNC('day', investment.createdAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(investment.amountUSDT)', 'volume')
      .where('investment.createdAt >= :fromDate', { fromDate })
      .andWhere('investment.createdAt <= :toDate', { toDate })
      .groupBy("DATE_TRUNC('day', investment.createdAt)")
      .orderBy('date', 'ASC');

    if (filters.userId) {
      query.andWhere('investment.userId = :userId', { userId: filters.userId });
    }
    if (filters.organizationId) {
      query.innerJoin('investment.property', 'prop')
        .andWhere('prop.organizationId = :orgId', { orgId: filters.organizationId });
    }
    if (filters.propertyId) {
      query.andWhere('investment.propertyId = :propertyId', { propertyId: filters.propertyId });
    }

    return query.getRawMany();
  }

  private async getRewardTimeSeries(fromDate: Date, toDate: Date, filters: any) {
    const query = this.rewardRepo.createQueryBuilder('reward')
      .select("DATE_TRUNC('day', reward.createdAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(reward.amountUSDT)', 'amount')
      .where('reward.createdAt >= :fromDate', { fromDate })
      .andWhere('reward.createdAt <= :toDate', { toDate })
      .groupBy("DATE_TRUNC('day', reward.createdAt)")
      .orderBy('date', 'ASC');

    if (filters.userId) {
      query.andWhere('reward.userId = :userId', { userId: filters.userId });
    }

    return query.getRawMany();
  }

  private async getTransactionTimeSeries(fromDate: Date, toDate: Date, filters: any) {
    const query = this.transactionRepo.createQueryBuilder('transaction')
      .select("DATE_TRUNC('day', transaction.createdAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(transaction.amountUSDT)', 'volume')
      .where('transaction.createdAt >= :fromDate', { fromDate })
      .andWhere('transaction.createdAt <= :toDate', { toDate })
      .groupBy("DATE_TRUNC('day', transaction.createdAt)")
      .orderBy('date', 'ASC');

    if (filters.userId) {
      query.andWhere('transaction.userId = :userId', { userId: filters.userId });
    }
    if (filters.organizationId) {
      query.andWhere('transaction.organizationId = :orgId', { orgId: filters.organizationId });
    }
    if (filters.propertyId) {
      query.andWhere('transaction.propertyId = :propertyId', { propertyId: filters.propertyId });
    }

    return query.getRawMany();
  }

  private async getKycTimeSeries(fromDate: Date, toDate: Date, filters: any) {
    const query = this.kycRepo.createQueryBuilder('kyc')
      .select("DATE_TRUNC('day', kyc.createdAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('kyc.createdAt >= :fromDate', { fromDate })
      .andWhere('kyc.createdAt <= :toDate', { toDate })
      .groupBy("DATE_TRUNC('day', kyc.createdAt)")
      .orderBy('date', 'ASC');

    if (filters.userId) {
      query.andWhere('kyc.userId = :userId', { userId: filters.userId });
    }

    return query.getRawMany();
  }

  private async getAggregatedMetrics(fromDate: Date, toDate: Date, filters: any) {
    const users = await this.getUserAggregated(fromDate, toDate, filters);
    const investments = await this.getInvestmentAggregated(fromDate, toDate, filters);
    const rewards = await this.getRewardAggregated(fromDate, toDate, filters);
    const transactions = await this.getTransactionAggregated(fromDate, toDate, filters);

    return {
      users,
      investments,
      rewards,
      transactions
    };
  }

  private async getUserAggregated(fromDate: Date, toDate: Date, filters: any) {
    const query = this.userRepo.createQueryBuilder('user')
      .where('user.createdAt >= :fromDate', { fromDate })
      .andWhere('user.createdAt <= :toDate', { toDate });

    if (filters.userId) {
      query.andWhere('user.id = :userId', { userId: filters.userId });
    }

    const [total, peak] = await Promise.all([
      query.getCount(),
      query.clone()
        .select("DATE_TRUNC('day', user.createdAt)", 'date')
        .addSelect('COUNT(*)', 'count')
        .groupBy("DATE_TRUNC('day', user.createdAt)")
        .orderBy('count', 'DESC')
        .limit(1)
        .getRawOne()
    ]);

    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    const average = daysDiff > 0 ? total / daysDiff : 0;

    return {
      total,
      average: Math.round(average * 100) / 100,
      peak: peak ? { date: peak.date, count: parseInt(peak.count) } : null
    };
  }

  private async getInvestmentAggregated(fromDate: Date, toDate: Date, filters: any) {
    const query = this.investmentRepo.createQueryBuilder('investment')
      .where('investment.createdAt >= :fromDate', { fromDate })
      .andWhere('investment.createdAt <= :toDate', { toDate });

    if (filters.userId) {
      query.andWhere('investment.userId = :userId', { userId: filters.userId });
    }
    if (filters.organizationId) {
      query.innerJoin('investment.property', 'prop')
        .andWhere('prop.organizationId = :orgId', { orgId: filters.organizationId });
    }
    if (filters.propertyId) {
      query.andWhere('investment.propertyId = :propertyId', { propertyId: filters.propertyId });
    }

    const [total, totalValue, peak] = await Promise.all([
      query.getCount(),
      query.clone().select('SUM(investment.amountUSDT)', 'total').getRawOne(),
      query.clone()
        .select("DATE_TRUNC('day', investment.createdAt)", 'date')
        .addSelect('COUNT(*)', 'count')
        .addSelect('SUM(investment.amountUSDT)', 'volume')
        .groupBy("DATE_TRUNC('day', investment.createdAt)")
        .orderBy('count', 'DESC')
        .limit(1)
        .getRawOne()
    ]);

    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    const average = daysDiff > 0 ? total / daysDiff : 0;

    return {
      total,
      totalValue: totalValue?.total || '0',
      average: Math.round(average * 100) / 100,
      peak: peak ? { date: peak.date, count: parseInt(peak.count), volume: peak.volume } : null
    };
  }

  private async getRewardAggregated(fromDate: Date, toDate: Date, filters: any) {
    const query = this.rewardRepo.createQueryBuilder('reward')
      .where('reward.createdAt >= :fromDate', { fromDate })
      .andWhere('reward.createdAt <= :toDate', { toDate });

    if (filters.userId) {
      query.andWhere('reward.userId = :userId', { userId: filters.userId });
    }

    const [total, totalAmount, peak] = await Promise.all([
      query.getCount(),
      query.clone().select('SUM(reward.amountUSDT)', 'total').getRawOne(),
      query.clone()
        .select("DATE_TRUNC('day', reward.createdAt)", 'date')
        .addSelect('COUNT(*)', 'count')
        .addSelect('SUM(reward.amountUSDT)', 'amount')
        .groupBy("DATE_TRUNC('day', reward.createdAt)")
        .orderBy('count', 'DESC')
        .limit(1)
        .getRawOne()
    ]);

    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    const average = daysDiff > 0 ? total / daysDiff : 0;

    return {
      total,
      totalAmount: totalAmount?.total || '0',
      average: Math.round(average * 100) / 100,
      peak: peak ? { date: peak.date, count: parseInt(peak.count), amount: peak.amount } : null
    };
  }

  private async getTransactionAggregated(fromDate: Date, toDate: Date, filters: any) {
    const query = this.transactionRepo.createQueryBuilder('transaction')
      .where('transaction.createdAt >= :fromDate', { fromDate })
      .andWhere('transaction.createdAt <= :toDate', { toDate });

    if (filters.userId) {
      query.andWhere('transaction.userId = :userId', { userId: filters.userId });
    }
    if (filters.organizationId) {
      query.andWhere('transaction.organizationId = :orgId', { orgId: filters.organizationId });
    }
    if (filters.propertyId) {
      query.andWhere('transaction.propertyId = :propertyId', { propertyId: filters.propertyId });
    }

    const [total, totalVolume, peak] = await Promise.all([
      query.getCount(),
      query.clone().select('SUM(transaction.amountUSDT)', 'total').getRawOne(),
      query.clone()
        .select("DATE_TRUNC('day', transaction.createdAt)", 'date')
        .addSelect('COUNT(*)', 'count')
        .addSelect('SUM(transaction.amountUSDT)', 'volume')
        .groupBy("DATE_TRUNC('day', transaction.createdAt)")
        .orderBy('count', 'DESC')
        .limit(1)
        .getRawOne()
    ]);

    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    const average = daysDiff > 0 ? total / daysDiff : 0;

    return {
      total,
      totalVolume: totalVolume?.total || '0',
      average: Math.round(average * 100) / 100,
      peak: peak ? { date: peak.date, count: parseInt(peak.count), volume: peak.volume } : null
    };
  }

  private async getPeriodComparison(fromDate: Date, toDate: Date, filters: any) {
    const periodDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    const previousFromDate = new Date(fromDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const previousToDate = new Date(fromDate.getTime() - 1);

    const [currentPeriod, previousPeriod] = await Promise.all([
      this.getAggregatedMetrics(fromDate, toDate, filters),
      this.getAggregatedMetrics(previousFromDate, previousToDate, filters)
    ]);

    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100 * 100) / 100;
    };

    return {
      previousPeriod,
      changePercentage: {
        users: calculateGrowth(currentPeriod.users.total, previousPeriod.users.total),
        investments: calculateGrowth(currentPeriod.investments.total, previousPeriod.investments.total),
        rewards: calculateGrowth(currentPeriod.rewards.total, previousPeriod.rewards.total),
        transactions: calculateGrowth(currentPeriod.transactions.total, previousPeriod.transactions.total)
      }
    };
  }

  // User-specific dashboard methods
  private async getUserDetails(userId: string) {
    return this.userRepo.findOne({ 
      where: { id: userId },
      select: ['id', 'displayCode', 'fullName', 'email', 'phone', 'isActive', 'createdAt', 'updatedAt']
    });
  }

  private async getUserWallet(userId: string) {
    return this.walletRepo.findOne({ 
      where: { userId },
      select: ['id', 'balanceUSDT', 'lockedUSDT', 'totalDepositedUSDT', 'totalWithdrawnUSDT', 'createdAt', 'updatedAt']
    });
  }

  private async getUserKyc(userId: string) {
    return this.kycRepo.findOne({ 
      where: { userId },
      order: { createdAt: 'DESC' },
      select: ['id', 'type', 'status', 'submittedAt', 'reviewedAt', 'rejectionReason']
    });
  }

  private async getUserInvestments(userId: string) {
    const [investments, totalValue, count] = await Promise.all([
      this.investmentRepo.find({
        where: { userId },
        relations: ['property'],
        order: { createdAt: 'DESC' },
        take: 10,
        select: ['id', 'displayCode', 'tokensPurchased', 'amountUSDT', 'status', 'paymentStatus', 'expectedROI', 'createdAt']
      }),
      this.investmentRepo
        .createQueryBuilder('investment')
        .select('SUM(investment.amountUSDT)', 'total')
        .where('investment.userId = :userId', { userId })
        .getRawOne(),
      this.investmentRepo.count({ where: { userId } })
    ]);

    return {
      recent: investments,
      totalValue: totalValue?.total || '0',
      count
    };
  }

  private async getUserRewards(userId: string) {
    const [rewards, totalAmount, count] = await Promise.all([
      this.rewardRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 10,
        select: ['id', 'displayCode', 'amountUSDT', 'type', 'status', 'createdAt']
      }),
      this.rewardRepo
        .createQueryBuilder('reward')
        .select('SUM(reward.amountUSDT)', 'total')
        .where('reward.userId = :userId', { userId })
        .getRawOne(),
      this.rewardRepo.count({ where: { userId } })
    ]);

    return {
      recent: rewards,
      totalAmount: totalAmount?.total || '0',
      count
    };
  }

  private async getUserTransactions(userId: string) {
    const [transactions, totalVolume, count] = await Promise.all([
      this.transactionRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 10,
        select: ['id', 'displayCode', 'type', 'amountUSDT', 'status', 'description', 'createdAt']
      }),
      this.transactionRepo
        .createQueryBuilder('transaction')
        .select('SUM(transaction.amountUSDT)', 'total')
        .where('transaction.userId = :userId', { userId })
        .getRawOne(),
      this.transactionRepo.count({ where: { userId } })
    ]);

    return {
      recent: transactions,
      totalVolume: totalVolume?.total || '0',
      count
    };
  }

  private async getUserPaymentMethods(userId: string) {
    const [paymentMethods, verifiedCount] = await Promise.all([
      this.paymentMethodRepo.find({
        where: { userId },
        relations: ['cardDetails'],
        order: { createdAt: 'DESC' },
        select: ['id', 'type', 'status', 'isDefault', 'createdAt']
      }),
      this.paymentMethodRepo.count({ 
        where: { userId, status: 'verified' }
      })
    ]);

    return {
      methods: paymentMethods,
      verifiedCount,
      totalCount: paymentMethods.length
    };
  }

  private async getUserPortfolio(userId: string) {
    const portfolio = await this.portfolioRepo.findOne({ 
      where: { userId },
      select: ['totalInvestedUSDT', 'activeInvestments', 'totalRewardsUSDT', 'totalROIUSDT', 'lastUpdated']
    });

    if (!portfolio) {
      return {
        totalInvested: '0',
        activeInvestments: 0,
        totalEarned: '0',
        totalROI: '0',
        lastUpdated: new Date()
      };
    }

    return {
      totalInvested: portfolio.totalInvestedUSDT?.toString() || '0',
      activeInvestments: portfolio.activeInvestments || 0,
      totalEarned: portfolio.totalRewardsUSDT?.toString() || '0',
      totalROI: portfolio.totalROIUSDT?.toString() || '0',
      lastUpdated: portfolio.lastUpdated || new Date()
    };
  }
 // Organization-specific dashboard methods
 private async getOrganizationSpecificDashboard(filters: any) {
    const organizationId = filters.organizationId;
    
    const [
      organization,
      properties,
      investments,
      transactions,
      liquidity,
      investors
    ] = await Promise.all([
      this.getOrganizationDetails(organizationId),
      this.getOrganizationProperties(organizationId),
      this.getOrganizationInvestments(organizationId),
      this.getOrganizationTransactions(organizationId),
      this.getOrganizationLiquidity(organizationId),
      this.getOrganizationInvestors(organizationId)
    ]);

    return {
      organization,
      properties,
      investments,
      transactions,
      liquidity,
      investors
    };
  }

  // Property-specific dashboard methods
  private async getPropertySpecificDashboard(filters: any) {
    const propertyId = filters.propertyId;
    
    const [
      property,
      investments,
      transactions,
      investors,
      tokens
    ] = await Promise.all([
      this.getPropertyDetails(propertyId),
      this.getPropertyInvestments(propertyId),
      this.getPropertyTransactions(propertyId),
      this.getPropertyInvestors(propertyId),
      this.getPropertyTokens(propertyId)
    ]);

    return {
      property,
      investments,
      transactions,
      investors,
      tokens
    };
  }

  // Organization helper methods
  private async getOrganizationDetails(organizationId: string) {
    return this.orgRepo.findOne({ 
      where: { id: organizationId },
      select: ['id', 'displayCode', 'name', 'description', 'website', 'logoUrl', 'liquidityUSDT', 'createdAt', 'updatedAt']
    });
  }

  private async getOrganizationProperties(organizationId: string) {
    const [properties, totalCount, activeCount, soldoutCount] = await Promise.all([
      this.propertyRepo.find({
        where: { organizationId },
        order: { createdAt: 'DESC' },
        take: 10,
        select: ['id', 'displayCode', 'title', 'status', 'totalValueUSDT', 'totalTokens', 'availableTokens', 'pricePerTokenUSDT', 'expectedROI', 'createdAt']
      }),
      this.propertyRepo.count({ where: { organizationId } }),
      this.propertyRepo.count({ where: { organizationId, status: 'active' } }),
      this.propertyRepo.count({ where: { organizationId, status: 'soldout' } })
    ]);

    return {
      recent: properties,
      total: totalCount,
      active: activeCount,
      soldout: soldoutCount
    };
  }

  private async getOrganizationInvestments(organizationId: string) {
    const [investments, totalValue, count] = await Promise.all([
      this.investmentRepo.find({
        where: { property: { organizationId } },
        relations: ['user', 'property'],
        order: { createdAt: 'DESC' },
        take: 10,
        select: ['id', 'displayCode', 'tokensPurchased', 'amountUSDT', 'status', 'paymentStatus', 'expectedROI', 'createdAt']
      }),
      this.investmentRepo
        .createQueryBuilder('investment')
        .leftJoin('investment.property', 'property')
        .select('SUM(investment.amountUSDT)', 'total')
        .where('property.organizationId = :organizationId', { organizationId })
        .getRawOne(),
      this.investmentRepo
        .createQueryBuilder('investment')
        .leftJoin('investment.property', 'property')
        .where('property.organizationId = :organizationId', { organizationId })
        .getCount()
    ]);

    return {
      recent: investments,
      totalValue: totalValue?.total || '0',
      count
    };
  }

  private async getOrganizationTransactions(organizationId: string) {
    const [transactions, totalVolume, count] = await Promise.all([
      this.transactionRepo.find({
        where: { organizationId },
        relations: ['user'],
        order: { createdAt: 'DESC' },
        take: 10,
        select: ['id', 'displayCode', 'type', 'amountUSDT', 'status', 'description', 'createdAt']
      }),
      this.transactionRepo
        .createQueryBuilder('transaction')
        .select('SUM(transaction.amountUSDT)', 'total')
        .where('transaction.organizationId = :organizationId', { organizationId })
        .getRawOne(),
      this.transactionRepo.count({ where: { organizationId } })
    ]);

    return {
      recent: transactions,
      totalVolume: totalVolume?.total || '0',
      count
    };
  }

  private async getOrganizationLiquidity(organizationId: string) {
    const organization = await this.orgRepo.findOne({ 
      where: { id: organizationId },
      select: ['liquidityUSDT', 'updatedAt']
    });

    return {
      currentLiquidity: organization?.liquidityUSDT?.toString() || '0',
      lastUpdated: organization?.updatedAt || new Date()
    };
  }

  private async getOrganizationInvestors(organizationId: string) {
    const [uniqueInvestors, totalInvestments] = await Promise.all([
      this.investmentRepo
        .createQueryBuilder('investment')
        .leftJoin('investment.property', 'property')
        .select('COUNT(DISTINCT investment.userId)', 'count')
        .where('property.organizationId = :organizationId', { organizationId })
        .getRawOne(),
      this.investmentRepo
        .createQueryBuilder('investment')
        .leftJoin('investment.property', 'property')
        .where('property.organizationId = :organizationId', { organizationId })
        .getCount()
    ]);

    return {
      uniqueInvestors: parseInt(uniqueInvestors?.count) || 0,
      totalInvestments
    };
  }

  // Property helper methods
  private async getPropertyDetails(propertyId: string) {
    return this.propertyRepo.findOne({ 
      where: { id: propertyId },
      relations: ['organization'],
      select: ['id', 'displayCode', 'title', 'description', 'type', 'status', 'totalValueUSDT', 'totalTokens', 'availableTokens', 'pricePerTokenUSDT', 'expectedROI', 'city', 'country', 'features', 'images', 'createdAt', 'updatedAt']
    });
  }

  private async getPropertyInvestments(propertyId: string) {
    const [investments, totalValue, count] = await Promise.all([
      this.investmentRepo.find({
        where: { propertyId },
        relations: ['user'],
        order: { createdAt: 'DESC' },
        take: 10,
        select: ['id', 'displayCode', 'tokensPurchased', 'amountUSDT', 'status', 'paymentStatus', 'expectedROI', 'createdAt']
      }),
      this.investmentRepo
        .createQueryBuilder('investment')
        .select('SUM(investment.amountUSDT)', 'total')
        .where('investment.propertyId = :propertyId', { propertyId })
        .getRawOne(),
      this.investmentRepo.count({ where: { propertyId } })
    ]);

    return {
      recent: investments,
      totalValue: totalValue?.total || '0',
      count
    };
  }

  private async getPropertyTransactions(propertyId: string) {
    const [transactions, totalVolume, count] = await Promise.all([
      this.transactionRepo.find({
        where: { propertyId },
        relations: ['user'],
        order: { createdAt: 'DESC' },
        take: 10,
        select: ['id', 'displayCode', 'type', 'amountUSDT', 'status', 'description', 'createdAt']
      }),
      this.transactionRepo
        .createQueryBuilder('transaction')
        .select('SUM(transaction.amountUSDT)', 'total')
        .where('transaction.propertyId = :propertyId', { propertyId })
        .getRawOne(),
      this.transactionRepo.count({ where: { propertyId } })
    ]);

    return {
      recent: transactions,
      totalVolume: totalVolume?.total || '0',
      count
    };
  }

  private async getPropertyInvestors(propertyId: string) {
    const [uniqueInvestors, totalInvestments] = await Promise.all([
      this.investmentRepo
        .createQueryBuilder('investment')
        .select('COUNT(DISTINCT investment.userId)', 'count')
        .where('investment.propertyId = :propertyId', { propertyId })
        .getRawOne(),
      this.investmentRepo.count({ where: { propertyId } })
    ]);

    return {
      uniqueInvestors: parseInt(uniqueInvestors?.count) || 0,
      totalInvestments
    };
  }

  private async getPropertyTokens(propertyId: string) {
    const property = await this.propertyRepo.findOne({ 
      where: { id: propertyId },
      select: ['totalTokens', 'availableTokens', 'pricePerTokenUSDT']
    });

    if (!property) {
      return {
        totalTokens: '0',
        availableTokens: '0',
        soldTokens: '0',
        pricePerToken: '0',
        totalValue: '0',
        soldValue: '0'
      };
    }

    const totalTokens = parseInt(property.totalTokens.toString());
    const availableTokens = parseInt(property.availableTokens.toString());
    const soldTokens = totalTokens - availableTokens;
    const pricePerToken = parseFloat(property.pricePerTokenUSDT.toString());

    return {
      totalTokens: property.totalTokens,
      availableTokens: property.availableTokens,
      soldTokens: soldTokens.toString(),
      pricePerToken: property.pricePerTokenUSDT,
      totalValue: (totalTokens * pricePerToken).toString(),
      soldValue: (soldTokens * pricePerToken).toString()
    };
  }


  
}