import { DevicePlatform, User } from '@prisma/client';
import { UsersService } from './users.service';
declare class RegisterPushTokenDto {
    expoPushToken: string;
    devicePlatform: DevicePlatform;
    deviceName?: string;
    appVersion?: string;
}
declare class UnregisterPushTokenDto {
    expoPushToken: string;
}
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    getMySubscription(user: User): Promise<{
        hasActiveSubscription: boolean;
        subscription: ({
            plan: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                description: string | null;
                price: number;
                nameEn: string | null;
                durationDays: number;
                isActive: boolean;
            };
        } & {
            id: string;
            userId: string;
            status: import("@prisma/client").$Enums.SubscriptionStatus;
            createdAt: Date;
            updatedAt: Date;
            startDate: Date;
            endDate: Date;
            planId: string;
            autoRenew: boolean;
        }) | null;
    }>;
    registerPushToken(user: User, dto: RegisterPushTokenDto): Promise<{
        success: boolean;
    }>;
    unregisterPushToken(user: User, dto: UnregisterPushTokenDto): Promise<{
        success: boolean;
    }>;
}
export {};
