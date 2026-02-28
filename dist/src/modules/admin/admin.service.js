"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma.service");
const client_1 = require("@prisma/client");
let AdminService = class AdminService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDashboardStats(filter) {
        const dateFilter = this.buildDateFilter(filter);
        const [totalUsers, totalMovies, featuredMovies, revenueResult, totalPayments, recentPayments, activeSubscriptions, totalMoviePurchases, moviePurchaseRevenueResult,] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.movie.count(),
            this.prisma.movie.count({ where: { isFeatured: true } }),
            this.prisma.payment.aggregate({
                where: {
                    status: client_1.PaymentStatus.PAID,
                    ...dateFilter,
                },
                _sum: { amount: true },
            }),
            this.prisma.payment.count({
                where: { status: client_1.PaymentStatus.PAID },
            }),
            this.prisma.payment.count({
                where: {
                    status: client_1.PaymentStatus.PAID,
                    paidAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                },
            }),
            this.prisma.subscription.count({
                where: {
                    status: client_1.SubscriptionStatus.ACTIVE,
                    endDate: { gt: new Date() },
                },
            }),
            this.prisma.moviePurchase.count(),
            this.prisma.payment.aggregate({
                where: {
                    status: client_1.PaymentStatus.PAID,
                    movieId: { not: null },
                    ...dateFilter,
                },
                _sum: { amount: true },
            }),
        ]);
        return {
            totalUsers,
            totalMovies,
            featuredMovies,
            totalRevenue: revenueResult._sum.amount || 0,
            totalPayments,
            recentPayments,
            activeSubscriptions,
            totalMoviePurchases,
            moviePurchaseRevenue: moviePurchaseRevenueResult._sum.amount || 0,
        };
    }
    async getRevenueStats(filter) {
        const dateFilter = this.buildDateFilter(filter);
        const payments = await this.prisma.payment.findMany({
            where: {
                status: client_1.PaymentStatus.PAID,
                ...dateFilter,
            },
            select: {
                amount: true,
                paidAt: true,
            },
            orderBy: { paidAt: 'asc' },
        });
        const dailyRevenue = payments.reduce((acc, payment) => {
            if (!payment.paidAt)
                return acc;
            const date = payment.paidAt.toISOString().split('T')[0];
            acc[date] = (acc[date] || 0) + payment.amount;
            return acc;
        }, {});
        return {
            totalRevenue: payments.reduce((sum, p) => sum + p.amount, 0),
            paymentCount: payments.length,
            dailyRevenue: Object.entries(dailyRevenue).map(([date, amount]) => ({
                date,
                amount,
            })),
        };
    }
    async getReportData(type, startDate, endDate) {
        let filter = {};
        const now = new Date();
        switch (type) {
            case 'today':
                filter = {
                    startDate: new Date(now.setHours(0, 0, 0, 0)),
                    endDate: new Date(),
                };
                break;
            case 'week':
                filter = {
                    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    endDate: new Date(),
                };
                break;
            case 'month':
                filter = {
                    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    endDate: new Date(),
                };
                break;
            case 'custom':
                filter = { startDate, endDate };
                break;
        }
        const [stats, revenue, newUsers, paymentsByStatus] = await Promise.all([
            this.getDashboardStats(filter),
            this.getRevenueStats(filter),
            this.getNewUsersCount(filter),
            this.getPaymentsByStatus(filter),
        ]);
        return {
            period: type,
            startDate: filter.startDate,
            endDate: filter.endDate,
            stats,
            revenue,
            newUsers,
            paymentsByStatus,
        };
    }
    async getNewUsersCount(filter) {
        const dateFilter = filter?.startDate || filter?.endDate ? {
            createdAt: {
                ...(filter.startDate && { gte: filter.startDate }),
                ...(filter.endDate && { lte: filter.endDate }),
            },
        } : {};
        return this.prisma.user.count({ where: dateFilter });
    }
    async getPaymentsByStatus(filter) {
        const dateFilter = this.buildDateFilter(filter);
        const result = await this.prisma.payment.groupBy({
            by: ['status'],
            where: dateFilter,
            _count: { id: true },
            _sum: { amount: true },
        });
        return result.map((r) => ({
            status: r.status,
            count: r._count.id,
            amount: r._sum.amount || 0,
        }));
    }
    async getMoviePurchases(params) {
        const { skip = 0, take = 20, movieId } = params;
        const where = {};
        if (movieId) {
            where.movieId = movieId;
        }
        const [purchases, total] = await Promise.all([
            this.prisma.moviePurchase.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    movie: { select: { id: true, title: true, price: true } },
                    payment: { select: { id: true, amount: true, paymentMethod: true, paidAt: true } },
                },
            }),
            this.prisma.moviePurchase.count({ where }),
        ]);
        return { purchases, total };
    }
    buildDateFilter(filter) {
        if (!filter?.startDate && !filter?.endDate)
            return {};
        return {
            createdAt: {
                ...(filter.startDate && { gte: filter.startDate }),
                ...(filter.endDate && { lte: filter.endDate }),
            },
        };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map