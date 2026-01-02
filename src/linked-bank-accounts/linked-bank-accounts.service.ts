import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LinkedBankAccount } from './entities/linked-bank-account.entity';
import { CreateLinkedBankAccountDto } from './dto/create-linked-bank-account.dto';
import { UpdateLinkedBankAccountDto } from './dto/update-linked-bank-account.dto';
import { SetDefaultBankAccountDto } from './dto/set-default-bank-account.dto';
import { LinkedBankAccountResponseDto } from './dto/linked-bank-account-response.dto';

@Injectable()
export class LinkedBankAccountsService {
  constructor(
    @InjectRepository(LinkedBankAccount)
    private readonly linkedBankAccountRepo: Repository<LinkedBankAccount>,
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: string, dto: CreateLinkedBankAccountDto): Promise<LinkedBankAccountResponseDto> {
    // If setting as default, unset other defaults for this user
    if (dto.isDefault) {
      await this.unsetOtherDefaults(userId);
    }

    const bankAccount = this.linkedBankAccountRepo.create({
      userId,
      ...dto,
      status: 'pending', // Start as pending, admin can verify later
    });

    const saved = await this.linkedBankAccountRepo.save(bankAccount);
    return LinkedBankAccountResponseDto.fromEntity(saved);
  }

  async findAllByUserId(userId: string): Promise<LinkedBankAccountResponseDto[]> {
    const accounts = await this.linkedBankAccountRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });

    return LinkedBankAccountResponseDto.fromEntities(accounts);
  }

  async findOne(id: string, userId?: string): Promise<LinkedBankAccountResponseDto> {
    const where: any = { id };
    if (userId) {
      where.userId = userId;
    }

    const account = await this.linkedBankAccountRepo.findOne({ where });
    if (!account) {
      throw new NotFoundException(`Linked bank account with id '${id}' not found`);
    }

    return LinkedBankAccountResponseDto.fromEntity(account);
  }

  async findDefaultByUserId(userId: string): Promise<LinkedBankAccountResponseDto | null> {
    const account = await this.linkedBankAccountRepo.findOne({
      where: { userId, isDefault: true, status: 'verified' },
    });

    return account ? LinkedBankAccountResponseDto.fromEntity(account) : null;
  }

  async update(id: string, userId: string, dto: UpdateLinkedBankAccountDto): Promise<LinkedBankAccountResponseDto> {
    const account = await this.linkedBankAccountRepo.findOne({ where: { id, userId } });
    if (!account) {
      throw new NotFoundException(`Linked bank account with id '${id}' not found`);
    }

    // If setting as default, unset other defaults
    if (dto.isDefault === true) {
      await this.unsetOtherDefaults(userId, id);
    }

    Object.assign(account, dto);
    const updated = await this.linkedBankAccountRepo.save(account);
    return LinkedBankAccountResponseDto.fromEntity(updated);
  }

  async setDefault(id: string, userId: string, dto: SetDefaultBankAccountDto): Promise<LinkedBankAccountResponseDto> {
    const account = await this.linkedBankAccountRepo.findOne({ where: { id, userId } });
    if (!account) {
      throw new NotFoundException(`Linked bank account with id '${id}' not found`);
    }

    if (account.status !== 'verified') {
      throw new BadRequestException('Only verified bank accounts can be set as default');
    }

    if (dto.isDefault) {
      await this.unsetOtherDefaults(userId, id);
      account.isDefault = true;
    } else {
      account.isDefault = false;
    }

    const updated = await this.linkedBankAccountRepo.save(account);
    return LinkedBankAccountResponseDto.fromEntity(updated);
  }

  async remove(id: string, userId: string): Promise<void> {
    const account = await this.linkedBankAccountRepo.findOne({ where: { id, userId } });
    if (!account) {
      throw new NotFoundException(`Linked bank account with id '${id}' not found`);
    }

    // Soft delete: set status to disabled
    account.status = 'disabled';
    await this.linkedBankAccountRepo.save(account);
  }

  async verify(id: string, status: 'verified' | 'disabled'): Promise<LinkedBankAccountResponseDto> {
    const account = await this.linkedBankAccountRepo.findOne({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Linked bank account with id '${id}' not found`);
    }

    account.status = status;
    const updated = await this.linkedBankAccountRepo.save(account);
    return LinkedBankAccountResponseDto.fromEntity(updated);
  }

  private async unsetOtherDefaults(userId: string, excludeId?: string): Promise<void> {
    const query = this.linkedBankAccountRepo
      .createQueryBuilder()
      .update(LinkedBankAccount)
      .set({ isDefault: false })
      .where('userId = :userId', { userId })
      .andWhere('isDefault = :isDefault', { isDefault: true });

    if (excludeId) {
      query.andWhere('id != :excludeId', { excludeId });
    }

    await query.execute();
  }
}
