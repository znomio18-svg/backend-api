import { SubscriptionsService } from './subscriptions.service';
export declare class SubscriptionsController {
    private subscriptionsService;
    constructor(subscriptionsService: SubscriptionsService);
    getPlans(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        nameEn: string | null;
        price: number;
        durationDays: number;
        isActive: boolean;
    }[]>;
    getPlan(id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        nameEn: string | null;
        price: number;
        durationDays: number;
        isActive: boolean;
    }>;
    getMySubscription(userId: string): Promise<{
        subscription: ({
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            planId: string;
            startDate: Date;
            endDate: Date;
            status: import(".prisma/client").$Enums.SubscriptionStatus;
            autoRenew: boolean;
        } & {
            plan: import(".prisma/client").SubscriptionPlan;
        }) | null;
    }>;
    getMySubscriptionHistory(userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        planId: string;
        startDate: Date;
        endDate: Date;
        status: import(".prisma/client").$Enums.SubscriptionStatus;
        autoRenew: boolean;
    }[]>;
    getMySubscriptionStatus(userId: string): Promise<{
        hasActiveSubscription: boolean;
        subscription: ({
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            planId: string;
            startDate: Date;
            endDate: Date;
            status: import(".prisma/client").$Enums.SubscriptionStatus;
            autoRenew: boolean;
        } & {
            plan: import(".prisma/client").SubscriptionPlan;
        }) | null;
    }>;
    cancelMySubscription(userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        planId: string;
        startDate: Date;
        endDate: Date;
        status: import(".prisma/client").$Enums.SubscriptionStatus;
        autoRenew: boolean;
    }>;
}
