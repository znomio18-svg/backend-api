import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
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

@Injectable()
export class QpayService {
  private readonly logger = new Logger(QpayService.name);
  private client: AxiosInstance;
  private readonly apiUrl: string;
  private readonly invoiceCode: string;
  private readonly webhookSecret: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
    this.apiUrl =
      this.configService.get<string>('QPAY_API_URL') ||
      'https://merchant.qpay.mn/v2';
    this.invoiceCode =
      this.configService.get<string>('QPAY_INVOICE_CODE') || '';
    this.webhookSecret =
      this.configService.get<string>('QPAY_WEBHOOK_SECRET') || '';

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   * @param payload Raw request body as string
   * @param signature Signature from x-qpay-signature header
   * @returns true if signature is valid
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('QPAY_WEBHOOK_SECRET not configured - skipping signature verification');
      return true; // Allow if not configured (for backward compatibility)
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

      // Use timing-safe comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );

      if (!isValid) {
        this.logger.warn('Invalid webhook signature received');
      }

      return isValid;
    } catch (error) {
      this.logger.error(`Signature verification error: ${error instanceof Error ? error.message : 'Unknown'}`);
      return false;
    }
  }

  private async getAccessToken(): Promise<string> {
    const cachedToken = await this.redis.get('qpay:access_token');
    if (cachedToken) {
      return cachedToken;
    }

    const latestToken = await this.prisma.qPayToken.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (latestToken && latestToken.expiresAt > new Date()) {
      await this.redis.set(
        'qpay:access_token',
        latestToken.accessToken,
        Math.floor((latestToken.expiresAt.getTime() - Date.now()) / 1000),
      );
      return latestToken.accessToken;
    }

    if (latestToken) {
      return this.refreshToken(latestToken.refreshToken);
    }

    return this.authenticate();
  }

  private async authenticate(retryCount = 0): Promise<string> {
    const maxRetries = 5;
    const username = this.configService.get<string>('QPAY_USERNAME');
    const password = this.configService.get<string>('QPAY_PASSWORD');

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
    } catch (error) {
      const isRetryable = this.isRetryableError(error);

      if (isRetryable && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount + 1) * 1000; // 2s, 4s, 8s, 16s, 32s
        this.logger.warn(`QPay auth failed with retryable error, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await this.sleep(delay);
        return this.authenticate(retryCount + 1);
      }

      if (error.response) {
        this.logger.error(`QPay auth failed: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else {
        this.logger.error(`QPay auth failed: ${error.message}`);
      }

      // Throw user-friendly error
      throw new ServiceUnavailableException(
        'Төлбөрийн систем түр ачааллтай байна. Түр хүлээгээд дахин оролдоно уу.',
      );
    }
  }

  private isRetryableError(error: any): boolean {
    if (!error.response) {
      // Network errors are retryable
      return true;
    }
    const status = error.response.status;
    const data = error.response.data;

    // Retry on 500+ errors or specific QPay busy errors
    if (status >= 500) {
      return true;
    }
    // Retry on rate limiting
    if (status === 429) {
      return true;
    }
    // Check for SYSTEM_BUSY error
    if (data?.error === 'SYSTEM_BUSY') {
      return true;
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async clearTokenCache(): Promise<void> {
    await this.redis.del('qpay:access_token');
    // Also invalidate DB tokens by marking them as expired
    await this.prisma.qPayToken.updateMany({
      where: { expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date(0) },
    });
  }

  private async refreshToken(refreshToken: string): Promise<string> {
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
    } catch {
      this.logger.warn('Token refresh failed, re-authenticating...');
      return this.authenticate();
    }
  }

  async createInvoice(
    params: {
      invoiceCode: string;
      amount: number;
      description: string;
      callbackUrl: string;
    },
    retryCount = 0,
  ): Promise<QPayInvoiceResponse> {
    const maxRetries = 5;
    const accessToken = await this.getAccessToken();

    try {
      const response = await this.client.post<QPayInvoiceResponse>(
        '/invoice',
        {
          invoice_code: this.invoiceCode,
          sender_invoice_no: params.invoiceCode,
          invoice_receiver_code: 'terminal',
          invoice_description: params.description,
          amount: params.amount,
          callback_url: params.callbackUrl,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 10000,
        },
      );

      return response.data;
    } catch (error) {
      // Handle 401 - token expired, clear cache and re-authenticate
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
      throw new ServiceUnavailableException(
        'Төлбөрийн систем түр ачааллтай байна. Түр хүлээгээд дахин оролдоно уу.',
      );
    }
  }

  async checkPayment(invoiceId: string, retryCount = 0): Promise<QPayPaymentCheckResponse> {
    const maxRetries = 5;
    const accessToken = await this.getAccessToken();

    try {
      const response = await this.client.post<QPayPaymentCheckResponse>(
        '/payment/check',
        {
          object_type: 'INVOICE',
          object_id: invoiceId,
          page_number: 1,
          page_limit: 100,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 10000,
        },
      );

      return response.data;
    } catch (error) {
      // Handle 401 - token expired, clear cache and re-authenticate
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
      throw new ServiceUnavailableException(
        'Төлбөрийн систем түр ачааллтай байна. Түр хүлээгээд дахин оролдоно уу.',
      );
    }
  }

  async cancelInvoice(invoiceId: string): Promise<void> {
    const accessToken = await this.getAccessToken();

    await this.client.delete(`/invoice/${invoiceId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }
}
