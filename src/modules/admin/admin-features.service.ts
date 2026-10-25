import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ReconcileSource,
  SubscriptionStatus,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../config/prisma.service';
import { BunnyService } from '../movies/bunny.service';
import { PaymentsService } from '../payments/payments.service';

/** Invoice prefix of zero-amount admin movie grants (not real sales). */
export const GRANT_INVOICE_PREFIX = 'GRANT-';
/** Prisma filter that leaves admin grants out of sales stats. */
export const NOT_GRANT: Prisma.PaymentWhereInput = {
  NOT: { invoiceCode: { startsWith: GRANT_INVOICE_PREFIX } },
};

export type UserSource = 'chatbot' | 'site';

const EXPORT_MAX_ROWS = 50_000;
const EXPORT_BATCH = 5_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Excel-friendly local time: "2026-10-25 14:03:00" (Ulaanbaatar). */
function formatDate(value: Date | null | undefined): string {
  if (!value) return '';
  return value.toLocaleString('sv-SE', { timeZone: 'Asia/Ulaanbaatar' });
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? formatDate(value) : String(value);
  // Formula-injection guard (keep plain numbers / phone numbers as-is)
  if (/^[=+\-@\t\r]/.test(text) && !/^[+-]?\d[\d\s.]*$/.test(text)) text = `'${text}`;
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // BOM so Excel opens UTF-8 (Cyrillic) correctly
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

@Injectable()
export class AdminFeaturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bunnyService: BunnyService,
    private readonly paymentsService: PaymentsService,
  ) {}

  // ============ Source (chatbot vs site) ============

  /** userId → 'chatbot' if it has an ExternalIdentity, else 'site'. */
  async sourcesFor(userIds: string[]): Promise<Map<string, UserSource>> {
    const map = new Map<string, UserSource>(userIds.map((id) => [id, 'site']));
    if (userIds.length === 0) return map;
    const rows = await this.prisma.externalIdentity.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true },
      distinct: ['userId'],
    });
    for (const r of rows) map.set(r.userId, 'chatbot');
    return map;
  }

  sourceWhere(source?: string): Prisma.UserWhereInput | undefined {
    if (source === 'chatbot') return { externalIdentities: { some: {} } };
    if (source === 'site') return { externalIdentities: { none: {} } };
    return undefined;
  }

  // ============ Grants ============

  async grantSubscription(userId: string, planId: string, days?: number) {
    const [user, plan] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      this.prisma.subscriptionPlan.findUnique({ where: { id: planId } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!plan) throw new NotFoundException('Subscription plan not found');

    const addDays = days ?? plan.durationDays;
    if (!addDays || addDays < 1) throw new BadRequestException('Invalid number of days');

    const select = { id: true, planId: true, startDate: true, endDate: true, status: true } as const;
    const subscription = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const active = await tx.subscription.findFirst({
        where: { userId, status: SubscriptionStatus.ACTIVE, endDate: { gt: now } },
        orderBy: { endDate: 'desc' },
      });
      if (active) {
        return tx.subscription.update({
          where: { id: active.id },
          data: { endDate: new Date(active.endDate.getTime() + addDays * DAY_MS) },
          select,
        });
      }
      return tx.subscription.create({
        data: {
          userId,
          planId,
          startDate: now,
          endDate: new Date(now.getTime() + addDays * DAY_MS),
          status: SubscriptionStatus.ACTIVE,
        },
        select,
      });
    });

    return { subscription };
  }

  async grantMovie(userId: string, movieId: string, adminId: string, note?: string) {
    const [user, movie, owned] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      this.prisma.movie.findUnique({ where: { id: movieId }, select: { id: true } }),
      this.prisma.moviePurchase.findUnique({ where: { userId_movieId: { userId, movieId } } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!movie) throw new NotFoundException('Movie not found');
    if (owned) throw new ConflictException('User already owns this movie');

    try {
      const purchase = await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const payment = await tx.payment.create({
          data: {
            userId,
            movieId,
            amount: 0,
            status: PaymentStatus.PAID,
            paymentMethod: PaymentMethod.BANK_TRANSFER,
            reconcileSource: ReconcileSource.MANUAL,
            paidAt: now,
            invoiceCode: `${GRANT_INVOICE_PREFIX}${uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase()}`,
            qpayRawPayload: { grantedBy: adminId, note: note ?? null },
          },
        });
        return tx.moviePurchase.create({
          data: { userId, movieId, paymentId: payment.id },
          select: { id: true, movieId: true, paymentId: true, createdAt: true },
        });
      });
      return { purchase };
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('User already owns this movie');
      throw error;
    }
  }

  // ============ Top selling ============

  async topSellingMovies(params: { limit?: number; startDate?: Date; endDate?: Date }) {
    const limit = Math.min(100, Math.max(1, Math.floor(Number(params.limit) || 10)));
    const where: Prisma.PaymentWhereInput = {
      status: PaymentStatus.PAID,
      movieId: { not: null },
      ...NOT_GRANT,
    };
    if (params.startDate || params.endDate) {
      where.paidAt = {
        ...(params.startDate && { gte: params.startDate }),
        ...(params.endDate && { lte: params.endDate }),
      };
    }

    const grouped = await this.prisma.payment.groupBy({
      by: ['movieId'],
      where,
      _count: { id: true },
      _sum: { amount: true },
      orderBy: [{ _count: { id: 'desc' } }, { _sum: { amount: 'desc' } }],
      take: limit,
    });

    const ids = grouped.map((g) => g.movieId!).filter(Boolean);
    const movies = await this.prisma.movie.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, thumbnailUrl: true },
    });
    const byId = new Map(movies.map((m) => [m.id, m]));

    return grouped
      .filter((g) => g.movieId && byId.has(g.movieId))
      .map((g) => {
        const movie = byId.get(g.movieId!)!;
        return {
          movieId: movie.id,
          title: movie.title,
          thumbnailUrl: this.bunnyService.resolveImageUrl(movie.thumbnailUrl),
          purchases: g._count.id,
          revenue: g._sum.amount ?? 0,
        };
      });
  }

  // ============ CSV export ============

  async exportPaymentsCsv(params: {
    status?: PaymentStatus;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    source?: 'chatbot' | 'site';
  }): Promise<string> {
    const where = this.paymentsService.buildPaymentLogWhere(params);
    const rows: unknown[][] = [];
    let cursor: string | undefined;

    while (rows.length < EXPORT_MAX_ROWS) {
      const batch = await this.prisma.payment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: Math.min(EXPORT_BATCH, EXPORT_MAX_ROWS - rows.length),
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        select: {
          id: true,
          invoiceCode: true,
          createdAt: true,
          paymentMethod: true,
          status: true,
          amount: true,
          paidAt: true,
          transferRef: true,
          user: {
            select: {
              name: true,
              phoneNumber: true,
              externalIdentities: { select: { id: true }, take: 1 },
            },
          },
          movie: { select: { title: true } },
          subscriptionPlan: { select: { name: true } },
        },
      });
      for (const p of batch) {
        rows.push([
          p.invoiceCode,
          p.createdAt,
          p.user?.name ?? '',
          p.user?.phoneNumber ?? '',
          p.movie?.title ?? p.subscriptionPlan?.name ?? '',
          p.paymentMethod,
          p.status,
          p.amount,
          p.paidAt,
          p.transferRef ?? '',
          p.user?.externalIdentities.length ? 'chatbot' : 'site',
        ]);
      }
      if (batch.length < EXPORT_BATCH) break;
      cursor = batch[batch.length - 1].id;
    }

    return toCsv(
      ['invoiceCode', 'date', 'userName', 'phone', 'item', 'method', 'status', 'amount', 'paidAt', 'transferRef', 'source'],
      rows,
    );
  }

  async exportUsersCsv(params: { search?: string; source?: string }): Promise<string> {
    const and: Prisma.UserWhereInput[] = [];
    if (params.search) {
      and.push({
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { email: { contains: params.search, mode: 'insensitive' } },
          { phoneNumber: { contains: params.search } },
        ],
      });
    }
    const sourceWhere = this.sourceWhere(params.source);
    if (sourceWhere) and.push(sourceWhere);
    const where: Prisma.UserWhereInput = and.length ? { AND: and } : {};

    const now = new Date();
    const rows: unknown[][] = [];
    let cursor: string | undefined;

    while (rows.length < EXPORT_MAX_ROWS) {
      const batch = await this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: Math.min(EXPORT_BATCH, EXPORT_MAX_ROWS - rows.length),
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          email: true,
          createdAt: true,
          subscriptions: {
            where: { status: SubscriptionStatus.ACTIVE, endDate: { gt: now } },
            orderBy: { endDate: 'desc' },
            take: 1,
            select: { endDate: true },
          },
          externalIdentities: { select: { id: true }, take: 1 },
          _count: { select: { moviePurchases: true } },
        },
      });
      for (const u of batch) {
        rows.push([
          u.id,
          u.name,
          u.phoneNumber ?? '',
          u.email ?? '',
          u.createdAt,
          u.subscriptions[0]?.endDate ?? '',
          u._count.moviePurchases,
          u.externalIdentities.length ? 'chatbot' : 'site',
        ]);
      }
      if (batch.length < EXPORT_BATCH) break;
      cursor = batch[batch.length - 1].id;
    }

    return toCsv(
      ['id', 'name', 'phone', 'email', 'createdAt', 'activeSubscriptionEnd', 'purchasesCount', 'source'],
      rows,
    );
  }
}
