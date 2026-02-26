import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { RedisService } from '../../config/redis.service';
export interface QPayInvoiceResponse {
    invoice_id: string;
    qr_text: string;
    qr_image: string;
    urls: Array<{
        name: string;
        description: string;
        logo: string;
        link: string;
    }>;
}
export interface QPayPaymentCheckResponse {
    count: number;
    paid_amount: number;
    rows: Array<{
        payment_id: string;
        payment_status: string;
        payment_amount: number;
        payment_currency: string;
        payment_wallet: string;
        transaction_type: string;
    }>;
}
export declare class QpayService {
    private configService;
    private prisma;
    private redis;
    private readonly logger;
    private client;
    private readonly apiUrl;
    private readonly invoiceCode;
    private readonly webhookSecret;
    constructor(configService: ConfigService, prisma: PrismaService, redis: RedisService);
    verifyWebhookSignature(payload: string, signature: string): boolean;
    private getAccessToken;
    private authenticate;
    private isRetryableError;
    private sleep;
    private clearTokenCache;
    private refreshToken;
    createInvoice(params: {
        invoiceCode: string;
        amount: number;
        description: string;
        callbackUrl: string;
    }, retryCount?: number): Promise<QPayInvoiceResponse>;
    checkPayment(invoiceId: string, retryCount?: number): Promise<QPayPaymentCheckResponse>;
    cancelInvoice(invoiceId: string): Promise<void>;
}
