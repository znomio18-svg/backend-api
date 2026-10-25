import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

export interface SendNotificationDto {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly expo = new Expo();

  constructor(private readonly prisma: PrismaService) {}

  async sendToAll(dto: SendNotificationDto): Promise<{ sent: number; failed: number }> {
    const devices = await this.prisma.pushDevice.findMany({
      select: { expoPushToken: true },
    });

    if (devices.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const tokens = devices
      .map((d) => d.expoPushToken)
      .filter((token) => Expo.isExpoPushToken(token));

    return this.sendToTokens(tokens, dto);
  }

  /**
   * Push to the devices of specific users. `targetedUsers` = how many of the
   * given users have at least one valid push device.
   */
  async sendToUsers(
    userIds: string[],
    dto: SendNotificationDto,
  ): Promise<{ sent: number; failed: number; targetedUsers: number }> {
    const devices = await this.prisma.pushDevice.findMany({
      where: { userId: { in: [...new Set(userIds)] } },
      select: { expoPushToken: true, userId: true },
    });

    const valid = devices.filter((d) => Expo.isExpoPushToken(d.expoPushToken));
    const targetedUsers = new Set(valid.map((d) => d.userId)).size;
    if (valid.length === 0) {
      return { sent: 0, failed: 0, targetedUsers: 0 };
    }

    const result = await this.sendToTokens(
      valid.map((d) => d.expoPushToken),
      dto,
    );
    return { ...result, targetedUsers };
  }

  async getDeviceCount(): Promise<number> {
    return this.prisma.pushDevice.count();
  }

  private async sendToTokens(
    tokens: string[],
    dto: SendNotificationDto,
  ): Promise<{ sent: number; failed: number }> {
    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token,
      sound: 'default' as const,
      title: dto.title,
      body: dto.body,
      data: dto.data,
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    let sent = 0;
    let failed = 0;

    for (const chunk of chunks) {
      try {
        const tickets: ExpoPushTicket[] =
          await this.expo.sendPushNotificationsAsync(chunk);

        for (const ticket of tickets) {
          if (ticket.status === 'ok') {
            sent++;
          } else {
            failed++;
            this.logger.warn(`Push notification error: ${ticket.message}`);
          }
        }
      } catch (error) {
        failed += chunk.length;
        this.logger.error('Failed to send push notification chunk', error);
      }
    }

    this.logger.log(
      `Push notifications sent: ${sent} success, ${failed} failed out of ${tokens.length} tokens`,
    );

    return { sent, failed };
  }
}
