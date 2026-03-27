import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { DevicePlatform, User, Prisma, SubscriptionStatus } from '@prisma/client';

export interface RegisterPushTokenDto {
  expoPushToken: string;
  devicePlatform: DevicePlatform;
  deviceName?: string;
  appVersion?: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.UserWhereUniqueInput;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<{ users: User[]; total: number }> {
    const { skip, take, cursor, where, orderBy } = params;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        cursor,
        where,
        orderBy,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  async findOne(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          include: { subscriptionPlan: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getUserSubscriptionStatus(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        endDate: { gt: new Date() },
      },
      include: { plan: true },
      orderBy: { endDate: 'desc' },
    });

    return {
      hasActiveSubscription: !!subscription,
      subscription,
    };
  }

  async registerPushToken(userId: string, dto: RegisterPushTokenDto) {
    await this.prisma.pushDevice.upsert({
      where: { expoPushToken: dto.expoPushToken },
      update: {
        userId,
        devicePlatform: dto.devicePlatform,
        deviceName: dto.deviceName,
        appVersion: dto.appVersion,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        expoPushToken: dto.expoPushToken,
        devicePlatform: dto.devicePlatform,
        deviceName: dto.deviceName,
        appVersion: dto.appVersion,
      },
    });

    return { success: true };
  }

  async unregisterPushToken(userId: string, expoPushToken: string) {
    await this.prisma.pushDevice.deleteMany({
      where: {
        userId,
        expoPushToken,
      },
    });

    return { success: true };
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { success: true };
  }
}
