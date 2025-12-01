import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { OrganizationAdmin } from './entities/organization-admin.entity';
import { Organization } from '../organizations/entities/organization.entity';

@Injectable()
export class OrganizationAdminsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OrganizationAdmin)
    private readonly orgAdminRepo: Repository<OrganizationAdmin>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  async createAdmin(organizationId: string, email: string, plainPassword: string, fullName?: string) {
    const org = await this.orgRepo.findOne({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    const existing = await this.orgAdminRepo.findOne({ 
      where: { organizationId },
      select: ['id', 'organizationId'],
    });
    if (existing) throw new BadRequestException('Organization already has an admin');

    const emailUsed = await this.orgAdminRepo.findOne({ 
      where: { email },
      select: ['id', 'email'],
    });
    if (emailUsed) throw new BadRequestException('Email already in use');

    const hash = await bcrypt.hash(plainPassword, 12);
    const admin = this.orgAdminRepo.create({
      organizationId,
      email,
      password: hash,
      fullName: fullName ?? null,
      role: 'org_admin',
      isActive: true,
    });
    const saved = await this.orgAdminRepo.save(admin);
    return { admin: saved, tempPassword: plainPassword };
  }

  async resetPasswordByOrgId(organizationId: string, newPlainPassword?: string) {
    const admin = await this.orgAdminRepo.findOne({ 
      where: { organizationId },
      select: ['id', 'organizationId', 'email', 'password', 'passwordChangedAt'],
    });
    if (!admin) throw new NotFoundException('Organization admin not found');
    const temp = newPlainPassword ?? this.generateTempPassword();
    const hash = await bcrypt.hash(temp, 12);
    admin.password = hash;
    admin.passwordChangedAt = new Date();
    await this.orgAdminRepo.save(admin);
    return { email: admin.email, tempPassword: temp };
  }

  async login(email: string, password: string) {
    const admin = await this.orgAdminRepo.findOne({ 
      where: { email, isActive: true },
      select: ['id', 'email', 'password', 'fullName', 'organizationId', 'role', 'isActive', 'lastLogin', 'createdAt', 'updatedAt'], // Explicitly select fields (exclude webPushSubscription for login)
    });
    if (!admin) throw new NotFoundException('Invalid credentials');
    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) throw new NotFoundException('Invalid credentials');
    admin.lastLogin = new Date();
    await this.orgAdminRepo.save(admin);
    // No JWT per request, return admin and org id
    return { organizationId: admin.organizationId, admin: { id: admin.id, email: admin.email, fullName: admin.fullName } };
  }

  async changePassword(adminId: string, currentPassword: string, newPassword: string) {
    const admin = await this.orgAdminRepo.findOne({ 
      where: { id: adminId },
      select: ['id', 'password', 'passwordChangedAt'],
    });
    if (!admin) throw new NotFoundException('Admin not found');
    const ok = await bcrypt.compare(currentPassword, admin.password);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    admin.password = await bcrypt.hash(newPassword, 12);
    admin.passwordChangedAt = new Date();
    await this.orgAdminRepo.save(admin);
    return { success: true };
  }

  generateEmailFromName(name: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `admin@${slug}.com`;
  }

  generateTempPassword() {
    return Math.random().toString(36).slice(-8) + '!A1';
  }
}


