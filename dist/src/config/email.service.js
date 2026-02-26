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
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer = require("nodemailer");
let EmailService = EmailService_1 = class EmailService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(EmailService_1.name);
        this.transporter = null;
        this.initializeTransporter();
    }
    initializeTransporter() {
        const host = this.configService.get('SMTP_HOST');
        const port = this.configService.get('SMTP_PORT');
        const user = this.configService.get('SMTP_USER');
        const pass = this.configService.get('SMTP_PASS');
        if (!host || !user || !pass) {
            this.logger.warn('Email service not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS environment variables.');
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
    async sendEmail(options) {
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
        }
        catch (error) {
            this.logger.error(`Failed to send email to ${options.to}:`, error);
            return false;
        }
    }
    async sendSubscriptionConfirmation(userEmail, userName, planName, amount, endDate) {
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
    async sendBankTransferNotificationToAdmin(adminEmail, userName, userEmail, itemName, amount, transferRef, paymentId) {
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
    async sendSubscriptionExpiryWarning(userEmail, userName, planName, daysRemaining) {
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
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EmailService);
//# sourceMappingURL=email.service.js.map