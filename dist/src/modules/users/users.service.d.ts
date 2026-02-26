import { PrismaService } from '../../config/prisma.service';
import { User, Prisma } from '@prisma/client';
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
