import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment } from '@prisma/client';
import axios from 'axios';
import * as crypto from 'crypto';
import { PrismaService } from '../../config/prisma.service';

/**
 * Tells the Messenger chatbot the moment QPay confirms a payment, so the user
 * gets their watch link immediately instead of waiting for the chatbot's poll.
 *
 * Best effort only: the chatbot still polls, so a lost event just means the
 * link arrives a few seconds later. Signed with the shared internal API key.
 */
@Injectable()
export class ChatbotNotifierService {
  private readonly logger = new Logger(ChatbotNotifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async paymentPaid(payment: Payment): Promise<void> {
    const url = this.config.get<string>('CHATBOT_WEBHOOK_URL');
    const key = this.config.get<string>('CHATBOT_INTERNAL_API_KEY');
    if (!url || !key) return;
    // Logged-in website users buy through the chatbot too, so every payment
    // is announced; the chatbot ignores payment ids it did not create.

    const body = JSON.stringify({
      type: 'payment.paid',
      paymentId: payment.id,
      occurredAt: new Date().toISOString(),
    });
    const signature = crypto.createHmac('sha256', key).update(body).digest('hex');

    try {
      await axios.post(url, body, {
        headers: { 'content-type': 'application/json', 'x-platform-signature': `sha256=${signature}` },
        timeout: 5000,
      });
    } catch (error) {
      this.logger.warn(
        `Chatbot notification for payment ${payment.id} failed: ${(error as Error).message}`,
      );
    }
  }
}
