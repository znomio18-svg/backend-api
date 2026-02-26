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
var QpayService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QpayService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
const crypto = require("crypto");
const prisma_service_1 = require("../../config/prisma.service");
const redis_service_1 = require("../../config/redis.service");
let QpayService = QpayService_1 = class QpayService {
    constructor(configService, prisma, redis) {
        this.configService = configService;
        this.prisma = prisma;
        this.redis = redis;
        this.logger = new common_1.Logger(QpayService_1.name);
        this.apiUrl =
            this.configService.get('QPAY_API_URL') ||
                'https://merchant.qpay.mn/v2';
        this.invoiceCode =
            this.configService.get('QPAY_INVOICE_CODE') || '';
        this.webhookSecret =
            this.configService.get('QPAY_WEBHOOK_SECRET') || '';
        this.client = axios_1.default.create({
            baseURL: this.apiUrl,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
    verifyWebhookSignature(payload, signature) {
        if (!this.webhookSecret) {
            this.logger.warn('QPAY_WEBHOOK_SECRET not configured - skipping signature verification');
            return true;
        }
        if (!signature) {
            this.logger.warn('No signature provided in webhook request');
            return false;
        }
        try {
            const expectedSignature = crypto
                .createHmac('sha256', this.webhookSecret)
                .update(payload)
                .digest('hex');
            const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
            if (!isValid) {
                this.logger.warn('Invalid webhook signature received');
            }
            return isValid;
        }
        catch (error) {
            this.logger.error(`Signature verification error: ${error instanceof Error ? error.message : 'Unknown'}`);
            return false;
        }
    }
    async getAccessToken() {
        const cachedToken = await this.redis.get('qpay:access_token');
        if (cachedToken) {
            return cachedToken;
        }
        const latestToken = await this.prisma.qPayToken.findFirst({
            orderBy: { createdAt: 'desc' },
        });
        if (latestToken && latestToken.expiresAt > new Date()) {
            await this.redis.set('qpay:access_token', latestToken.accessToken, Math.floor((latestToken.expiresAt.getTime() - Date.now()) / 1000));
            return latestToken.accessToken;
        }
        if (latestToken) {
            return this.refreshToken(latestToken.refreshToken);
        }
        return this.authenticate();
    }
    async authenticate(retryCount = 0) {
        const maxRetries = 5;
        const username = this.configService.get('QPAY_USERNAME');
        const password = this.configService.get('QPAY_PASSWORD');
        if (!username || !password) {
            this.logger.error('QPay credentials not configured. QPAY_USERNAME and QPAY_PASSWORD are required.');
            throw new Error('QPay credentials not configured');
        }
        this.logger.log(`Authenticating with QPay... (username: ${username.substring(0, 3)}***, url: ${this.apiUrl}/auth/token)`);
        try {
            const response = await this.client.post('/auth/token', {}, {
                auth: { username, password },
                timeout: 10000,
            });
            const { access_token, refresh_token, expires_in } = response.data;
            const expiresAt = new Date(Date.now() + expires_in * 1000);
            await this.prisma.qPayToken.create({
                data: {
                    accessToken: access_token,
                    refreshToken: refresh_token,
                    expiresAt,
                },
            });
            await this.redis.set('qpay:access_token', access_token, expires_in - 60);
            this.logger.log('QPay authentication successful');
            return access_token;
        }
        catch (error) {
            const isRetryable = this.isRetryableError(error);
            if (isRetryable && retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount + 1) * 1000;
                this.logger.warn(`QPay auth failed with retryable error, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
                await this.sleep(delay);
                return this.authenticate(retryCount + 1);
            }
            if (error.response) {
                this.logger.error(`QPay auth failed: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
            else {
                this.logger.error(`QPay auth failed: ${error.message}`);
            }
            throw new common_1.ServiceUnavailableException('Төлбөрийн систем түр ачааллтай байна. Түр хүлээгээд дахин оролдоно уу.');
        }
    }
    isRetryableError(error) {
        if (!error.response) {
            return true;
        }
        const status = error.response.status;
        const data = error.response.data;
        if (status >= 500) {
            return true;
        }
        if (status === 429) {
            return true;
        }
        if (data?.error === 'SYSTEM_BUSY') {
            return true;
        }
        return false;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async clearTokenCache() {
        await this.redis.del('qpay:access_token');
        await this.prisma.qPayToken.updateMany({
            where: { expiresAt: { gt: new Date() } },
            data: { expiresAt: new Date(0) },
        });
    }
    async refreshToken(refreshToken) {
        try {
            const response = await this.client.post('/auth/refresh', null, {
                headers: {
                    Authorization: `Bearer ${refreshToken}`,
                },
            });
            const { access_token, refresh_token, expires_in } = response.data;
            const expiresAt = new Date(Date.now() + expires_in * 1000);
            await this.prisma.qPayToken.create({
                data: {
                    accessToken: access_token,
                    refreshToken: refresh_token,
                    expiresAt,
                },
            });
            await this.redis.set('qpay:access_token', access_token, expires_in - 60);
            return access_token;
        }
        catch {
            this.logger.warn('Token refresh failed, re-authenticating...');
            return this.authenticate();
        }
    }
    async createInvoice(params, retryCount = 0) {
        const maxRetries = 5;
        const accessToken = await this.getAccessToken();
        try {
            const response = await this.client.post('/invoice', {
                invoice_code: this.invoiceCode,
                sender_invoice_no: params.invoiceCode,
                invoice_receiver_code: 'terminal',
                invoice_description: params.description,
                amount: params.amount,
                callback_url: params.callbackUrl,
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                timeout: 10000,
            });
            return response.data;
        }
        catch (error) {
            if (error.response?.status === 401 && retryCount < 2) {
                this.logger.warn('QPay token expired, clearing cache and re-authenticating...');
                await this.clearTokenCache();
                return this.createInvoice(params, retryCount + 1);
            }
            if (this.isRetryableError(error) && retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount + 1) * 1000;
                this.logger.warn(`QPay createInvoice failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
                await this.sleep(delay);
                return this.createInvoice(params, retryCount + 1);
            }
            const errorDetails = error.response
                ? `${error.response.status} - ${JSON.stringify(error.response.data)}`
                : error.message;
            this.logger.error(`QPay createInvoice failed after ${retryCount} retries: ${errorDetails}`);
            throw new common_1.ServiceUnavailableException('Төлбөрийн систем түр ачааллтай байна. Түр хүлээгээд дахин оролдоно уу.');
        }
    }
    async checkPayment(invoiceId, retryCount = 0) {
        const maxRetries = 5;
        const accessToken = await this.getAccessToken();
        try {
            const response = await this.client.post('/payment/check', {
                object_type: 'INVOICE',
                object_id: invoiceId,
                page_number: 1,
                page_limit: 100,
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                timeout: 10000,
            });
            return response.data;
        }
        catch (error) {
            if (error.response?.status === 401 && retryCount < 2) {
                this.logger.warn('QPay token expired, clearing cache and re-authenticating...');
                await this.clearTokenCache();
                return this.checkPayment(invoiceId, retryCount + 1);
            }
            if (this.isRetryableError(error) && retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount + 1) * 1000;
                this.logger.warn(`QPay checkPayment failed, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
                await this.sleep(delay);
                return this.checkPayment(invoiceId, retryCount + 1);
            }
            const errorDetails = error.response
                ? `${error.response.status} - ${JSON.stringify(error.response.data)}`
                : error.message;
            this.logger.error(`QPay checkPayment failed after ${retryCount} retries: ${errorDetails}`);
            throw new common_1.ServiceUnavailableException('Төлбөрийн систем түр ачааллтай байна. Түр хүлээгээд дахин оролдоно уу.');
        }
    }
    async cancelInvoice(invoiceId) {
        const accessToken = await this.getAccessToken();
        await this.client.delete(`/invoice/${invoiceId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
    }
};
exports.QpayService = QpayService;
exports.QpayService = QpayService = QpayService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], QpayService);
//# sourceMappingURL=qpay.service.js.map