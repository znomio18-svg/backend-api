import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { EmailService } from '../../config/email.service';
import { QpayService, QPayPaymentCheckResponse } from './qpay.service';
import {
  Payment,
  PaymentStatus,
  PaymentMethod,
  ReconcileSource,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// Backoff schedule in minutes: attempt 0 = immediate, 1 = 1min, 2 = 5min, etc.
const BACKOFF_SCHEDULE_MINUTES = [0, 1, 5, 15, 60];
const MAX_RECONCILE_ATTEMPTS = 5;

export interface ReconcileResult {
  payment: Payment;
  action: 'created' | 'updated' | 'skipped' | 'already_paid';
  reason?: string;
}

export interface CreatePaymentDto {
  subscriptionPlanId?: string;
  movieId?: string;
  paymentMethod?: PaymentMethod;
  bankAccountId?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private qpayService: QpayService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async createPayment(
    userId: string,
    options: CreatePaymentDto,
  ): Promise<Payment> {
    const { subscriptionPlanId, movieId, paymentMethod = PaymentMethod.QPAY, bankAccountId } = options;

    // Validate exactly one of subscriptionPlanId or movieId is provided
    if (subscriptionPlanId && movieId) {
      throw new BadRequestException('Provide either subscriptionPlanId or movieId, not both');
    }
    if (!subscriptionPlanId && !movieId) {
      throw new BadRequestException('Either subscriptionPlanId or movieId is required');
    }

    if (movieId) {
      return this.createMoviePayment(userId, movieId, paymentMethod, bankAccountId);
    }

    return this.createSubscriptionPayment(userId, subscriptionPlanId!, paymentMethod, bankAccountId);
  }

  private async createSubscriptionPayment(
    userId: string,
    subscriptionPlanId: string,
    paymentMethod: PaymentMethod,
    bankAccountId?: string,
  ): Promise<Payment> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: subscriptionPlanId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    if (!plan.isActive) {
      throw new BadRequestException('Subscription plan is not available');
    }

    // Check for existing active subscription
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        endDate: { gt: new Date() },
      },
    });

    if (existingSubscription) {
      throw new BadRequestException('You already have an active subscription');
    }

    // Check for recent pending payment with same payment method
    const pendingPayment = await this.prisma.payment.findFirst({
      where: {
        userId,
        subscriptionPlanId,
        paymentMethod,
        status: PaymentStatus.PENDING,
        createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) },
      },
      include: { subscriptionPlan: true, bankAccount: true },
    });

    if (pendingPayment) {
      return pendingPayment;
    }

    const invoiceCode = `INV-${uuidv4().slice(0, 8).toUpperCase()}`;
    const amount = plan.price;
    const description = `${plan.name} - Эрх худалдан авалт`;

    if (paymentMethod === PaymentMethod.BANK_TRANSFER) {
      if (bankAccountId) {
        const bankAccount = await this.prisma.bankAccount.findUnique({
          where: { id: bankAccountId },
        });
        if (!bankAccount || !bankAccount.isActive) {
          throw new BadRequestException('Invalid or inactive bank account');
        }
      }

      const transferRef = this.generateTransferReference();

      return this.prisma.payment.create({
        data: {
          userId,
          subscriptionPlanId,
          amount,
          invoiceCode,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          bankAccountId,
          transferRef,
        },
        include: { subscriptionPlan: true, bankAccount: true },
      });
    }

    // QPay payment
    const callbackUrl = `${this.configService.get('QPAY_CALLBACK_URL')}?invoice=${invoiceCode}`;

    const qpayInvoice = await this.qpayService.createInvoice({
      invoiceCode,
      amount,
      description,
      callbackUrl,
    });

    return this.prisma.payment.create({
      data: {
        userId,
        subscriptionPlanId,
        amount,
        invoiceCode,
        paymentMethod: PaymentMethod.QPAY,
        qpayInvoiceId: qpayInvoice.invoice_id,
        qpayQrCode: qpayInvoice.qr_text,
        qpayQrImage: qpayInvoice.qr_image,
        qpayDeeplinks: qpayInvoice.urls,
      },
      include: { subscriptionPlan: true },
    });
  }

  private async createMoviePayment(
    userId: string,
    movieId: string,
    paymentMethod: PaymentMethod,
    bankAccountId?: string,
  ): Promise<Payment> {
    const movie = await this.prisma.movie.findUnique({
      where: { id: movieId },
    });

    if (!movie) {
      throw new NotFoundException('Movie not found');
    }

    if (!movie.isPublished) {
      throw new BadRequestException('Movie is not available');
    }

    if (!movie.price || movie.price <= 0) {
      throw new BadRequestException('This movie is not available for individual purchase');
    }

    // Check if user already purchased this movie
    const existingPurchase = await this.prisma.moviePurchase.findUnique({
      where: {
        userId_movieId: { userId, movieId },
      },
    });

    if (existingPurchase) {
      throw new BadRequestException('You have already purchased this movie');
    }

    // Check for recent pending payment for the same movie
    const pendingPayment = await this.prisma.payment.findFirst({
      where: {
        userId,
        movieId,
        paymentMethod,
        status: PaymentStatus.PENDING,
        createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) },
      },
      include: { movie: true, bankAccount: true },
    });

    if (pendingPayment) {
      return pendingPayment;
    }

    const invoiceCode = `INV-${uuidv4().slice(0, 8).toUpperCase()}`;
    const amount = movie.price;
    const description = `${movie.title} - Кино худалдан авалт`;

    if (paymentMethod === PaymentMethod.BANK_TRANSFER) {
      if (bankAccountId) {
        const bankAccount = await this.prisma.bankAccount.findUnique({
          where: { id: bankAccountId },
        });
        if (!bankAccount || !bankAccount.isActive) {
          throw new BadRequestException('Invalid or inactive bank account');
        }
      }

      const transferRef = this.generateTransferReference();

      return this.prisma.payment.create({
        data: {
          userId,
          movieId,
          amount,
          invoiceCode,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          bankAccountId,
          transferRef,
        },
        include: { movie: true, bankAccount: true },
      });
    }

    // QPay payment
    const callbackUrl = `${this.configService.get('QPAY_CALLBACK_URL')}?invoice=${invoiceCode}`;

    const qpayInvoice = await this.qpayService.createInvoice({
      invoiceCode,
      amount,
      description,
      callbackUrl,
    });

    return this.prisma.payment.create({
      data: {
        userId,
        movieId,
        amount,
        invoiceCode,
        paymentMethod: PaymentMethod.QPAY,
        qpayInvoiceId: qpayInvoice.invoice_id,
        qpayQrCode: qpayInvoice.qr_text,
        qpayQrImage: qpayInvoice.qr_image,
        qpayDeeplinks: qpayInvoice.urls,
      },
      include: { movie: true },
    });
  }

  private generateTransferReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SK${timestamp}${random}`;
  }

  async getPayment(paymentId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { subscriptionPlan: true, movie: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async getPaymentByInvoiceCode(invoiceCode: string): Promise<Payment | null> {
    return this.prisma.payment.findUnique({
      where: { invoiceCode },
      include: { subscriptionPlan: true, movie: true, user: true },
    });
  }

  async checkAndProcessPayment(paymentId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || !payment.qpayInvoiceId) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      return payment;
    }

    const qpayCheck = await this.qpayService.checkPayment(payment.qpayInvoiceId);
    const result = await this.reconcilePaymentIdempotent(
      payment.invoiceCode,
      qpayCheck,
      ReconcileSource.POLLING,
    );

    return result.payment;
  }

  async handleWebhook(
    invoiceCode: string,
    rawPayload?: any,
  ): Promise<ReconcileResult> {
    const payment = await this.getPaymentByInvoiceCode(invoiceCode);

    if (!payment) {
      this.logger.warn(`Webhook: Unknown invoice: ${invoiceCode}`);
      return {
        payment: null as any,
        action: 'skipped',
        reason: 'Unknown invoice',
      };
    }

    if (payment.status !== PaymentStatus.PENDING) {
      this.logger.log(`Webhook: Already processed invoice: ${invoiceCode}`);
      return {
        payment,
        action: 'already_paid',
        reason: 'Payment already processed',
      };
    }

    if (!payment.qpayInvoiceId) {
      return {
        payment,
        action: 'skipped',
        reason: 'No QPay invoice ID',
      };
    }

    const qpayCheck = await this.qpayService.checkPayment(payment.qpayInvoiceId);

    const result = await this.reconcilePaymentIdempotent(
      invoiceCode,
      qpayCheck,
      ReconcileSource.WEBHOOK,
      rawPayload,
    );

    if (result.action === 'created' || result.action === 'updated') {
      this.logger.log(`Webhook: Payment processed for invoice: ${invoiceCode}`);
    }

    return result;
  }

  async reconcilePaymentIdempotent(
    invoiceCode: string,
    qpayCheck: QPayPaymentCheckResponse,
    source: ReconcileSource,
    rawPayload?: any,
    retryCount = 0,
  ): Promise<ReconcileResult> {
    const MAX_RETRIES = 3;

    try {
      return await this.executeReconciliation(invoiceCode, qpayCheck, source, rawPayload);
    } catch (error) {
      if (this.isRetryableError(error) && retryCount < MAX_RETRIES) {
        const backoffMs = 50 * Math.pow(2, retryCount) + Math.random() * 50;
        this.logger.warn(
          `Reconciliation conflict for ${invoiceCode}, retrying in ${Math.round(backoffMs)}ms (attempt ${retryCount + 1})`,
        );
        await this.sleep(backoffMs);
        return this.reconcilePaymentIdempotent(
          invoiceCode,
          qpayCheck,
          source,
          rawPayload,
          retryCount + 1,
        );
      }

      const payment = await this.prisma.payment.findUnique({
        where: { invoiceCode },
      });

      if (payment?.status === PaymentStatus.PAID) {
        return {
          payment,
          action: 'already_paid',
          reason: 'Completed by concurrent transaction',
        };
      }

      throw error;
    }
  }

  private async executeReconciliation(
    invoiceCode: string,
    qpayCheck: QPayPaymentCheckResponse,
    source: ReconcileSource,
    rawPayload?: any,
  ): Promise<ReconcileResult> {
    return await this.prisma.$transaction(
      async (tx) => {
        const [payment] = await tx.$queryRaw<Payment[]>`
          SELECT * FROM payments
          WHERE "invoiceCode" = ${invoiceCode}
          FOR UPDATE
        `;

        if (!payment) {
          throw new NotFoundException(`Payment not found: ${invoiceCode}`);
        }

        if (payment.status === PaymentStatus.PAID) {
          return {
            payment,
            action: 'already_paid' as const,
            reason: 'Payment already completed',
          };
        }

        const paidRow = qpayCheck.rows?.find((r) => r.payment_status === 'PAID');
        const isPaid = qpayCheck.count > 0 &&
                       qpayCheck.paid_amount >= payment.amount &&
                       paidRow;

        if (isPaid && paidRow) {
          const updatedPayment = await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.PAID,
              qpayPaymentId: paidRow.payment_id,
              qpayRawPayload: rawPayload || qpayCheck,
              paidAt: new Date(),
              reconcileSource: source,
              lastReconcileAt: new Date(),
              reconcileAttempts: payment.reconcileAttempts + 1,
            },
          });

          await this.createEntitlement(tx, payment);

          this.logger.log(
            `Payment ${payment.id} marked as PAID via ${source} (QPay ID: ${paidRow.payment_id})`,
          );

          this.sendPaymentConfirmationEmail(payment).catch((e) =>
            this.logger.error('Failed to send confirmation email:', e),
          );

          return {
            payment: updatedPayment,
            action: 'created' as const,
          };
        } else {
          const attempts = payment.reconcileAttempts + 1;
          const nextReconcileAt = this.calculateNextReconcileTime(attempts);

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              reconcileAttempts: attempts,
              lastReconcileAt: new Date(),
              nextReconcileAt,
              qpayRawPayload: rawPayload || qpayCheck,
            },
          });

          return {
            payment: { ...payment, reconcileAttempts: attempts },
            action: 'updated' as const,
            reason: 'Payment not yet confirmed',
          };
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
      },
    );
  }

  private calculateNextReconcileTime(attempts: number): Date | null {
    if (attempts >= MAX_RECONCILE_ATTEMPTS) {
      return null;
    }

    const backoffIndex = Math.min(attempts, BACKOFF_SCHEDULE_MINUTES.length - 1);
    const delayMinutes = BACKOFF_SCHEDULE_MINUTES[backoffIndex];
    const nextTime = new Date();
    nextTime.setMinutes(nextTime.getMinutes() + delayMinutes);
    return nextTime;
  }

  private isRetryableError(error: any): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code === 'P2034';
    }

    const message = error?.message?.toLowerCase() || '';
    return (
      message.includes('deadlock') ||
      message.includes('lock wait timeout') ||
      message.includes('could not serialize')
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getPaymentsForReconciliation(): Promise<Payment[]> {
    const now = new Date();

    return this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        reconcileAttempts: { lt: MAX_RECONCILE_ATTEMPTS },
        OR: [
          { nextReconcileAt: null },
          { nextReconcileAt: { lte: now } },
        ],
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async expireOldPayments(): Promise<void> {
    await this.prisma.payment.updateMany({
      where: {
        status: PaymentStatus.PENDING,
        createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
      },
      data: {
        status: PaymentStatus.EXPIRED,
      },
    });
  }

  async getPaymentLogs(params: {
    skip?: number;
    take?: number;
    startDate?: Date;
    endDate?: Date;
    status?: PaymentStatus;
    paymentMethod?: PaymentMethod;
    search?: string;
  }) {
    const { skip = 0, take = 20, startDate, endDate, status, paymentMethod, search } = params;

    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    if (status) {
      where.status = status;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (search) {
      where.OR = [
        { invoiceCode: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          subscriptionPlan: { select: { id: true, name: true } },
          movie: { select: { id: true, title: true } },
          bankAccount: { select: { id: true, bankName: true, accountNumber: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { payments, total };
  }

  // ============ Bank Transfer Methods ============

  async notifyBankTransferPaid(paymentId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true, subscriptionPlan: true, movie: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
      throw new BadRequestException('This is not a bank transfer payment');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment is not pending');
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { userNotifiedAt: new Date() },
      include: { user: true, subscriptionPlan: true, movie: true },
    });

    const adminEmail = await this.getAdminNotificationEmail();
    if (adminEmail) {
      const itemName = (payment as any).movie?.title || (payment as any).subscriptionPlan?.name || 'Subscription';
      this.emailService
        .sendBankTransferNotificationToAdmin(
          adminEmail,
          (payment as any).user.name,
          (payment as any).user.email || '',
          itemName,
          payment.amount,
          payment.transferRef || '',
          payment.id,
        )
        .catch((e) => this.logger.error('Failed to send admin notification:', e));
    }

    this.logger.log(`User notified bank transfer for payment ${paymentId}`);
    return updatedPayment;
  }

  async confirmBankTransferPayment(paymentId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
      throw new BadRequestException('This is not a bank transfer payment');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment is not pending');
    }

    return await this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          reconcileSource: ReconcileSource.MANUAL,
        },
        include: { user: true, subscriptionPlan: true },
      });

      await this.createEntitlement(tx, payment);

      this.logger.log(`Bank transfer payment ${paymentId} confirmed manually`);

      this.sendPaymentConfirmationEmail(payment).catch((e) =>
        this.logger.error('Failed to send confirmation email:', e),
      );

      return updatedPayment;
    });
  }

  async rejectBankTransferPayment(
    paymentId: string,
    reason?: string,
  ): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
      throw new BadRequestException('This is not a bank transfer payment');
    }

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment is not pending');
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.FAILED,
        qpayRawPayload: reason ? { rejectionReason: reason } : undefined,
      },
    });

    this.logger.log(`Bank transfer payment ${paymentId} rejected: ${reason || 'No reason'}`);
    return updatedPayment;
  }

  async getBankAccounts() {
    return this.prisma.bankAccount.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ============ Helper Methods ============

  private async createEntitlement(tx: any, payment: Payment): Promise<void> {
    if (payment.movieId) {
      // Movie purchase entitlement
      try {
        await tx.moviePurchase.create({
          data: {
            userId: payment.userId,
            movieId: payment.movieId,
            paymentId: payment.id,
          },
        });
        this.logger.log(
          `Movie purchase created for user ${payment.userId}, movie ${payment.movieId}`,
        );
      } catch (error: any) {
        // Catch unique constraint violation for idempotency
        if (error?.code === 'P2002') {
          this.logger.log(
            `Movie purchase already exists for user ${payment.userId}, movie ${payment.movieId}`,
          );
          return;
        }
        throw error;
      }
    } else if (payment.subscriptionPlanId) {
      // Subscription entitlement
      const plan = await tx.subscriptionPlan.findUnique({
        where: { id: payment.subscriptionPlanId },
      });

      if (!plan) {
        throw new Error(`Subscription plan not found: ${payment.subscriptionPlanId}`);
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + plan.durationDays);

      await tx.subscription.create({
        data: {
          userId: payment.userId,
          planId: payment.subscriptionPlanId,
          startDate,
          endDate,
          status: SubscriptionStatus.ACTIVE,
        },
      });

      this.logger.log(
        `Subscription created for user ${payment.userId}, plan ${plan.name}, expires ${endDate}`,
      );
    }
  }

  private async sendPaymentConfirmationEmail(payment: Payment): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: payment.userId },
    });

    if (!user?.email) return;

    if (payment.movieId) {
      const movie = await this.prisma.movie.findUnique({
        where: { id: payment.movieId },
      });

      if (movie) {
        await this.emailService.sendMoviePurchaseConfirmation(
          user.email,
          user.name,
          movie.title,
          payment.amount,
        );
      }
    } else if (payment.subscriptionPlanId) {
      const plan = await this.prisma.subscriptionPlan.findUnique({
        where: { id: payment.subscriptionPlanId },
      });

      if (plan) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.durationDays);

        await this.emailService.sendSubscriptionConfirmation(
          user.email,
          user.name,
          plan.name,
          payment.amount,
          endDate,
        );
      }
    }
  }

  private async getAdminNotificationEmail(): Promise<string | null> {
    const setting = await this.prisma.adminSettings.findUnique({
      where: { key: 'notification_email' },
    });
    return setting?.value || null;
  }
}
