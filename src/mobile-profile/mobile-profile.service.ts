import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from '../admin/entities/user.entity';

// Default security settings (until UserSecuritySettingsService is implemented)
const DEFAULT_SECURITY_SETTINGS = {
  twoFactorAuth: false,
  biometricLogin: false,
  passwordLastChanged: null,
};

// Default notification settings (until UserNotificationSettingsService is implemented)
const DEFAULT_NOTIFICATION_SETTINGS = {
  pushNotifications: true,
  emailNotifications: true,
  smsNotifications: false,
  investmentUpdates: true,
  propertyAlerts: true,
  monthlyReports: true,
  marketingOffers: false,
  securityAlerts: true,
  paymentReminders: true,
  portfolioMilestones: true,
  doNotDisturb: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
  },
};

@Injectable()
export class MobileProfileService {
  constructor(private readonly usersService: UsersService) {}

  async getProfile(userId: string): Promise<any> {
    const user = await this.usersService.findByIdOrDisplayCode(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Transform user info for mobile app
    const userInfo = this.transformUserInfo(user);

    return {
      userInfo,
      securitySettings: DEFAULT_SECURITY_SETTINGS,
      notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<any> {
    const updateData: any = {};
    
    if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.dob !== undefined) updateData.dob = dto.dob; // Will be converted to Date in UsersService
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.profileImage !== undefined) updateData.profileImage = dto.profileImage;

    const updatedUser = await this.usersService.update(userId, updateData);
    
    // Return full profile response
    return {
      userInfo: this.transformUserInfo(updatedUser),
      securitySettings: DEFAULT_SECURITY_SETTINGS,
      notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
    };
  }

  private transformUserInfo(user: User): any {
    // Defensive handling: dob may be string, Date, or null
    let dob: string | null = null;
    if (user.dob) {
      try {
        const date = user.dob instanceof Date ? user.dob : new Date(user.dob as any);
        if (!isNaN(date.getTime())) {
          dob = date.toISOString().split('T')[0];
        }
      } catch {
        dob = null;
      }
    }

    return {
      id: user.id,
      displayCode: user.displayCode,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone || null,
      dob,
      address: user.address || null,
      profileImage: user.profileImage || null,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

