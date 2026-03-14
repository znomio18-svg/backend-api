import { PrismaService } from '../../config/prisma.service';
import { DevicePlatform, User, Prisma } from '@prisma/client';
export interface RegisterPushTokenDto {
    expoPushToken: string;
    devicePlatform: DevicePlatform;
    deviceName?: string;
    appVersion?: string;
}
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(params: {
        skip?: number;
        take?: number;
        cursor?: Prisma.UserWhereUniqueInput;
        where?: Prisma.UserWhereInput;
        orderBy?: Prisma.UserOrderByWithRelationInput;
    }): Promise<{
        users: User[];
        total: number;
    }>;
    findOne(id: string): Promise<User | null>;
    getUserSubscriptionStatus(userId: string): Promise<{
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
            status: import("@prisma/client").$Enums.SubscriptionStatus;
            autoRenew: boolean;
            createdAt: Date;
            updatedAt: Date;
        }) | null;
    }>;
    registerPushToken(userId: string, dto: RegisterPushTokenDto): Promise<{
        success: boolean;
    }>;
    unregisterPushToken(userId: string, expoPushToken: string): Promise<{
        success: boolean;
    }>;
}
