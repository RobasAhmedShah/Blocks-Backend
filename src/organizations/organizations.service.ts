import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import { Organization } from './entities/organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationAdmin } from '../organization-admins/entities/organization-admin.entity';
import { UploadService } from '../upload/upload.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(OrganizationAdmin)
    private readonly orgAdminRepo: Repository<OrganizationAdmin>,
    private readonly uploadService: UploadService,
  ) {}

  async create(dto: CreateOrganizationDto) {
    // Generate displayCode using sequence
    const result = await this.orgRepo.query('SELECT nextval(\'organization_display_seq\') as nextval');
    const displayCode = `ORG-${result[0].nextval.toString().padStart(6, '0')}`;
    
    const org = this.orgRepo.create({
      ...dto,
      displayCode,
      liquidityUSDT: new Decimal(0), // Explicitly set default value
    });
    return this.orgRepo.save(org);
  }

  async createWithAdmin(body: any) {
    return this.dataSource.transaction(async (manager) => {
      const orgRepo = manager.getRepository(Organization);
      const adminRepo = manager.getRepository(OrganizationAdmin);

      const result = await orgRepo.query("SELECT nextval('organization_display_seq') as nextval");
      const displayCode = `ORG-${result[0].nextval.toString().padStart(6, '0')}`;

      const org = orgRepo.create({
        name: body.name,
        displayCode,
        description: body.description ?? null,
        website: body.website ?? null,
        logoUrl: body.logoUrl ?? null,
        liquidityUSDT: new (require('decimal.js'))(0),
      });
      const savedOrg = await orgRepo.save(org);

      const emailSlug = (body.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const adminEmail = body.adminEmail || `admin@${emailSlug}.com`;
      const adminPassword = body.adminPassword || 'admin123';
      const hashed = await bcrypt.hash(adminPassword, 12);

      const admin = adminRepo.create({
        organizationId: savedOrg.id,
        email: adminEmail,
        password: hashed,
        fullName: body.adminFullName || `${body.name} Administrator`,
        role: 'org_admin',
        isActive: true,
      });
      const savedAdmin = await adminRepo.save(admin);

      return {
        organization: savedOrg,
        admin: { email: savedAdmin.email, tempPassword: adminPassword, fullName: savedAdmin.fullName },
        message: `Organization created successfully. Admin credentials: ${adminEmail} / ${adminPassword}`,
      };
    });
  }

  async listWithAdmin() {
    const orgs = await this.orgRepo.find();
    // Explicitly select fields to avoid issues if webPushSubscription column doesn't exist yet
    const admins = await this.orgAdminRepo.find({
      select: ['id', 'organizationId', 'email', 'fullName', 'role', 'isActive', 'lastLogin', 'createdAt', 'updatedAt'],
    });
    const orgIdToAdmin: Record<string, OrganizationAdmin> = {};
    admins.forEach(a => { orgIdToAdmin[a.organizationId] = a; });
    return orgs.map(o => ({
      ...o,
      admin: orgIdToAdmin[o.id] ? {
        email: orgIdToAdmin[o.id].email,
        fullName: orgIdToAdmin[o.id].fullName,
        lastLogin: orgIdToAdmin[o.id].lastLogin,
      } : null,
    }));
  }

  async updateAdminManaged(idOrCode: string, body: any) {
    const org = await this.findByIdOrDisplayCode(idOrCode);
    if (!org) throw new Error('Organization not found');
    const update: Partial<Organization> = {};
    ['name','description','website','logoUrl'].forEach((k) => {
      if (body[k] !== undefined) (update as any)[k] = body[k];
    });
    await this.orgRepo.update(org.id, update);
    return this.findByIdOrDisplayCode(org.id);
  }

  async deleteAdminManaged(idOrCode: string) {
    const org = await this.findByIdOrDisplayCode(idOrCode);
    if (!org) throw new Error('Organization not found');
    await this.orgRepo.remove(org);
    return { success: true };
  }

  async resetOrgAdminPassword(idOrCode: string, newPassword?: string) {
    const org = await this.findByIdOrDisplayCode(idOrCode);
    if (!org) throw new Error('Organization not found');
    // Explicitly select fields to avoid issues if webPushSubscription column doesn't exist yet
    const admin = await this.orgAdminRepo.findOne({ 
      where: { organizationId: org.id },
      select: ['id', 'organizationId', 'email', 'password', 'fullName', 'role', 'isActive', 'lastLogin', 'passwordChangedAt', 'createdAt', 'updatedAt'],
    });
    if (!admin) throw new Error('Organization admin not found');
    const temp = newPassword || Math.random().toString(36).slice(-8) + '!A1';
    admin.password = await bcrypt.hash(temp, 12);
    admin.passwordChangedAt = new Date();
    await this.orgAdminRepo.save(admin);
    return { email: admin.email, tempPassword: temp };
  }

  async findAll() {
    return this.orgRepo.find();
  }

  async findOne(id: string) {
    return this.orgRepo.findOne({ where: { id } });
  }

  async findByDisplayCode(displayCode: string) {
    return this.orgRepo.findOne({ where: { displayCode } });
  }

  async findByIdOrDisplayCode(idOrCode: string) {
    // Check if it's a UUID format (contains hyphens and is 36 chars)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode);
    
    if (isUuid) {
      return this.orgRepo.findOne({ where: { id: idOrCode } });
    } else {
      return this.orgRepo.findOne({ where: { displayCode: idOrCode } });
    }
  }

  async findTransactions(idOrCode: string) {
    // Check if it's a UUID format
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode);
    
    const org = await this.orgRepo.findOne({
      where: isUuid ? { id: idOrCode } : { displayCode: idOrCode },
      relations: ['transactions'],
    });
    
    return org?.transactions || [];
  }

  /**
   * Upload logo for an organization
   * File is saved to: docs/organizations/{filename}
   * URL is stored in database: organization.logoUrl
   */
  async uploadLogo(id: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const org = await this.findByIdOrDisplayCode(id);
    if (!org) {
      throw new NotFoundException(`Organization with id or displayCode '${id}' not found`);
    }

    // Upload file to docs/organizations folder
    // Returns: { url: '/docs/organizations/filename.jpg', filename, path, fullUrl }
    const uploadedFile = await this.uploadService.saveFile(file, 'organizations', 'image');

    // Save URL to database in organization.logoUrl field
    // URL format: /docs/organizations/{timestamp}-{random}.{ext}
    await this.orgRepo.update(org.id, { 
      logoUrl: uploadedFile.url // This is saved to DB: /docs/organizations/1234567890-org123.jpg
    });

    // Return updated organization with logo URL
    const updatedOrg = await this.findByIdOrDisplayCode(id);

    return {
      success: true,
      message: 'Logo uploaded successfully',
      uploadedFile: {
        url: uploadedFile.url,
        filename: uploadedFile.filename,
      },
      organization: updatedOrg, // Full organization with logoUrl
    };
  }
}

