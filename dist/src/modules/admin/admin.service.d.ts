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
        period: "month" | "today" | "week" | "custom";
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
            status: import(".prisma/client").$Enums.PaymentStatus;
            count: number;
            amount: number;
        }[];
    }>;
    private getNewUsersCount;
    private getPaymentsByStatus;
    private buildDateFilter;
}
