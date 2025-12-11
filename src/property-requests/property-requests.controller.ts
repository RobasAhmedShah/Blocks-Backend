import { Body, Controller, Get, Param, Post, Patch, Headers, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PropertyRequestsService } from './property-requests.service';
import { CreatePropertyRequestDto } from './dto/create-property-request.dto';
import { UpdatePropertyRequestStatusDto } from './dto/update-property-request-status.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('property-requests')
export class PropertyRequestsController {
  constructor(private readonly propertyRequestsService: PropertyRequestsService) {}

  // ORG Admin: Create property request
  // Frontend will send orgAdminId in body or header
  @Post()
  @Public() // Allow without JWT, but validate orgAdminId from body/header
  async create(
    @Body() dto: CreatePropertyRequestDto & { orgAdminId?: string },
    @Headers('x-org-admin-id') orgAdminIdHeader?: string,
  ) {
    const orgAdminId = dto.orgAdminId || orgAdminIdHeader;
    if (!orgAdminId) {
      throw new UnauthorizedException('Organization admin ID is required');
    }
    // Remove orgAdminId from dto before passing to service
    const { orgAdminId: _, ...propertyDto } = dto;
    return this.propertyRequestsService.create(propertyDto, orgAdminId);
  }

  // ORG Admin: Get their property requests
  // Blocks Admin: Get all property requests
  @Get()
  @Public() // Allow without JWT
  async findAll(
    @Headers('x-org-admin-id') orgAdminId?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    // If org admin ID provided, filter by their organization
    // If JWT token provided (Blocks Admin), return all
    return this.propertyRequestsService.findAll(orgAdminId);
  }

  // Get single property request
  @Get(':id')
  @Public() // Allow without JWT
  async findOne(
    @Param('id') id: string,
    @Headers('x-org-admin-id') orgAdminId?: string,
  ) {
    return this.propertyRequestsService.findOne(id, orgAdminId);
  }

  // Blocks Admin: Approve/Reject property request
  @Patch(':id/status')
  @Public() // Allow without JWT - admin authentication handled by frontend session
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdatePropertyRequestStatusDto & { adminId?: string },
    @Headers('x-admin-id') adminIdHeader?: string,
  ) {
    // Get admin ID from header or body
    const adminId = adminIdHeader || body.adminId;
    
    if (!adminId) {
      throw new UnauthorizedException('Admin ID is required');
    }
    
    // Extract status DTO without adminId
    const dto: UpdatePropertyRequestStatusDto = {
      status: body.status,
      rejectionReason: body.rejectionReason,
    };
    
    return this.propertyRequestsService.updateStatus(id, dto, adminId);
  }
}

