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
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../config/prisma.service");
const email_service_1 = require("../../config/email.service");
const qpay_service_1 = require("./qpay.service");
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const BACKOFF_SCHEDULE_MINUTES = [0, 1, 5, 15, 60];
const MAX_RECONCILE_ATTEMPTS = 5;
let PaymentsService = PaymentsService_1 = class PaymentsService {
    constructor(prisma, qpayService, configService, emailService) {
        this.prisma = prisma;
        this.qpayService = qpayService;
        this.configService = configService;
        this.emailService = emailService;
        this.logger = new common_1.Logger(PaymentsService_1.name);
    }
    async createPayment(userId, options) {
        const { subscriptionPlanId, movieId, paymentMethod = client_1.PaymentMethod.QPAY, bankAccountId } = options;
        if (subscriptionPlanId && movieId) {
            throw new common_1.BadRequestException('Provide either subscriptionPlanId or movieId, not both');
        }
        if (!subscriptionPlanId && !movieId) {
            throw new common_1.BadRequestException('Either subscriptionPlanId or movieId is required');
        }
        if (movieId) {
            return this.createMoviePayment(userId, movieId, paymentMethod, bankAccountId);
        }
        return this.createSubscriptionPayment(userId, subscriptionPlanId, paymentMethod, bankAccountId);
    }
    async createSubscriptionPayment(userId, subscriptionPlanId, paymentMethod, bankAccountId) {
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { id: subscriptionPlanId },
        });
        if (!plan) {
            throw new common_1.NotFoundException('Subscription plan not found');
        }
        if (!plan.isActive) {
            throw new common_1.BadRequestException('Subscription plan is not available');
        }
        const existingSubscription = await this.prisma.subscription.findFirst({
            where: {
                userId,
                status: client_1.SubscriptionStatus.ACTIVE,
                endDate: { gt: new Date() },
            },
        });
        if (existingSubscription) {
            throw new common_1.BadRequestException('You already have an active subscription');
        }
        const pendingPayment = await this.prisma.payment.findFirst({
            where: {
                userId,
                subscriptionPlanId,
                paymentMethod,
                status: client_1.PaymentStatus.PENDING,
                createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) },
            },
            include: { subscriptionPlan: true, bankAccount: true },
        });
        if (pendingPayment) {
            return pendingPayment;
        }
        const invoiceCode = `INV-${(0, uuid_1.v4)().slice(0, 8).toUpperCase()}`;
        const amount = plan.price;
        const description = `${plan.name} - Эрх худалдан авалт`;
        if (paymentMethod === client_1.PaymentMethod.BANK_TRANSFER) {
            if (bankAccountId) {
                const bankAccount = await this.prisma.bankAccount.findUnique({
                    where: { id: bankAccountId },
                });
                if (!bankAccount || !bankAccount.isActive) {
                    throw new common_1.BadRequestException('Invalid or inactive bank account');
                }
            }
            const transferRef = this.generateTransferReference();
            return this.prisma.payment.create({
                data: {
                    userId,
                    subscriptionPlanId,
                    amount,
                    invoiceCode,
                    paymentMethod: client_1.PaymentMethod.BANK_TRANSFER,
                    bankAccountId,
                    transferRef,
                },
                include: { subscriptionPlan: true, bankAccount: true },
            });
        }
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
                paymentMethod: client_1.PaymentMethod.QPAY,
                qpayInvoiceId: qpayInvoice.invoice_id,
                qpayQrCode: qpayInvoice.qr_text,
                qpayQrImage: qpayInvoice.qr_image,
                qpayDeeplinks: qpayInvoice.urls,
            },
            include: { subscriptionPlan: true },
        });
    }
    async createMoviePayment(userId, movieId, paymentMethod, bankAccountId) {
        const movie = await this.prisma.movie.findUnique({
            where: { id: movieId },
        });
        if (!movie) {
            throw new common_1.NotFoundException('Movie not found');
        }
        if (!movie.isPublished) {
            throw new common_1.BadRequestException('Movie is not available');
        }
        if (!movie.price || movie.price <= 0) {
            throw new common_1.BadRequestException('This movie is not available for individual purchase');
        }
        const existingPurchase = await this.prisma.moviePurchase.findUnique({
            where: {
                userId_movieId: { userId, movieId },
            },
        });
        if (existingPurchase) {
            throw new common_1.BadRequestException('You have already purchased this movie');
        }
        const pendingPayment = await this.prisma.payment.findFirst({
            where: {
                userId,
                movieId,
                paymentMethod,
                status: client_1.PaymentStatus.PENDING,
                createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) },
            },
            include: { movie: true, bankAccount: true },
        });
        if (pendingPayment) {
            return pendingPayment;
        }
        const invoiceCode = `INV-${(0, uuid_1.v4)().slice(0, 8).toUpperCase()}`;
        const amount = movie.price;
        const description = `${movie.title} - Кино худалдан авалт`;
        if (paymentMethod === client_1.PaymentMethod.BANK_TRANSFER) {
            if (bankAccountId) {
                const bankAccount = await this.prisma.bankAccount.findUnique({
                    where: { id: bankAccountId },
                });
                if (!bankAccount || !bankAccount.isActive) {
                    throw new common_1.BadRequestException('Invalid or inactive bank account');
                }
            }
            const transferRef = this.generateTransferReference();
            return this.prisma.payment.create({
                data: {
                    userId,
                    movieId,
                    amount,
                    invoiceCode,
                    paymentMethod: client_1.PaymentMethod.BANK_TRANSFER,
                    bankAccountId,
                    transferRef,
                },
                include: { movie: true, bankAccount: true },
            });
        }
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
                paymentMethod: client_1.PaymentMethod.QPAY,
                qpayInvoiceId: qpayInvoice.invoice_id,
                qpayQrCode: qpayInvoice.qr_text,
                qpayQrImage: qpayInvoice.qr_image,
                qpayDeeplinks: qpayInvoice.urls,
            },
            include: { movie: true },
        });
    }
    generateTransferReference() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `SK${timestamp}${random}`;
    }
    async getPayment(paymentId) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
            include: { subscriptionPlan: true, movie: true },
        });
        if (!payment) {
            throw new common_1.NotFoundException('Payment not found');
        }
        return payment;
    }
    async getPaymentByInvoiceCode(invoiceCode) {
        return this.prisma.payment.findUnique({
            where: { invoiceCode },
            include: { subscriptionPlan: true, movie: true, user: true },
        });
    }
    async checkAndProcessPayment(paymentId) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
        });
        if (!payment || !payment.qpayInvoiceId) {
            throw new common_1.NotFoundException('Payment not found');
        }
        if (payment.status !== client_1.PaymentStatus.PENDING) {
            return payment;
        }
        const qpayCheck = await this.qpayService.checkPayment(payment.qpayInvoiceId);
        const result = await this.reconcilePaymentIdempotent(payment.invoiceCode, qpayCheck, client_1.ReconcileSource.POLLING);
        return result.payment;
    }
    async handleWebhook(invoiceCode, rawPayload) {
        const payment = await this.getPaymentByInvoiceCode(invoiceCode);
        if (!payment) {
            this.logger.warn(`Webhook: Unknown invoice: ${invoiceCode}`);
            return {
                payment: null,
                action: 'skipped',
                reason: 'Unknown invoice',
            };
        }
        if (payment.status !== client_1.PaymentStatus.PENDING) {
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
        const result = await this.reconcilePaymentIdempotent(invoiceCode, qpayCheck, client_1.ReconcileSource.WEBHOOK, rawPayload);
        if (result.action === 'created' || result.action === 'updated') {
            this.logger.log(`Webhook: Payment processed for invoice: ${invoiceCode}`);
        }
        return result;
    }
    async reconcilePaymentIdempotent(invoiceCode, qpayCheck, source, rawPayload, retryCount = 0) {
        const MAX_RETRIES = 3;
        try {
            return await this.executeReconciliation(invoiceCode, qpayCheck, source, rawPayload);
        }
        catch (error) {
            if (this.isRetryableError(error) && retryCount < MAX_RETRIES) {
                const backoffMs = 50 * Math.pow(2, retryCount) + Math.random() * 50;
                this.logger.warn(`Reconciliation conflict for ${invoiceCode}, retrying in ${Math.round(backoffMs)}ms (attempt ${retryCount + 1})`);
                await this.sleep(backoffMs);
                return this.reconcilePaymentIdempotent(invoiceCode, qpayCheck, source, rawPayload, retryCount + 1);
            }
            const payment = await this.prisma.payment.findUnique({
                where: { invoiceCode },
            });
            if (payment?.status === client_1.PaymentStatus.PAID) {
                return {
                    payment,
                    action: 'already_paid',
                    reason: 'Completed by concurrent transaction',
                };
            }
            throw error;
        }
    }
    async executeReconciliation(invoiceCode, qpayCheck, source, rawPayload) {
        return await this.prisma.$transaction(async (tx) => {
            const [payment] = await tx.$queryRaw `
          SELECT * FROM payments
          WHERE "invoiceCode" = ${invoiceCode}
          FOR UPDATE
        `;
            if (!payment) {
                throw new common_1.NotFoundException(`Payment not found: ${invoiceCode}`);
            }
            if (payment.status === client_1.PaymentStatus.PAID) {
                return {
                    payment,
                    action: 'already_paid',
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
                        status: client_1.PaymentStatus.PAID,
                        qpayPaymentId: paidRow.payment_id,
                        qpayRawPayload: rawPayload || qpayCheck,
                        paidAt: new Date(),
                        reconcileSource: source,
                        lastReconcileAt: new Date(),
                        reconcileAttempts: payment.reconcileAttempts + 1,
                    },
                });
                await this.createEntitlement(tx, payment);
                this.logger.log(`Payment ${payment.id} marked as PAID via ${source} (QPay ID: ${paidRow.payment_id})`);
                this.sendPaymentConfirmationEmail(payment).catch((e) => this.logger.error('Failed to send confirmation email:', e));
                return {
                    payment: updatedPayment,
                    action: 'created',
                };
            }
            else {
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
                    action: 'updated',
                    reason: 'Payment not yet confirmed',
                };
            }
        }, {
            isolationLevel: client_1.Prisma.TransactionIsolationLevel.ReadCommitted,
            timeout: 15000,
        });
    }
    calculateNextReconcileTime(attempts) {
        if (attempts >= MAX_RECONCILE_ATTEMPTS) {
            return null;
        }
        const backoffIndex = Math.min(attempts, BACKOFF_SCHEDULE_MINUTES.length - 1);
        const delayMinutes = BACKOFF_SCHEDULE_MINUTES[backoffIndex];
        const nextTime = new Date();
        nextTime.setMinutes(nextTime.getMinutes() + delayMinutes);
        return nextTime;
    }
    isRetryableError(error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            return error.code === 'P2034';
        }
        const message = error?.message?.toLowerCase() || '';
        return (message.includes('deadlock') ||
            message.includes('lock wait timeout') ||
            message.includes('could not serialize'));
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async getPaymentsForReconciliation() {
        const now = new Date();
        return this.prisma.payment.findMany({
            where: {
                status: client_1.PaymentStatus.PENDING,
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
    async expireOldPayments() {
        await this.prisma.payment.updateMany({
            where: {
                status: client_1.PaymentStatus.PENDING,
                createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
            },
            data: {
                status: client_1.PaymentStatus.EXPIRED,
            },
        });
    }
    async getPaymentLogs(params) {
        const { skip = 0, take = 20, startDate, endDate, status, paymentMethod, search } = params;
        const where = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = startDate;
            if (endDate)
                where.createdAt.lte = endDate;
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
    async notifyBankTransferPaid(paymentId) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
            include: { user: true, subscriptionPlan: true, movie: true },
        });
        if (!payment) {
            throw new common_1.NotFoundException('Payment not found');
        }
        if (payment.paymentMethod !== client_1.PaymentMethod.BANK_TRANSFER) {
            throw new common_1.BadRequestException('This is not a bank transfer payment');
        }
        if (payment.status !== client_1.PaymentStatus.PENDING) {
            throw new common_1.BadRequestException('Payment is not pending');
        }
        const updatedPayment = await this.prisma.payment.update({
            where: { id: paymentId },
            data: { userNotifiedAt: new Date() },
            include: { user: true, subscriptionPlan: true, movie: true },
        });
        const adminEmail = await this.getAdminNotificationEmail();
        if (adminEmail) {
            const itemName = payment.movie?.title || payment.subscriptionPlan?.name || 'Subscription';
            this.emailService
                .sendBankTransferNotificationToAdmin(adminEmail, payment.user.name, payment.user.email || '', itemName, payment.amount, payment.transferRef || '', payment.id)
                .catch((e) => this.logger.error('Failed to send admin notification:', e));
        }
        this.logger.log(`User notified bank transfer for payment ${paymentId}`);
        return updatedPayment;
    }
    async confirmBankTransferPayment(paymentId) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
            include: { user: true },
        });
        if (!payment) {
            throw new common_1.NotFoundException('Payment not found');
        }
        if (payment.paymentMethod !== client_1.PaymentMethod.BANK_TRANSFER) {
            throw new common_1.BadRequestException('This is not a bank transfer payment');
        }
        if (payment.status !== client_1.PaymentStatus.PENDING) {
            throw new common_1.BadRequestException('Payment is not pending');
        }
        return await this.prisma.$transaction(async (tx) => {
            const updatedPayment = await tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: client_1.PaymentStatus.PAID,
                    paidAt: new Date(),
                    reconcileSource: client_1.ReconcileSource.MANUAL,
                },
                include: { user: true, subscriptionPlan: true },
            });
            await this.createEntitlement(tx, payment);
            this.logger.log(`Bank transfer payment ${paymentId} confirmed manually`);
            this.sendPaymentConfirmationEmail(payment).catch((e) => this.logger.error('Failed to send confirmation email:', e));
            return updatedPayment;
        });
    }
    async rejectBankTransferPayment(paymentId, reason) {
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
        });
        if (!payment) {
            throw new common_1.NotFoundException('Payment not found');
        }
        if (payment.paymentMethod !== client_1.PaymentMethod.BANK_TRANSFER) {
            throw new common_1.BadRequestException('This is not a bank transfer payment');
        }
        if (payment.status !== client_1.PaymentStatus.PENDING) {
            throw new common_1.BadRequestException('Payment is not pending');
        }
        const updatedPayment = await this.prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: client_1.PaymentStatus.FAILED,
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
    async createEntitlement(tx, payment) {
        if (payment.movieId) {
            try {
                await tx.moviePurchase.create({
                    data: {
                        userId: payment.userId,
                        movieId: payment.movieId,
                        paymentId: payment.id,
                    },
                });
                this.logger.log(`Movie purchase created for user ${payment.userId}, movie ${payment.movieId}`);
            }
            catch (error) {
                if (error?.code === 'P2002') {
                    this.logger.log(`Movie purchase already exists for user ${payment.userId}, movie ${payment.movieId}`);
                    return;
                }
                throw error;
            }
        }
        else if (payment.subscriptionPlanId) {
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
                    status: client_1.SubscriptionStatus.ACTIVE,
                },
            });
            this.logger.log(`Subscription created for user ${payment.userId}, plan ${plan.name}, expires ${endDate}`);
        }
    }
    async sendPaymentConfirmationEmail(payment) {
        const user = await this.prisma.user.findUnique({
            where: { id: payment.userId },
        });
        if (!user?.email)
            return;
        if (payment.movieId) {
            const movie = await this.prisma.movie.findUnique({
                where: { id: payment.movieId },
            });
            if (movie) {
                await this.emailService.sendMoviePurchaseConfirmation(user.email, user.name, movie.title, payment.amount);
            }
        }
        else if (payment.subscriptionPlanId) {
            const plan = await this.prisma.subscriptionPlan.findUnique({
                where: { id: payment.subscriptionPlanId },
            });
            if (plan) {
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + plan.durationDays);
                await this.emailService.sendSubscriptionConfirmation(user.email, user.name, plan.name, payment.amount, endDate);
            }
        }
    }
    async getAdminNotificationEmail() {
        const setting = await this.prisma.adminSettings.findUnique({
            where: { key: 'notification_email' },
        });
        return setting?.value || null;
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        qpay_service_1.QpayService,
        config_1.ConfigService,
        email_service_1.EmailService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map