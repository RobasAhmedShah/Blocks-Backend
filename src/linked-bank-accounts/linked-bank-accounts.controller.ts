import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LinkedBankAccountsService } from './linked-bank-accounts.service';
import { CreateLinkedBankAccountDto } from './dto/create-linked-bank-account.dto';
import { UpdateLinkedBankAccountDto } from './dto/update-linked-bank-account.dto';
import { SetDefaultBankAccountDto } from './dto/set-default-bank-account.dto';
import { JwtAuthGuard } from '../mobile-auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../admin/entities/user.entity';

@Controller('api/mobile/linked-bank-accounts')
@UseGuards(JwtAuthGuard)
export class LinkedBankAccountsController {
  constructor(private readonly linkedBankAccountsService: LinkedBankAccountsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: User, @Body() createLinkedBankAccountDto: CreateLinkedBankAccountDto) {
    return this.linkedBankAccountsService.create(user.id, createLinkedBankAccountDto);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.linkedBankAccountsService.findAllByUserId(user.id);
  }

  @Get('default')
  findDefault(@CurrentUser() user: User) {
    return this.linkedBankAccountsService.findDefaultByUserId(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.linkedBankAccountsService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateLinkedBankAccountDto: UpdateLinkedBankAccountDto,
  ) {
    return this.linkedBankAccountsService.update(id, user.id, updateLinkedBankAccountDto);
  }

  @Patch(':id/default')
  setDefault(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() setDefaultBankAccountDto: SetDefaultBankAccountDto,
  ) {
    return this.linkedBankAccountsService.setDefault(id, user.id, setDefaultBankAccountDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.linkedBankAccountsService.remove(id, user.id);
  }
}
