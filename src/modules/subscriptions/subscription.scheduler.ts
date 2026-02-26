import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionsService } from './subscriptions.service';

@Injectable()
export class SubscriptionScheduler {
  private readonly logger = new Logger(SubscriptionScheduler.name);

  constructor(private subscriptionsService: SubscriptionsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleSubscriptionExpiration() {
    if (process.env.WORKER !== 'true') return;

    this.logger.debug('Running subscription expiration check...');

    try {
      const expiredCount =
        await this.subscriptionsService.expireSubscriptions();

      if (expiredCount > 0) {
        this.logger.log(`Expired ${expiredCount} subscriptions`);
      }
    } catch (error) {
      this.logger.error('Failed to expire subscriptions:', error);
    }
  }
}
