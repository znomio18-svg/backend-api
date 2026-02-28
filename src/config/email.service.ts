import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = this.configService.get('SMTP_HOST');
    const port = this.configService.get('SMTP_PORT');
    const user = this.configService.get('SMTP_USER');
    const pass = this.configService.get('SMTP_PASS');

    if (!host || !user || !pass) {
      this.logger.warn(
        'Email service not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS environment variables.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: port ? parseInt(port, 10) : 587,
      secure: port === '465',
      auth: { user, pass },
    });

    this.logger.log('Email service initialized');
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Email service not configured, skipping email send');
      return false;
    }

    try {
      const fromEmail = this.configService.get('SMTP_FROM_EMAIL', 'noreply@1MinDrama.mn');
      const fromName = this.configService.get('SMTP_FROM_NAME', '1MinDrama Movies');

      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}:`, error);
      return false;
    }
  }

  // ============ Email Templates ============

  async sendSubscriptionConfirmation(
    userEmail: string,
    userName: string,
    planName: string,
    amount: number,
    endDate: Date,
  ): Promise<boolean> {
    const formattedAmount = amount.toLocaleString('mn-MN');
    const formattedDate = endDate.toLocaleDateString('mn-MN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return this.sendEmail({
      to: userEmail,
      subject: `Эрх амжилттай идэвхжлээ - ${planName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #E91E63;">1MinDrama Movies</h2>
          <p>Сайн байна уу, ${userName}!</p>
          <p>Таны эрх амжилттай идэвхжлээ.</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Багц:</strong> ${planName}</p>
            <p><strong>Төлбөр:</strong> ₮${formattedAmount}</p>
            <p><strong>Дуусах хугацаа:</strong> ${formattedDate}</p>
          </div>
          <p>Та одоо бүх кино үзэх боломжтой боллоо!</p>
          <a href="${this.configService.get('FRONTEND_URL', 'https://1MinDrama.mn')}/movies"
             style="display: inline-block; background: #E91E63; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            Кино үзэх
          </a>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            1MinDrama Movies - Монголын шилдэг кино платформ
          </p>
        </div>
      `,
    });
  }

  async sendBankTransferNotificationToAdmin(
    adminEmail: string,
    userName: string,
    userEmail: string,
    itemName: string,
    amount: number,
    transferRef: string,
    paymentId: string,
  ): Promise<boolean> {
    const formattedAmount = amount.toLocaleString('mn-MN');

    return this.sendEmail({
      to: adminEmail,
      subject: `Шинэ банкны шилжүүлэг - ${transferRef}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #E91E63;">Шинэ төлбөрийн мэдэгдэл</h2>
          <p>Хэрэглэгч банкны шилжүүлэг хийснээ мэдэгдлээ.</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Хэрэглэгч:</strong> ${userName} (${userEmail})</p>
            <p><strong>Бараа:</strong> ${itemName}</p>
            <p><strong>Дүн:</strong> ₮${formattedAmount}</p>
            <p><strong>Гүйлгээний утга:</strong> ${transferRef}</p>
            <p><strong>Төлбөрийн ID:</strong> ${paymentId}</p>
          </div>
          <p>Банкны хуулгаас шалгаад төлбөрийг баталгаажуулна уу.</p>
          <a href="${this.configService.get('ADMIN_URL', 'https://admin.1MinDrama.mn')}/payments/${paymentId}"
             style="display: inline-block; background: #E91E63; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            Төлбөр шалгах
          </a>
        </div>
      `,
    });
  }

  async sendMoviePurchaseConfirmation(
    userEmail: string,
    userName: string,
    movieTitle: string,
    amount: number,
  ): Promise<boolean> {
    const formattedAmount = amount.toLocaleString('mn-MN');

    return this.sendEmail({
      to: userEmail,
      subject: `Кино амжилттай худалдан авлаа - ${movieTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #E91E63;">1MinDrama Movies</h2>
          <p>Сайн байна уу, ${userName}!</p>
          <p>Таны кино худалдан авалт амжилттай боллоо.</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Кино:</strong> ${movieTitle}</p>
            <p><strong>Төлбөр:</strong> ₮${formattedAmount}</p>
          </div>
          <p>Та одоо энэ киног хүссэн үедээ үзэх боломжтой боллоо!</p>
          <a href="${this.configService.get('FRONTEND_URL', 'https://1MinDrama.mn')}/movies"
             style="display: inline-block; background: #E91E63; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            Кино үзэх
          </a>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            1MinDrama Movies - Монголын шилдэг кино платформ
          </p>
        </div>
      `,
    });
  }

  async sendSubscriptionExpiryWarning(
    userEmail: string,
    userName: string,
    planName: string,
    daysRemaining: number,
  ): Promise<boolean> {
    return this.sendEmail({
      to: userEmail,
      subject: `Эрхийн хугацаа дуусах гэж байна - ${daysRemaining} өдөр үлдлээ`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #E91E63;">1MinDrama Movies</h2>
          <p>Сайн байна уу, ${userName}!</p>
          <p>Таны <strong>${planName}</strong> эрх ${daysRemaining} өдрийн дараа дуусах гэж байна.</p>
          <p>Эрхээ сунгаад тасралтгүй кино үзээрэй!</p>
          <a href="${this.configService.get('FRONTEND_URL', 'https://1MinDrama.mn')}/subscribe"
             style="display: inline-block; background: #E91E63; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            Эрх сунгах
          </a>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            1MinDrama Movies - Монголын шилдэг кино платформ
          </p>
        </div>
      `,
    });
  }
}
