import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@prisma/client';

export interface CreateSubscriptionPlanDto {
  name: string;
  nameEn?: string;
  description?: string;
  price: number;
  durationDays: number;
  isActive?: boolean;
}

export interface UpdateSubscriptionPlanDto
  extends Partial<CreateSubscriptionPlanDto> {}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private prisma: PrismaService) {}

  // ============ Subscription Plans ============

  async createPlan(data: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> {
    return this.prisma.subscriptionPlan.create({
      data,
    });
  }

  async updatePlan(
    id: string,
    data: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    return this.prisma.subscriptionPlan.update({
      where: { id },
      data,
    });
  }

  async deletePlan(id: string): Promise<void> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
      include: { subscriptions: { where: { status: SubscriptionStatus.ACTIVE } } },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    if (plan.subscriptions.length > 0) {
      throw new BadRequestException(
        'Cannot delete plan with active subscriptions',
      );
    }

    await this.prisma.subscriptionPlan.delete({
      where: { id },
    });
  }

  async getPlans(includeInactive = false): Promise<SubscriptionPlan[]> {
    return this.prisma.subscriptionPlan.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { durationDays: 'asc' },
    });
  }

  async getPlan(id: string): Promise<SubscriptionPlan> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    return plan;
  }

  // ============ User Subscriptions ============

  async createSubscription(
    userId: string,
    planId: string,
  ): Promise<Subscription> {
    const plan = await this.getPlan(planId);

    if (!plan.isActive) {
      throw new BadRequestException('Subscription plan is not available');
    }

    // Check for existing active subscription
    const existingSubscription = await this.getActiveSubscription(userId);
    if (existingSubscription) {
      throw new BadRequestException('You already have an active subscription');
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        planId,
        startDate,
        endDate,
        status: SubscriptionStatus.ACTIVE,
      },
      include: { plan: true },
    });

    this.logger.log(
      `Subscription created for user ${userId}, plan ${plan.name}, expires ${endDate}`,
    );

    return subscription;
  }

  async getActiveSubscription(
    userId: string,
  ): Promise<(Subscription & { plan: SubscriptionPlan }) | null> {
    return this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        endDate: { gt: new Date() },
      },
      include: { plan: true },
      orderBy: { endDate: 'desc' },
    });
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.getActiveSubscription(userId);
    return subscription !== null;
  }

  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelSubscription(userId: string): Promise<Subscription> {
    const subscription = await this.getActiveSubscription(userId);

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        autoRenew: false,
      },
    });
  }

  async extendSubscription(
    userId: string,
    additionalDays: number,
  ): Promise<Subscription> {
    const subscription = await this.getActiveSubscription(userId);

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    const newEndDate = new Date(subscription.endDate);
    newEndDate.setDate(newEndDate.getDate() + additionalDays);

    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { endDate: newEndDate },
    });
  }

  // ============ Subscription Expiration ============

  async expireSubscriptions(): Promise<number> {
    const result = await this.prisma.subscription.updateMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: { lt: new Date() },
      },
      data: {
        status: SubscriptionStatus.EXPIRED,
      },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} subscriptions`);
    }

    return result.count;
  }

  // ============ Admin Stats ============

  async getSubscriptionStats() {
    const [
      totalSubscriptions,
      activeSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
      totalRevenue,
    ] = await Promise.all([
      this.prisma.subscription.count(),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.EXPIRED },
      }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.CANCELLED },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 'PAID',
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalSubscriptions,
      activeSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
      totalRevenue: totalRevenue._sum?.amount || 0,
    };
  }
}
