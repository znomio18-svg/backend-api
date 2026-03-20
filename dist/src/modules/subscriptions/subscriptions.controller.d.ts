import { SubscriptionsService } from './subscriptions.service';
export declare class SubscriptionsController {
    private subscriptionsService;
    constructor(subscriptionsService: SubscriptionsService);
    getPlans(): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        price: number;
        nameEn: string | null;
        durationDays: number;
        isActive: boolean;
    }[]>;
    getPlan(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        price: number;
        nameEn: string | null;
        durationDays: number;
        isActive: boolean;
    }>;
    getMySubscription(userId: string): Promise<{
        subscription: ({
            id: string;
            userId: string;
            status: import("@prisma/client").$Enums.SubscriptionStatus;
            createdAt: Date;
            updatedAt: Date;
            startDate: Date;
            endDate: Date;
            planId: string;
            autoRenew: boolean;
        } & {
            plan: import("@prisma/client").SubscriptionPlan;
        }) | null;
    }>;
    getMySubscriptionHistory(userId: string): Promise<{
        id: string;
        userId: string;
        status: import("@prisma/client").$Enums.SubscriptionStatus;
        createdAt: Date;
        updatedAt: Date;
        startDate: Date;
        endDate: Date;
        planId: string;
        autoRenew: boolean;
    }[]>;
    getMySubscriptionStatus(userId: string): Promise<{
        hasActiveSubscription: boolean;
        subscription: ({
            id: string;
            userId: string;
            status: import("@prisma/client").$Enums.SubscriptionStatus;
            createdAt: Date;
            updatedAt: Date;
            startDate: Date;
            endDate: Date;
            planId: string;
            autoRenew: boolean;
        } & {
            plan: import("@prisma/client").SubscriptionPlan;
        }) | null;
    }>;
    cancelMySubscription(userId: string): Promise<{
        id: string;
        userId: string;
        status: import("@prisma/client").$Enums.SubscriptionStatus;
        createdAt: Date;
        updatedAt: Date;
        startDate: Date;
        endDate: Date;
        planId: string;
        autoRenew: boolean;
    }>;
}
