import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { EmailService } from '../../config/email.service';
import { QpayService, QPayPaymentCheckResponse } from './qpay.service';
import { Payment, PaymentStatus, PaymentMethod, ReconcileSource, Prisma } from '@prisma/client';
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
export declare class PaymentsService {
    private prisma;
    private qpayService;
    private configService;
    private emailService;
    private readonly logger;
    constructor(prisma: PrismaService, qpayService: QpayService, configService: ConfigService, emailService: EmailService);
    createPayment(userId: string, options: CreatePaymentDto): Promise<Payment>;
    private createSubscriptionPayment;
    private createMoviePayment;
    private generateTransferReference;
    getPayment(paymentId: string): Promise<Payment>;
    getPaymentByInvoiceCode(invoiceCode: string): Promise<Payment | null>;
    checkAndProcessPayment(paymentId: string): Promise<Payment>;
    handleWebhook(invoiceCode: string, rawPayload?: any): Promise<ReconcileResult>;
    reconcilePaymentIdempotent(invoiceCode: string, qpayCheck: QPayPaymentCheckResponse, source: ReconcileSource, rawPayload?: any, retryCount?: number): Promise<ReconcileResult>;
    private executeReconciliation;
    private calculateNextReconcileTime;
    private isRetryableError;
    private sleep;
    getPaymentsForReconciliation(): Promise<Payment[]>;
    expireOldPayments(): Promise<void>;
    getPaymentLogs(params: {
        skip?: number;
        take?: number;
        startDate?: Date;
        endDate?: Date;
        status?: PaymentStatus;
        paymentMethod?: PaymentMethod;
        search?: string;
    }): Promise<{
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
            qpayDeeplinks: Prisma.JsonValue | null;
            qpayPaymentId: string | null;
            qpayRawPayload: Prisma.JsonValue | null;
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
    notifyBankTransferPaid(paymentId: string): Promise<Payment>;
    confirmBankTransferPayment(paymentId: string): Promise<Payment>;
    rejectBankTransferPayment(paymentId: string, reason?: string): Promise<Payment>;
    getBankAccounts(): Promise<{
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
    private createEntitlement;
    private sendPaymentConfirmationEmail;
    private getAdminNotificationEmail;
}
