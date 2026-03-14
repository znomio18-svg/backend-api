import { SubscriptionsService } from './subscriptions.service';
export declare class SubscriptionsController {
    private subscriptionsService;
    constructor(subscriptionsService: SubscriptionsService);
    getPlans(): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        nameEn: string | null;
        description: string | null;
        price: number;
        durationDays: number;
        isActive: boolean;
    }[]>;
    getPlan(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        nameEn: string | null;
        description: string | null;
        price: number;
        durationDays: number;
        isActive: boolean;
    }>;
    getMySubscription(userId: string): Promise<{
        subscription: ({
            id: string;
            userId: string;
            planId: string;
            startDate: Date;
            endDate: Date;
            status: import("@prisma/client").$Enums.SubscriptionStatus;
            autoRenew: boolean;
            createdAt: Date;
            updatedAt: Date;
        } & {
            plan: import("@prisma/client").SubscriptionPlan;
        }) | null;
    }>;
    getMySubscriptionHistory(userId: string): Promise<{
        id: string;
        userId: string;
        planId: string;
        startDate: Date;
        endDate: Date;
        status: import("@prisma/client").$Enums.SubscriptionStatus;
        autoRenew: boolean;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getMySubscriptionStatus(userId: string): Promise<{
        hasActiveSubscription: boolean;
        subscription: ({
            id: string;
            userId: string;
            planId: string;
            startDate: Date;
            endDate: Date;
            status: import("@prisma/client").$Enums.SubscriptionStatus;
            autoRenew: boolean;
            createdAt: Date;
            updatedAt: Date;
        } & {
            plan: import("@prisma/client").SubscriptionPlan;
        }) | null;
    }>;
    cancelMySubscription(userId: string): Promise<{
        id: string;
        userId: string;
        planId: string;
        startDate: Date;
        endDate: Date;
        status: import("@prisma/client").$Enums.SubscriptionStatus;
        autoRenew: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
