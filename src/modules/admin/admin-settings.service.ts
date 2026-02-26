import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AdminSettings } from '@prisma/client';

export const SETTINGS_KEYS = {
  NOTIFICATION_EMAIL: 'notification_email',
  BANK_TRANSFER_INSTRUCTIONS: 'bank_transfer_instructions',
  SUPPORT_EMAIL: 'support_email',
  SUPPORT_PHONE: 'support_phone',
} as const;

@Injectable()
export class AdminSettingsService {
  constructor(private prisma: PrismaService) {}

  async get(key: string): Promise<string | null> {
    const setting = await this.prisma.adminSettings.findUnique({
      where: { key },
    });
    return setting?.value || null;
  }

  async set(
    key: string,
    value: string,
    description?: string,
  ): Promise<AdminSettings> {
    return this.prisma.adminSettings.upsert({
      where: { key },
      create: { key, value, description },
      update: { value, description },
    });
  }

  async getAll(): Promise<AdminSettings[]> {
    return this.prisma.adminSettings.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async delete(key: string): Promise<void> {
    await this.prisma.adminSettings.delete({
      where: { key },
    });
  }

  // ============ Convenience methods ============

  async getNotificationEmail(): Promise<string | null> {
    return this.get(SETTINGS_KEYS.NOTIFICATION_EMAIL);
  }

  async setNotificationEmail(email: string): Promise<AdminSettings> {
    return this.set(
      SETTINGS_KEYS.NOTIFICATION_EMAIL,
      email,
      'Email address for payment notifications',
    );
  }

  async getBankTransferInstructions(): Promise<string | null> {
    return this.get(SETTINGS_KEYS.BANK_TRANSFER_INSTRUCTIONS);
  }

  async setBankTransferInstructions(instructions: string): Promise<AdminSettings> {
    return this.set(
      SETTINGS_KEYS.BANK_TRANSFER_INSTRUCTIONS,
      instructions,
      'Instructions shown to users for bank transfers',
    );
  }
}
