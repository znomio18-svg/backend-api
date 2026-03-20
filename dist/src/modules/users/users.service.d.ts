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
    registerPushToken(userId: string, dto: RegisterPushTokenDto): Promise<{
        success: boolean;
    }>;
    unregisterPushToken(userId: string, expoPushToken: string): Promise<{
        success: boolean;
    }>;
}
