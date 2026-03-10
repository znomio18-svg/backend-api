import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { RedisService } from '../../config/redis.service';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export interface FacebookProfile {
  id: string;
  displayName: string;
  emails?: { value: string }[];
  photos?: { value: string }[];
}

export interface JwtPayload {
  sub: string;
  facebookId?: string;
  phoneNumber?: string;
  role: string;
}

const OTP_PREFIX = 'otp:';
const OTP_TTL = 300; // 5 minutes
const OTP_RATE_PREFIX = 'otp_rate:';
const OTP_RATE_TTL = 60; // 1 minute between OTP sends

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  async sendOtp(phoneNumber: string): Promise<{ success: boolean; message: string }> {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    if (!normalized) {
      throw new BadRequestException('Утасны дугаар буруу байна');
    }

    // Rate limiting
    const rateKey = `${OTP_RATE_PREFIX}${normalized}`;
    const rateLimited = await this.redisService.get(rateKey);
    if (rateLimited) {
      throw new BadRequestException('OTP кодыг 1 минутын дараа дахин илгээнэ үү');
    }

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Store OTP in Redis
    const otpKey = `${OTP_PREFIX}${normalized}`;
    await this.redisService.set(otpKey, otp, OTP_TTL);
    await this.redisService.set(rateKey, '1', OTP_RATE_TTL);

    // Send SMS via Skytel
    await this.sendSms(normalized, `1MinDrama нэвтрэх код: ${otp}`);

    return { success: true, message: 'OTP код илгээгдлээ' };
  }

  async verifyOtp(phoneNumber: string, otp: string): Promise<{ accessToken: string; user: Omit<User, 'password'> }> {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    if (!normalized) {
      throw new BadRequestException('Утасны дугаар буруу байна');
    }

    const otpKey = `${OTP_PREFIX}${normalized}`;
    const storedOtp = await this.redisService.get(otpKey);

    if (!storedOtp || storedOtp !== otp) {
      throw new UnauthorizedException('OTP код буруу эсвэл хугацаа дууссан');
    }

    // Delete OTP after successful verification
    await this.redisService.del(otpKey);

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { phoneNumber: normalized },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phoneNumber: normalized,
          name: normalized,
        },
      });
    }

    return this.login(user);
  }

  private normalizePhoneNumber(phone: string): string | null {
    // Remove spaces, dashes, and leading +976
    let cleaned = phone.replace(/[\s\-()]/g, '');
    if (cleaned.startsWith('+976')) {
      cleaned = cleaned.slice(4);
    } else if (cleaned.startsWith('976') && cleaned.length === 11) {
      cleaned = cleaned.slice(3);
    }
    // Mongolian phone numbers are 8 digits
    if (/^\d{8}$/.test(cleaned)) {
      return cleaned;
    }
    return null;
  }

  private async sendSms(recipient: string, message: string): Promise<void> {
    const token = this.configService.get<string>('SKYTEL_SMS_TOKEN') || '38a16ddc2a6073daebbcf5d33d5d6bdbeb7dacf7';
    const url = `http://web2sms.skytel.mn/apiSend?token=${token}&sendto=${recipient}&message=${encodeURIComponent(message)}`;

    try {
      await fetch(url);
    } catch (error) {
      throw new BadRequestException('SMS илгээхэд алдаа гарлаа');
    }
  }

  async adminLogin(
    username: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const adminUsername = this.configService.get<string>('ADMIN_USERNAME');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');
    const admin2Username = this.configService.get<string>('ADMIN2_USERNAME');
    const admin2Password = this.configService.get<string>('ADMIN2_PASSWORD');

    let envPassword: string | undefined;
    let adminIdentifier: string;

    if (username === adminUsername) {
      envPassword = adminPassword;
      adminIdentifier = 'admin';
    } else if (admin2Username && username === admin2Username) {
      envPassword = admin2Password;
      adminIdentifier = 'admin2';
    } else {
      throw new UnauthorizedException('Invalid credentials');
    }

    const adminEmail = adminIdentifier === 'admin' ? 'admin@1MinDrama.mn' : 'admin2@1MinDrama.mn';
    let adminUser = await this.prisma.user.findFirst({
      where: { facebookId: adminIdentifier, role: UserRole.ADMIN },
    });

    if (!adminUser) {
      adminUser = await this.prisma.user.findFirst({
        where: { email: adminEmail, role: UserRole.ADMIN },
      });
      if (adminUser && adminUser.facebookId !== adminIdentifier) {
        adminUser = await this.prisma.user.update({
          where: { id: adminUser.id },
          data: { facebookId: adminIdentifier },
        });
      }
    }

    if (!adminUser) {
      adminUser = await this.prisma.user.create({
        data: {
          facebookId: adminIdentifier,
          name: adminIdentifier === 'admin' ? 'Admin' : 'Admin 2',
          email: adminEmail,
          role: UserRole.ADMIN,
        },
      });
    }

    let isValidPassword = false;
    if (adminUser.password) {
      isValidPassword = await bcrypt.compare(password, adminUser.password);
    } else {
      isValidPassword = password === envPassword;
    }

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: adminUser.id,
      facebookId: adminUser.facebookId ?? undefined,
      role: adminUser.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  async changeAdminPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const adminUser = await this.prisma.user.findFirst({
      where: { id: userId, role: UserRole.ADMIN },
    });

    if (!adminUser) {
      throw new UnauthorizedException('Admin user not found');
    }

    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');
    let isValidPassword = false;

    if (adminUser.password) {
      isValidPassword = await bcrypt.compare(currentPassword, adminUser.password);
    } else {
      isValidPassword = currentPassword === adminPassword;
    }

    if (!isValidPassword) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { success: true };
  }

  async validateFacebookUser(profile: FacebookProfile): Promise<User> {
    const { id: facebookId, displayName, emails, photos } = profile;
    const email = emails?.[0]?.value;

    let user = await this.prisma.user.findUnique({
      where: { facebookId },
    });

    if (!user && email) {
      user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        user = await this.prisma.user.update({
          where: { email },
          data: {
            facebookId,
            name: displayName,
            avatar: photos?.[0]?.value,
          },
        });
      }
    }

    if (!user) {
      try {
        user = await this.prisma.user.create({
          data: {
            facebookId,
            name: displayName,
            email,
            avatar: photos?.[0]?.value,
          },
        });
      } catch (error) {
        if (error.code === 'P2002') {
          if (email) {
            user = await this.prisma.user.findUnique({ where: { email } });
            if (user) {
              user = await this.prisma.user.update({
                where: { email },
                data: {
                  facebookId,
                  name: displayName,
                  avatar: photos?.[0]?.value,
                },
              });
            }
          }
          if (!user) {
            user = await this.prisma.user.findUnique({ where: { facebookId } });
          }
          if (!user) {
            throw error;
          }
        } else {
          throw error;
        }
      }
    } else if (user.facebookId === facebookId) {
      user = await this.prisma.user.update({
        where: { facebookId },
        data: {
          name: displayName,
          avatar: photos?.[0]?.value,
        },
      });
    }

    return user;
  }

  async login(user: User): Promise<{ accessToken: string; user: Omit<User, 'password'> }> {
    const payload: JwtPayload = {
      sub: user.id,
      facebookId: user.facebookId ?? undefined,
      phoneNumber: user.phoneNumber ?? undefined,
      role: user.role,
    };

    const { password: _, ...userWithoutPassword } = user;

    return {
      accessToken: this.jwtService.sign(payload),
      user: userWithoutPassword,
    };
  }

  async validateUserById(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }
}
