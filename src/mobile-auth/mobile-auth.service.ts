import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UsersService } from '../users/users.service';
import { User } from '../admin/entities/user.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { KycVerification } from '../kyc/entities/kyc-verification.entity';
import { Portfolio } from '../portfolio/entities/portfolio.entity';
import Decimal from 'decimal.js';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { NotificationsService } from '../notifications/notifications.service';

export interface AuthResponse {
  user: Omit<User, 'password'>;
  token: string;
  refreshToken: string;
}

@Injectable()
export class MobileAuthService {
  private readonly logger = new Logger(MobileAuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponse> {
    // Find user by email (including password field)
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
      select: ['id', 'email', 'password', 'fullName', 'phone', 'isActive', 'displayCode', 'createdAt', 'updatedAt'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Check if user has password (for traditional auth)
    if (!user.password) {
      throw new UnauthorizedException('Please set a password for your account');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Automatically register push tokens if provided
    if (dto.expoToken) {
      try {
        await this.notificationsService.registerExpoToken(user.id, dto.expoToken);
        this.logger.log(`Expo token registered for user ${user.email}`);
      } catch (error) {
        this.logger.error(`Failed to register Expo token for user ${user.email}:`, error);
        // Don't fail login if token registration fails
      }
    }

    if (dto.webPushSubscription) {
      try {
        await this.notificationsService.registerWebPush(user.id, dto.webPushSubscription);
        this.logger.log(`Web push subscription registered for user ${user.email}`);
      } catch (error) {
        this.logger.error(`Failed to register Web push for user ${user.email}:`, error);
        // Don't fail login if token registration fails
      }
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Check if email already exists
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user in transaction with Wallet, KYC, Portfolio
    return this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(User);
      const wallets = manager.getRepository(Wallet);
      const kycRepo = manager.getRepository(KycVerification);
      const portfolioRepo = manager.getRepository(Portfolio);

      // Generate displayCode using sequence
      const result = await users.query('SELECT nextval(\'user_display_seq\') as nextval');
      const displayCode = `USR-${result[0].nextval.toString().padStart(6, '0')}`;

      // Create user
      const user = users.create({
        displayCode,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone || null,
        password: hashedPassword,
        isActive: true,
      });
      const savedUser = await users.save(user);

      // Create wallet
      const wallet = wallets.create({
        userId: savedUser.id,
        balanceUSDT: new Decimal(0),
        lockedUSDT: new Decimal(0),
        totalDepositedUSDT: new Decimal(0),
        totalWithdrawnUSDT: new Decimal(0),
      });
      await wallets.save(wallet);

      // Create KYC verification record with "pending" status
      const kyc = kycRepo.create({
        userId: savedUser.id,
        type: 'cnic',
        status: 'pending',
        documentFrontUrl: '',
        submittedAt: new Date(),
      });
      await kycRepo.save(kyc);

      // Create portfolio record
      const portfolio = portfolioRepo.create({
        userId: savedUser.id,
        totalInvestedUSDT: new Decimal(0),
        totalRewardsUSDT: new Decimal(0),
        totalROIUSDT: new Decimal(0),
        activeInvestments: 0,
        lastUpdated: new Date(),
      });
      await portfolioRepo.save(portfolio);

      this.logger.log(`User registered successfully: ${savedUser.displayCode}`);

      // Generate tokens
      const tokens = await this.generateTokens(savedUser);

      // Remove password from response
      const { password, ...userWithoutPassword } = savedUser;

      return {
        user: userWithoutPassword,
        ...tokens,
      };
    });
  }

  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'your-secret-key',
      });
      const user = await this.validateUser(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.usersService.findByIdOrDisplayCode(userId);
  }

  private async generateTokens(user: User): Promise<{ token: string; refreshToken: string }> {
    const payload = {
      sub: user.id,
      email: user.email,
    };

    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'your-secret-key';

    const token = this.jwtService.sign(payload, {
      expiresIn: expiresIn as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: refreshExpiresIn as any,
      secret: refreshSecret,
    });

    return { token, refreshToken };
  }
}

