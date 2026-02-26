import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
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
  facebookId: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

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

    const adminEmail = adminIdentifier === 'admin' ? 'admin@ZNom.mn' : 'admin2@ZNom.mn';
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
      facebookId: adminUser.facebookId,
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
      facebookId: user.facebookId,
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
