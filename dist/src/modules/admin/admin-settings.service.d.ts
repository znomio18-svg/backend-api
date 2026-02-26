import { PrismaService } from '../../config/prisma.service';
import { AdminSettings } from '@prisma/client';
export declare const SETTINGS_KEYS: {
    readonly NOTIFICATION_EMAIL: "notification_email";
    readonly BANK_TRANSFER_INSTRUCTIONS: "bank_transfer_instructions";
    readonly SUPPORT_EMAIL: "support_email";
    readonly SUPPORT_PHONE: "support_phone";
};
export declare class AdminSettingsService {
    private prisma;
    constructor(prisma: PrismaService);
    get(key: string): Promise<string | null>;
    set(key: string, value: string, description?: string): Promise<AdminSettings>;
    getAll(): Promise<AdminSettings[]>;
    delete(key: string): Promise<void>;
    getNotificationEmail(): Promise<string | null>;
    setNotificationEmail(email: string): Promise<AdminSettings>;
    getBankTransferInstructions(): Promise<string | null>;
    setBankTransferInstructions(instructions: string): Promise<AdminSettings>;
}
