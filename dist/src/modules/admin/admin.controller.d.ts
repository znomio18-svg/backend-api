import { AdminService } from './admin.service';
import { MoviesService, CreateMovieDto, UpdateMovieDto } from '../movies/movies.service';
import { PaymentsService } from '../payments/payments.service';
import { UsersService } from '../users/users.service';
import { BankAccountsService, CreateBankAccountDto, UpdateBankAccountDto } from './bank-accounts.service';
import { AdminSettingsService } from './admin-settings.service';
import { SubscriptionsService, CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto } from '../subscriptions/subscriptions.service';
import { AuthService } from '../auth/auth.service';
import { PaymentStatus } from '@prisma/client';
declare class ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}
export declare class AdminController {
    private adminService;
    private moviesService;
    private paymentsService;
    private usersService;
    private bankAccountsService;
    private adminSettingsService;
    private subscriptionsService;
    private authService;
    constructor(adminService: AdminService, moviesService: MoviesService, paymentsService: PaymentsService, usersService: UsersService, bankAccountsService: BankAccountsService, adminSettingsService: AdminSettingsService, subscriptionsService: SubscriptionsService, authService: AuthService);
    getDashboard(): Promise<import("./admin.service").DashboardStats>;
    getReports(type: 'today' | 'week' | 'month' | 'custom', startDate?: string, endDate?: string): Promise<{
        period: "today" | "week" | "month" | "custom";
        startDate: Date | undefined;
        endDate: Date | undefined;
        stats: import("./admin.service").DashboardStats;
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
    getRevenue(startDate?: string, endDate?: string): Promise<{
        totalRevenue: number;
        paymentCount: number;
        dailyRevenue: {
            date: string;
            amount: number;
        }[];
    }>;
    getMovies(page?: number, limit?: number, search?: string): Promise<{
        movies: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string;
            description: string;
            thumbnailUrl: string;
            trailerVideoId: string | null;
            videoId: string;
            duration: number;
            releaseYear: number;
            rating: number;
            viewCount: number;
            isFeatured: boolean;
            isPublished: boolean;
            price: number | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getMovieStats(): Promise<{
        totalMovies: number;
        publishedMovies: number;
        featuredMovies: number;
        draftMovies: number;
        totalViews: number;
    }>;
    getMovie(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        thumbnailUrl: string;
        trailerVideoId: string | null;
        videoId: string;
        duration: number;
        releaseYear: number;
        rating: number;
        viewCount: number;
        isFeatured: boolean;
        isPublished: boolean;
        price: number | null;
    }>;
    createMovie(dto: CreateMovieDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        thumbnailUrl: string;
        trailerVideoId: string | null;
        videoId: string;
        duration: number;
        releaseYear: number;
        rating: number;
        viewCount: number;
        isFeatured: boolean;
        isPublished: boolean;
        price: number | null;
    }>;
    updateMovie(id: string, dto: UpdateMovieDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        thumbnailUrl: string;
        trailerVideoId: string | null;
        videoId: string;
        duration: number;
        releaseYear: number;
        rating: number;
        viewCount: number;
        isFeatured: boolean;
        isPublished: boolean;
        price: number | null;
    }>;
    toggleFeatured(id: string, isFeatured: boolean): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        thumbnailUrl: string;
        trailerVideoId: string | null;
        videoId: string;
        duration: number;
        releaseYear: number;
        rating: number;
        viewCount: number;
        isFeatured: boolean;
        isPublished: boolean;
        price: number | null;
    }>;
    deleteMovie(id: string): Promise<{
        success: boolean;
    }>;
    getUsers(page?: number, limit?: number, search?: string): Promise<{
        users: import(".prisma/client").User[];
        total: number;
    }>;
    getUser(id: string): Promise<{
        id: string;
        facebookId: string;
        email: string | null;
        name: string;
        avatar: string | null;
        password: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    getPayments(page?: number, limit?: number, status?: PaymentStatus, startDate?: string, endDate?: string, search?: string): Promise<{
        payments: ({
            user: {
                id: string;
                email: string | null;
                name: string;
            };
            movie: {
                id: string;
                title: string;
            } | null;
            subscriptionPlan: {
                id: string;
                name: string;
            } | null;
            bankAccount: {
                id: string;
                bankName: string;
                accountNumber: string;
            } | null;
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            subscriptionPlanId: string | null;
            movieId: string | null;
            amount: number;
            status: import(".prisma/client").$Enums.PaymentStatus;
            paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
            qpayInvoiceId: string | null;
            qpayQrCode: string | null;
            qpayQrImage: string | null;
            qpayDeeplinks: import("@prisma/client/runtime/library").JsonValue | null;
            qpayPaymentId: string | null;
            qpayRawPayload: import("@prisma/client/runtime/library").JsonValue | null;
            bankAccountId: string | null;
            transferRef: string | null;
            userNotifiedAt: Date | null;
            invoiceCode: string;
            paidAt: Date | null;
            reconcileAttempts: number;
            lastReconcileAt: Date | null;
            nextReconcileAt: Date | null;
            reconcileSource: import(".prisma/client").$Enums.ReconcileSource | null;
        })[];
        total: number;
    }>;
    confirmPayment(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        subscriptionPlanId: string | null;
        movieId: string | null;
        amount: number;
        status: import(".prisma/client").$Enums.PaymentStatus;
        paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
        qpayInvoiceId: string | null;
        qpayQrCode: string | null;
        qpayQrImage: string | null;
        qpayDeeplinks: import("@prisma/client/runtime/library").JsonValue | null;
        qpayPaymentId: string | null;
        qpayRawPayload: import("@prisma/client/runtime/library").JsonValue | null;
        bankAccountId: string | null;
        transferRef: string | null;
        userNotifiedAt: Date | null;
        invoiceCode: string;
        paidAt: Date | null;
        reconcileAttempts: number;
        lastReconcileAt: Date | null;
        nextReconcileAt: Date | null;
        reconcileSource: import(".prisma/client").$Enums.ReconcileSource | null;
    }>;
    rejectPayment(id: string, reason?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        subscriptionPlanId: string | null;
        movieId: string | null;
        amount: number;
        status: import(".prisma/client").$Enums.PaymentStatus;
        paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
        qpayInvoiceId: string | null;
        qpayQrCode: string | null;
        qpayQrImage: string | null;
        qpayDeeplinks: import("@prisma/client/runtime/library").JsonValue | null;
        qpayPaymentId: string | null;
        qpayRawPayload: import("@prisma/client/runtime/library").JsonValue | null;
        bankAccountId: string | null;
        transferRef: string | null;
        userNotifiedAt: Date | null;
        invoiceCode: string;
        paidAt: Date | null;
        reconcileAttempts: number;
        lastReconcileAt: Date | null;
        nextReconcileAt: Date | null;
        reconcileSource: import(".prisma/client").$Enums.ReconcileSource | null;
    }>;
    getBankAccounts(includeInactive?: boolean): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isActive: boolean;
        bankName: string;
        bankCode: string;
        accountNumber: string;
        accountHolder: string;
        sortOrder: number;
    }[]>;
    getBankAccount(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isActive: boolean;
        bankName: string;
        bankCode: string;
        accountNumber: string;
        accountHolder: string;
        sortOrder: number;
    }>;
    createBankAccount(dto: CreateBankAccountDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isActive: boolean;
        bankName: string;
        bankCode: string;
        accountNumber: string;
        accountHolder: string;
        sortOrder: number;
    }>;
    updateBankAccount(id: string, dto: UpdateBankAccountDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isActive: boolean;
        bankName: string;
        bankCode: string;
        accountNumber: string;
        accountHolder: string;
        sortOrder: number;
    }>;
    deleteBankAccount(id: string): Promise<{
        success: boolean;
    }>;
    getSettings(): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        key: string;
        value: string;
    }[]>;
    getSetting(key: string): Promise<{
        key: string;
        value: string | null;
    }>;
    updateSetting(key: string, body: {
        value: string;
        description?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        key: string;
        value: string;
    }>;
    getSubscriptionPlans(includeInactive?: boolean): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        price: number;
        nameEn: string | null;
        durationDays: number;
        isActive: boolean;
    }[]>;
    getSubscriptionPlan(id: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        price: number;
        nameEn: string | null;
        durationDays: number;
        isActive: boolean;
    }>;
    createSubscriptionPlan(dto: CreateSubscriptionPlanDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        price: number;
        nameEn: string | null;
        durationDays: number;
        isActive: boolean;
    }>;
    updateSubscriptionPlan(id: string, dto: UpdateSubscriptionPlanDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        price: number;
        nameEn: string | null;
        durationDays: number;
        isActive: boolean;
    }>;
    deleteSubscriptionPlan(id: string): Promise<{
        success: boolean;
    }>;
    getMoviePurchases(page?: number, limit?: number, movieId?: string): Promise<{
        purchases: ({
            user: {
                id: string;
                email: string | null;
                name: string;
            };
            movie: {
                id: string;
                title: string;
                price: number | null;
            };
            payment: {
                id: string;
                amount: number;
                paymentMethod: import(".prisma/client").$Enums.PaymentMethod;
                paidAt: Date | null;
            };
        } & {
            id: string;
            createdAt: Date;
            userId: string;
            movieId: string;
            paymentId: string;
        })[];
        total: number;
    }>;
    getSubscriptionStats(): Promise<{
        totalSubscriptions: number;
        activeSubscriptions: number;
        expiredSubscriptions: number;
        cancelledSubscriptions: number;
        totalRevenue: number;
    }>;
    changePassword(req: any, dto: ChangePasswordDto): Promise<{
        success: boolean;
    }>;
}
export {};
