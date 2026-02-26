import { ConfigService } from '@nestjs/config';
export interface EmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
}
export declare class EmailService {
    private configService;
    private readonly logger;
    private transporter;
    constructor(configService: ConfigService);
    private initializeTransporter;
    sendEmail(options: EmailOptions): Promise<boolean>;
    sendSubscriptionConfirmation(userEmail: string, userName: string, planName: string, amount: number, endDate: Date): Promise<boolean>;
    sendBankTransferNotificationToAdmin(adminEmail: string, userName: string, userEmail: string, itemName: string, amount: number, transferRef: string, paymentId: string): Promise<boolean>;
    sendSubscriptionExpiryWarning(userEmail: string, userName: string, planName: string, daysRemaining: number): Promise<boolean>;
}
