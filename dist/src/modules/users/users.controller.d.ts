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
                nameEn: string | null;
                description: string | null;
                price: number;
                durationDays: number;
                isActive: boolean;
            };
        } & {
            id: string;
            userId: string;
            planId: string;
            startDate: Date;
            endDate: Date;
            status: import(".prisma/client").$Enums.SubscriptionStatus;
            autoRenew: boolean;
            createdAt: Date;
            updatedAt: Date;
        }) | null;
    }>;
    registerPushToken(user: User, dto: RegisterPushTokenDto): Promise<{
        success: boolean;
    }>;
    unregisterPushToken(user: User, dto: UnregisterPushTokenDto): Promise<{
        success: boolean;
    }>;
    deleteAccount(user: User): Promise<{
        success: boolean;
    }>;
}
export {};
