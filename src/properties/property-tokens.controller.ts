import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { PropertyTokensService } from './property-tokens.service';
import { CreatePropertyTokenDto } from './dto/create-property-token.dto';
import { UpdatePropertyTokenDto } from './dto/update-property-token.dto';
import { PropertyTokenResponseDto } from './dto/property-token-response.dto';

@Controller('property-tokens')
export class PropertyTokensController {
  constructor(private readonly propertyTokensService: PropertyTokensService) {}

  /**
   * Create a new token tier for a property
   * POST /api/property-tokens
   */
  @Post()
  async create(
    @Body() dto: CreatePropertyTokenDto,
  ): Promise<PropertyTokenResponseDto> {
    return this.propertyTokensService.create(dto);
  }

  /**
   * Get all tokens for a property
   * GET /api/property-tokens/property/:propertyId
   */
  @Get('property/:propertyId')
  async findAllByProperty(
    @Param('propertyId') propertyId: string,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<PropertyTokenResponseDto[]> {
    const includeInactiveBool = includeInactive === 'true';
    return this.propertyTokensService.findAllByProperty(
      propertyId,
      includeInactiveBool,
    );
  }

  /**
   * Get single token by ID or displayCode
   * GET /api/property-tokens/:idOrCode
   */
  @Get(':idOrCode')
  async findOne(
    @Param('idOrCode') idOrCode: string,
  ): Promise<PropertyTokenResponseDto> {
    return this.propertyTokensService.findOne(idOrCode);
  }

  /**
   * Update token
   * PATCH /api/property-tokens/:idOrCode
   */
  @Patch(':idOrCode')
  async update(
    @Param('idOrCode') idOrCode: string,
    @Body() dto: UpdatePropertyTokenDto,
  ): Promise<PropertyTokenResponseDto> {
    return this.propertyTokensService.update(idOrCode, dto);
  }

  /**
   * Delete token
   * DELETE /api/property-tokens/:idOrCode
   */
  @Delete(':idOrCode')
  async delete(@Param('idOrCode') idOrCode: string): Promise<{ message: string }> {
    await this.propertyTokensService.delete(idOrCode);
    return { message: 'Token deleted successfully' };
  }
}
