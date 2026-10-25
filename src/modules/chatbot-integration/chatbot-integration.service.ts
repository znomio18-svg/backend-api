import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Movie,
  MovieCategory,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { EmailService } from '../../config/email.service';
import { BunnyService } from '../movies/bunny.service';
import { PaymentsService } from '../payments/payments.service';
import { AdminSettingsService } from '../admin/admin-settings.service';
import { WatchAccessService } from '../watch-access/watch-access.service';
import {
  AdminAlertDto,
  CreateOrderDto,
  IssueWatchLinkDto,
  ResolveUserDto,
  SearchTitlesDto,
} from './chatbot-integration.dto';

/**
 * How a movie can be watched, from the chatbot's point of view. 1MinDrama
 * has no rentals or series: a movie with a price is bought for good
 * (PURCHASE), the rest are watched with a plan (SUBSCRIPTION).
 */
export type TitleAvailability = 'PURCHASE' | 'FREE' | 'SUBSCRIPTION' | 'UNAVAILABLE';

const DESCRIPTION_PREVIEW_CHARS = 280;

/**
 * Thin façade the chatbot talks to — the same contract as FMDrama's, so one
 * chatbot serves both platforms. Every business rule (price, QPay invoice,
 * payment confirmation, entitlement) stays in the existing services; this
 * layer only shapes compact answers and checks that each order belongs to
 * the user asking about it.
 */
@Injectable()
export class ChatbotIntegrationService {
  private readonly logger = new Logger(ChatbotIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bunnyService: BunnyService,
    private readonly paymentsService: PaymentsService,
    private readonly adminSettingsService: AdminSettingsService,
    private readonly watchAccessService: WatchAccessService,
    private readonly emailService: EmailService,
  ) {}

  // ============ Users ============

  /** Find or create the platform user behind a chatbot identity. */
  async resolveUser(dto: ResolveUserDto) {
    const existing = await this.prisma.externalIdentity.findUnique({
      where: { provider_externalId: { provider: dto.provider, externalId: dto.externalId } },
      include: { user: { select: { id: true, name: true } } },
    });
    if (existing) {
      return { userId: existing.user.id, name: existing.user.name, created: false };
    }

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: dto.name?.trim() || (dto.provider === 'web' ? 'Вэб зочин' : 'Messenger хэрэглэгч'),
            avatar: dto.avatar,
          },
        });
        await tx.externalIdentity.create({
          data: { provider: dto.provider, externalId: dto.externalId, userId: created.id },
        });
        return created;
      });
      this.logger.log(`Created user ${user.id} for ${dto.provider} identity`);
      return { userId: user.id, name: user.name, created: true };
    } catch (error) {
      // Two messages from a brand-new user raced — the other one won
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.prisma.externalIdentity.findUniqueOrThrow({
          where: { provider_externalId: { provider: dto.provider, externalId: dto.externalId } },
        });
        return { userId: winner.userId, name: dto.name, created: false };
      }
      throw error;
    }
  }

  // ============ Catalog ============

  /** No genres on this platform; the categories are the only grouping. */
  async listGenres() {
    return { genres: [], categories: Object.values(MovieCategory) };
  }

  async searchTitles(dto: SearchTitlesDto) {
    const limit = Math.min(dto.limit ?? 10, 20);
    // No series and no genres here: such a search finds nothing rather than everything
    if (dto.type === 'series' || dto.genre) return { total: 0, items: [] };
    const category = dto.category?.toUpperCase();
    if (category && !(Object.values(MovieCategory) as string[]).includes(category)) return { total: 0, items: [] };

    const accessMode = await this.adminSettingsService.getAppAccessMode();
    const where: Prisma.MovieWhereInput = { isPublished: true };
    if (dto.query) {
      where.OR = [
        { title: { contains: dto.query, mode: 'insensitive' } },
        { description: { contains: dto.query, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = category as MovieCategory;
    if (dto.rentableOnly) where.price = { gt: 0 };
    if (dto.minPrice !== undefined || dto.maxPrice !== undefined) {
      where.price = {
        ...(where.price as Prisma.IntNullableFilter),
        ...(dto.minPrice !== undefined ? { gte: dto.minPrice } : {}),
        ...(dto.maxPrice !== undefined ? { lte: dto.maxPrice } : {}),
        not: null,
      };
    }

    const movies = await this.prisma.movie.findMany({ where, take: limit, orderBy: this.movieOrder(dto.sort) });
    const items = movies.map((m) => this.summarizeMovie(m, accessMode));
    return { total: items.length, items };
  }

  private movieOrder(sort?: SearchTitlesDto['sort']): Prisma.MovieOrderByWithRelationInput[] {
    switch (sort) {
      case 'popular':
        return [{ viewCount: 'desc' }];
      case 'rating':
        return [{ rating: 'desc' }];
      case 'price_asc':
        return [{ price: 'asc' }];
      case 'price_desc':
        return [{ price: 'desc' }];
      case 'latest':
      default:
        return [{ releaseYear: 'desc' }, { createdAt: 'desc' }];
    }
  }

  async getMovie(movieId: string) {
    const movie = await this.prisma.movie.findUnique({ where: { id: movieId } });
    if (!movie || !movie.isPublished) {
      throw new NotFoundException('Кино олдсонгүй');
    }
    const accessMode = await this.adminSettingsService.getAppAccessMode();
    return { ...this.summarizeMovie(movie, accessMode), description: movie.description };
  }

  async getSeries(_seriesId: string) {
    throw new NotFoundException('Цуврал олдсонгүй');
  }

  private movieAvailability(movie: Pick<Movie, 'isPublished' | 'price'>, accessMode: string): TitleAvailability {
    if (!movie.isPublished) return 'UNAVAILABLE';
    if (accessMode === 'free') return 'FREE';
    return movie.price && movie.price > 0 ? 'PURCHASE' : 'SUBSCRIPTION';
  }

  private summarizeMovie(movie: Movie, accessMode: string) {
    const availability = this.movieAvailability(movie, accessMode);
    return {
      kind: 'movie' as const,
      id: movie.id,
      title: movie.title,
      description: this.preview(movie.description),
      thumbnailUrl: this.bunnyService.resolveImageUrl(movie.thumbnailUrl),
      releaseYear: movie.releaseYear,
      durationMinutes: Math.round(movie.duration / 60),
      rating: movie.rating,
      category: movie.category,
      genres: [] as string[],
      availability,
      price: availability === 'PURCHASE' ? movie.price : null,
      // A purchase is permanent — there is no viewing window
      rentalHours: null,
    };
  }

  private preview(text: string): string {
    return text.length > DESCRIPTION_PREVIEW_CHARS
      ? `${text.slice(0, DESCRIPTION_PREVIEW_CHARS).trimEnd()}…`
      : text;
  }

  // ============ Subscription plans ============

  async listPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
      select: { id: true, name: true, description: true, price: true, durationDays: true },
    });
    return { plans };
  }

  /**
   * A plan is tied to an account the person can sign in to on the website or
   * app. A chatbot guest has no way to sign in, so selling them a plan would
   * sell something they cannot use.
   */
  private async assertCanBuyPlan(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { facebookId: true, phoneNumber: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!(user.facebookId || user.phoneNumber || user.email)) {
      throw new ForbiddenException({ code: 'LOGIN_REQUIRED', message: 'Багц авахын тулд нэвтэрнэ үү' });
    }

    return this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE, endDate: { gt: new Date() } },
      orderBy: { endDate: 'desc' },
    });
  }

  // ============ Orders (QPay invoices) ============

  async createOrder(dto: CreateOrderDto) {
    const { userId, movieId, seriesId, subscriptionPlanId } = dto;
    const paymentMethod =
      dto.paymentMethod === 'BANK_TRANSFER' ? PaymentMethod.BANK_TRANSFER : PaymentMethod.QPAY;

    if (subscriptionPlanId) {
      if (movieId || seriesId) throw new BadRequestException('Provide only one target');
      const active = await this.assertCanBuyPlan(userId);
      if (active) {
        return { status: 'ALREADY_SUBSCRIBED' as const, subscription: { endDate: active.endDate } };
      }
      const payment = await this.paymentsService.createPayment(userId, { subscriptionPlanId, paymentMethod });
      return this.serializeOrder(payment, true);
    }

    if (seriesId) throw new NotFoundException('Цуврал олдсонгүй');
    if (!movieId) throw new BadRequestException('Provide movieId or subscriptionPlanId');
    await this.assertUserExists(userId);

    const movie = await this.prisma.movie.findUnique({ where: { id: movieId } });
    if (!movie || !movie.isPublished) throw new NotFoundException('Кино олдсонгүй');
    if (!movie.price || movie.price <= 0) {
      throw new BadRequestException({ code: 'NOT_RENTABLE', message: 'Энэ киног худалдаж авах боломжгүй' });
    }

    const owned = await this.prisma.moviePurchase.findUnique({
      where: { userId_movieId: { userId, movieId } },
    });
    if (owned) {
      return {
        status: 'ALREADY_OWNED' as const,
        purchase: { id: owned.id, movieId: owned.movieId, paymentId: owned.paymentId, createdAt: owned.createdAt },
      };
    }

    const payment = await this.paymentsService.createPayment(userId, { movieId, paymentMethod });
    return this.serializeOrder(payment, true);
  }

  /**
   * Order status. With `verify`, a still-pending QPay invoice is checked with
   * QPay first — the only way a payment ever becomes PAID.
   */
  async getOrder(userId: string, paymentId: string, verify: boolean) {
    let payment = await this.findUserPayment(userId, paymentId);

    let verifyError: string | undefined;
    if (verify && payment.status === PaymentStatus.PENDING && payment.qpayInvoiceId) {
      try {
        payment = await this.paymentsService.checkAndProcessPayment(payment.id);
      } catch (error) {
        verifyError = error instanceof Error ? error.message : 'QPay check failed';
        this.logger.warn(`QPay verification failed for ${payment.id}: ${verifyError}`);
      }
    }

    return { ...(await this.serializeOrder(payment, false)), verifyError };
  }

  private async findUserPayment(userId: string, paymentId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    // "Not yours" and "does not exist" look the same
    if (!payment || payment.userId !== userId) {
      throw new NotFoundException('Захиалга олдсонгүй');
    }
    return payment;
  }

  private async serializeOrder(payment: Payment, includeInvoice: boolean) {
    if (payment.subscriptionPlanId) {
      return this.serializePlanOrder(payment, includeInvoice);
    }

    const [purchase, movie] = await Promise.all([
      this.prisma.moviePurchase.findUnique({ where: { paymentId: payment.id } }),
      payment.movieId
        ? this.prisma.movie.findUnique({ where: { id: payment.movieId }, select: { title: true } })
        : null,
    ]);

    return {
      status: payment.status,
      paymentId: payment.id,
      invoiceCode: payment.invoiceCode,
      paymentMethod: payment.paymentMethod,
      movieId: payment.movieId,
      seriesId: null,
      title: movie?.title ?? null,
      kind: 'PURCHASE' as const,
      rentalHours: null,
      amount: payment.amount,
      originalAmount: payment.amount,
      discountAmount: 0,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      rental: null,
      purchase: purchase
        ? { id: purchase.id, movieId: purchase.movieId, paymentId: purchase.paymentId, createdAt: purchase.createdAt }
        : null,
      invoice: includeInvoice
        ? { qrText: payment.qpayQrCode, qrImage: payment.qpayQrImage, deeplinks: payment.qpayDeeplinks }
        : undefined,
    };
  }

  private async serializePlanOrder(payment: Payment, includeInvoice: boolean) {
    const [plan, subscription] = await Promise.all([
      this.prisma.subscriptionPlan.findUnique({ where: { id: payment.subscriptionPlanId! } }),
      payment.status === PaymentStatus.PAID
        ? this.prisma.subscription.findFirst({
            where: { userId: payment.userId, planId: payment.subscriptionPlanId!, status: SubscriptionStatus.ACTIVE },
            orderBy: { endDate: 'desc' },
          })
        : null,
    ]);

    return {
      status: payment.status,
      paymentId: payment.id,
      invoiceCode: payment.invoiceCode,
      paymentMethod: payment.paymentMethod,
      movieId: null,
      seriesId: null,
      subscriptionPlanId: payment.subscriptionPlanId,
      title: plan ? `${plan.name} багц` : 'Багц',
      kind: 'SUBSCRIPTION' as const,
      rentalHours: null,
      amount: payment.amount,
      originalAmount: payment.amount,
      discountAmount: 0,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      rental: null,
      purchase: null,
      subscription: subscription ? { id: subscription.id, endDate: subscription.endDate } : null,
      invoice: includeInvoice
        ? { qrText: payment.qpayQrCode, qrImage: payment.qpayQrImage, deeplinks: payment.qpayDeeplinks }
        : undefined,
    };
  }

  // ============ Admin alerts ============

  /** E-mail staff (e.g. new support tickets) through the platform's mailer. */
  async adminAlert(dto: AdminAlertDto) {
    const setting = await this.prisma.adminSettings.findUnique({ where: { key: 'notification_email' } });
    const to = (dto.to?.length ? dto.to : (setting?.value ?? '').split(','))
      .map((e) => e.trim())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (!to.length) return { sent: false, reason: 'NO_RECIPIENT' };

    const escaped = dto.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const sent = await this.emailService.sendEmail({
      to,
      subject: dto.subject,
      text: dto.text,
      html: `<pre style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;white-space:pre-wrap;font-size:14px">${escaped}</pre>`,
    });
    return { sent, reason: sent ? undefined : 'SMTP_NOT_CONFIGURED_OR_FAILED' };
  }

  // ============ Support ============

  /**
   * Everything needed to answer "I paid but cannot watch": how the account
   * signs in, what it has access to, and its recent payments.
   */
  async supportSnapshot(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, facebookId: true, phoneNumber: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const [subscription, purchases, payments] = await Promise.all([
      this.prisma.subscription.findFirst({
        where: { userId, status: SubscriptionStatus.ACTIVE, endDate: { gt: new Date() } },
        orderBy: { endDate: 'desc' },
        include: { plan: { select: { name: true } } },
      }),
      this.prisma.moviePurchase.count({ where: { userId } }),
      this.prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { movie: { select: { title: true } }, subscriptionPlan: { select: { name: true } } },
      }),
    ]);

    // Login methods only as flags — never hand identifiers to the chatbot
    const loginMethods = [
      user.phoneNumber && 'phone',
      user.facebookId && 'facebook',
      user.email && 'email',
    ].filter(Boolean);

    return {
      loginMethods,
      subscription: subscription ? { plan: subscription.plan.name, endDate: subscription.endDate } : null,
      activeRentals: [],
      permanentPurchases: purchases,
      payments: payments.map((p) => ({
        id: p.id,
        method: p.paymentMethod,
        status: p.status,
        amount: p.amount,
        item: p.movie?.title ?? (p.subscriptionPlan ? `${p.subscriptionPlan.name} багц` : null),
        kind: p.subscriptionPlanId ? 'SUBSCRIPTION' : 'MOVIE',
        movieId: p.movieId,
        transferRef: p.transferRef,
        userNotifiedAt: p.userNotifiedAt,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
        rental: null,
      })),
    };
  }

  /**
   * Re-check one of the user's QPay payments with QPay. Recovers the classic
   * "paid, but the invoice expired first" case: QPay is the proof, so a paid
   * invoice is settled even if it had already been marked EXPIRED.
   */
  async recheckPayment(userId: string, paymentId: string) {
    const payment = await this.findUserPayment(userId, paymentId);
    const before = payment.status;

    if (payment.paymentMethod !== PaymentMethod.QPAY || !payment.qpayInvoiceId) {
      return { changed: false, before, ...(await this.serializeOrder(payment, false)) };
    }

    let current = payment;
    try {
      if (payment.status === PaymentStatus.PENDING) {
        current = await this.paymentsService.checkAndProcessPayment(payment.id);
      } else if (payment.status === PaymentStatus.EXPIRED) {
        current = await this.paymentsService.adminReconcilePayment(payment.id);
      }
    } catch (error) {
      // adminReconcilePayment throws when QPay says it was not paid
      this.logger.log(`Recheck of ${payment.id}: ${(error as Error).message}`);
      current = (await this.prisma.payment.findUnique({ where: { id: payment.id } })) ?? payment;
    }

    return { changed: current.status !== before, before, ...(await this.serializeOrder(current, false)) };
  }

  // ============ Library & watch links ============

  /** The user's purchased movies (the chatbot calls this "rentals"). */
  async listRentals(userId: string) {
    const purchases = await this.prisma.moviePurchase.findMany({
      where: { userId },
      include: { movie: { select: { id: true, title: true, thumbnailUrl: true, isPublished: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return purchases
      .filter((p) => p.movie.isPublished)
      .map((p) => ({
        kind: 'PURCHASE' as const,
        id: p.id,
        movieId: p.movieId,
        seriesId: null,
        paymentId: p.paymentId,
        startsAt: p.createdAt,
        expiresAt: null,
        title: p.movie.title,
        thumbnailUrl: this.bunnyService.resolveImageUrl(p.movie.thumbnailUrl),
      }));
  }

  /** Mint a watch link for a purchase the user owns. */
  async issueWatchLink(dto: IssueWatchLinkDto) {
    const { userId, purchaseId, paymentId, movieId } = dto;

    let purchase = purchaseId
      ? await this.prisma.moviePurchase.findUnique({ where: { id: purchaseId } })
      : paymentId
        ? await this.prisma.moviePurchase.findUnique({ where: { paymentId } })
        : movieId
          ? await this.prisma.moviePurchase.findUnique({ where: { userId_movieId: { userId, movieId } } })
          : null;
    if (purchase && purchase.userId !== userId) purchase = null;

    if (!purchase) {
      throw new NotFoundException({ code: 'NO_RENTAL', message: 'Худалдан авалт олдсонгүй' });
    }
    const link = await this.watchAccessService.issueForPurchase(purchase.id, userId, 'messenger');
    return { ...link, kind: 'PURCHASE' as const, rentalId: null, purchaseId: purchase.id };
  }

  private async assertUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
  }
}
