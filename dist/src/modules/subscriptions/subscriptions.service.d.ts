import { PrismaService } from '../../config/prisma.service';
import { Subscription, SubscriptionPlan } from '@prisma/client';
export interface CreateSubscriptionPlanDto {
    name: string;
    nameEn?: string;
    description?: string;
    price: number;
    durationDays: number;
    isActive?: boolean;
}
export interface UpdateSubscriptionPlanDto extends Partial<CreateSubscriptionPlanDto> {
}
export declare class SubscriptionsService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    createPlan(data: CreateSubscriptionPlanDto): Promise<SubscriptionPlan>;
    updatePlan(id: string, data: UpdateSubscriptionPlanDto): Promise<SubscriptionPlan>;
    deletePlan(id: string): Promise<void>;
    getPlans(includeInactive?: boolean): Promise<SubscriptionPlan[]>;
    getPlan(id: string): Promise<SubscriptionPlan>;
    createSubscription(userId: string, planId: string): Promise<Subscription>;
    getActiveSubscription(userId: string): Promise<(Subscription & {
        plan: SubscriptionPlan;
    }) | null>;
    hasActiveSubscription(userId: string): Promise<boolean>;
    getUserSubscriptions(userId: string): Promise<Subscription[]>;
    cancelSubscription(userId: string): Promise<Subscription>;
    extendSubscription(userId: string, additionalDays: number): Promise<Subscription>;
    expireSubscriptions(): Promise<number>;
    getSubscriptionStats(): Promise<{
        totalSubscriptions: number;
        activeSubscriptions: number;
        expiredSubscriptions: number;
        cancelledSubscriptions: number;
        totalRevenue: number;
    }>;
}
