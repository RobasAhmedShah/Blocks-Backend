import { Injectable, ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { BlocksAdmin } from './entities/blocks-admin.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class BlocksAdminService {
  constructor(
    @InjectRepository(BlocksAdmin)
    private readonly blocksAdminRepo: Repository<BlocksAdmin>,
  ) {}

  async signup(dto: SignupDto): Promise<Omit<BlocksAdmin, 'password'>> {
    // Check if admin already exists
    const existingAdmin = await this.blocksAdminRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingAdmin) {
      throw new ConflictException('Admin with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create new admin
    const admin = this.blocksAdminRepo.create({
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      fullName: dto.fullName,
      isActive: true,
    });

    const savedAdmin = await this.blocksAdminRepo.save(admin);

    // Remove password from response
    const { password, ...adminWithoutPassword } = savedAdmin;
    return adminWithoutPassword;
  }

  async login(dto: LoginDto): Promise<{ admin: Omit<BlocksAdmin, 'password'>; message: string }> {
    // Find admin by email (with password field)
    const admin = await this.blocksAdminRepo
      .createQueryBuilder('admin')
      .where('admin.email = :email', { email: dto.email.toLowerCase() })
      .addSelect('admin.password')
      .getOne();

    if (!admin) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!admin.isActive) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    // Check if password exists
    if (!admin.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Remove password from response
    const { password, ...adminWithoutPassword } = admin;

    return {
      admin: adminWithoutPassword,
      message: 'Login successful',
    };
  }

  async getAdminById(id: string): Promise<Omit<BlocksAdmin, 'password'>> {
    const admin = await this.blocksAdminRepo.findOne({
      where: { id },
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    if (!admin.isActive) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    return admin;
  }

  async getAllAdmins(): Promise<Omit<BlocksAdmin, 'password'>[]> {
    return this.blocksAdminRepo.find({
      order: { createdAt: 'DESC' },
    });
  }
}
