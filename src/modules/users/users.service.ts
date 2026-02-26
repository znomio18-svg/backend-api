import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { User, Prisma, SubscriptionStatus } from '@prisma/client';

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
}
