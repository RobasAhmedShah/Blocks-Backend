import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../admin/entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findByIdOrDisplayCode(id: string): Promise<User | null> {
    // Check if id is UUID or displayCode
    const isIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    // Select all user fields including profile fields
    const selectFields: (keyof User)[] = [
      'id',
      'displayCode',
      'fullName',
      'email',
      'phone',
      'isActive',
      'dob',
      'address',
      'profileImage',
      'createdAt',
      'updatedAt',
    ];
    
    if (isIdUuid) {
      // Direct UUID lookup
      return this.userRepo.findOne({ 
        where: { id },
        select: selectFields as any,
      });
    } else {
      // DisplayCode lookup
      return this.userRepo.findOne({ 
        where: { displayCode: id },
        select: selectFields as any,
      });
    }
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findByIdOrDisplayCode(id);
    if (!user) {
      throw new NotFoundException(`User with id or displayCode '${id}' not found`);
    }

    const updateData: Partial<User> = {};

    // Update only provided fields
    if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if ((dto as any).dob !== undefined) updateData.dob = (dto as any).dob ? new Date((dto as any).dob) : null;
    if ((dto as any).address !== undefined) updateData.address = (dto as any).address;
    if ((dto as any).profileImage !== undefined) updateData.profileImage = (dto as any).profileImage;

    await this.userRepo.update(user.id, updateData);
    const updatedUser = await this.findByIdOrDisplayCode(id);
    if (!updatedUser) {
      throw new NotFoundException(`User with id or displayCode '${id}' not found after update`);
    }
    return updatedUser;
  }
}
