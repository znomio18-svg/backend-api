import { UsersService } from './users.service';
import { User } from '@prisma/client';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    getMySubscription(user: User): Promise<{
        hasActiveSubscription: boolean;
        subscription: ({
            plan: {
                id: string;
                name: string;
                createdAt: Date;
                updatedAt: Date;
                description: string | null;
                nameEn: string | null;
                price: number;
                durationDays: number;
                isActive: boolean;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            planId: string;
            startDate: Date;
            endDate: Date;
            status: import(".prisma/client").$Enums.SubscriptionStatus;
            autoRenew: boolean;
        }) | null;
    }>;
}
