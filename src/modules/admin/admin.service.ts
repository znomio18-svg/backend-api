import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PaymentStatus, SubscriptionStatus } from '@prisma/client';

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

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(filter?: DateRangeFilter): Promise<DashboardStats> {
    const dateFilter = this.buildDateFilter(filter);

    const [
      totalUsers,
      totalMovies,
      featuredMovies,
      revenueResult,
      totalPayments,
      recentPayments,
      activeSubscriptions,
      totalMoviePurchases,
      moviePurchaseRevenueResult,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.movie.count(),
      this.prisma.movie.count({ where: { isFeatured: true } }),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.PAID,
          ...dateFilter,
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.count({
        where: { status: PaymentStatus.PAID },
      }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.PAID,
          paidAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.subscription.count({
        where: {
          status: SubscriptionStatus.ACTIVE,
          endDate: { gt: new Date() },
        },
      }),
      this.prisma.moviePurchase.count(),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.PAID,
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

  async getRevenueStats(filter?: DateRangeFilter) {
    const dateFilter = this.buildDateFilter(filter);

    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PAID,
        ...dateFilter,
      },
      select: {
        amount: true,
        paidAt: true,
      },
      orderBy: { paidAt: 'asc' },
    });

    const dailyRevenue = payments.reduce(
      (acc, payment) => {
        if (!payment.paidAt) return acc;
        const date = payment.paidAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + payment.amount;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalRevenue: payments.reduce((sum, p) => sum + p.amount, 0),
      paymentCount: payments.length,
      dailyRevenue: Object.entries(dailyRevenue).map(([date, amount]) => ({
        date,
        amount,
      })),
    };
  }

  async getReportData(
    type: 'today' | 'week' | 'month' | 'custom',
    startDate?: Date,
    endDate?: Date,
  ) {
    let filter: DateRangeFilter = {};

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

    const [stats, revenue, newUsers, paymentsByStatus] =
      await Promise.all([
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

  private async getNewUsersCount(filter?: DateRangeFilter) {
    const dateFilter = filter?.startDate || filter?.endDate ? {
      createdAt: {
        ...(filter.startDate && { gte: filter.startDate }),
        ...(filter.endDate && { lte: filter.endDate }),
      },
    } : {};

    return this.prisma.user.count({ where: dateFilter });
  }

  private async getPaymentsByStatus(filter?: DateRangeFilter) {
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

  async getMoviePurchases(params: {
    skip?: number;
    take?: number;
    movieId?: string;
  }) {
    const { skip = 0, take = 20, movieId } = params;

    const where: any = {};
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

  private buildDateFilter(filter?: DateRangeFilter) {
    if (!filter?.startDate && !filter?.endDate) return {};

    return {
      createdAt: {
        ...(filter.startDate && { gte: filter.startDate }),
        ...(filter.endDate && { lte: filter.endDate }),
      },
    };
  }
}
