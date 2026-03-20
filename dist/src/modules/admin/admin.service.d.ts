import { PrismaService } from '../../config/prisma.service';
export interface DateRangeFilter {
    startDate?: Date;
    endDate?: Date;
}
export interface DashboardStats {
    totalUsers: number;
    totalMovies: number;
    featuredMovies: number;
    totalRevenue: number;
    totalPayments: number;
    recentPayments: number;
    activeSubscriptions: number;
    totalMoviePurchases: number;
    moviePurchaseRevenue: number;
}
export declare class AdminService {
    private prisma;
    constructor(prisma: PrismaService);
    getDashboardStats(filter?: DateRangeFilter): Promise<DashboardStats>;
    getRevenueStats(filter?: DateRangeFilter): Promise<{
        totalRevenue: number;
        paymentCount: number;
        dailyRevenue: {
            date: string;
            amount: number;
        }[];
    }>;
    getReportData(type: 'today' | 'week' | 'month' | 'custom', startDate?: Date, endDate?: Date): Promise<{
        period: "today" | "week" | "month" | "custom";
        startDate: Date | undefined;
        endDate: Date | undefined;
        stats: DashboardStats;
        revenue: {
            totalRevenue: number;
            paymentCount: number;
            dailyRevenue: {
                date: string;
                amount: number;
            }[];
        };
        newUsers: number;
        paymentsByStatus: {
            status: import("@prisma/client").$Enums.PaymentStatus;
            count: number;
            amount: number;
        }[];
    }>;
    private getNewUsersCount;
    private getPaymentsByStatus;
    getMoviePurchases(params: {
        skip?: number;
        take?: number;
        movieId?: string;
    }): Promise<{
        purchases: ({
            payment: {
                id: string;
                amount: number;
                paymentMethod: import("@prisma/client").$Enums.PaymentMethod;
                paidAt: Date | null;
            };
            user: {
                id: string;
                name: string;
                email: string | null;
            };
            movie: {
                id: string;
                title: string;
                price: number | null;
            };
        } & {
            id: string;
            userId: string;
            movieId: string;
            createdAt: Date;
            paymentId: string;
        })[];
        total: number;
    }>;
    private buildDateFilter;
}
