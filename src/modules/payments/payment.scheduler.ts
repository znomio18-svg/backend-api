import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PaymentsService } from './payments.service';
import { QpayService } from './qpay.service';
import { RedisService } from '../../config/redis.service';
import { ReconcileSource } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const RECONCILE_LOCK_KEY = 'payment:reconcile:lock';
const RECONCILE_LOCK_TTL = 55; // 55 seconds (less than 1 minute interval)
const EXPIRE_LOCK_KEY = 'payment:expire:lock';
const EXPIRE_LOCK_TTL = 3500; // ~58 minutes (less than 1 hour interval)
const RATE_LIMIT_DELAY_MS = 200; // 200ms between QPay API calls

interface ReconcileStats {
  total: number;
  reconciled: number;
  notPaid: number;
  alreadyPaid: number;
  errors: number;
  skipped: number;
}

@Injectable()
export class PaymentScheduler {
  private readonly logger = new Logger(PaymentScheduler.name);
  private readonly instanceId = uuidv4();

  constructor(
    private paymentsService: PaymentsService,
    private qpayService: QpayService,
    private redis: RedisService,
  ) {}

  @Cron('0 * * * * *') // Every minute at :00 seconds
  async checkPendingPayments() {
    if (process.env.WORKER !== 'true') return;

    const lockValue = `${this.instanceId}:${Date.now()}`;
    const lockAcquired = await this.acquireLock(RECONCILE_LOCK_KEY, lockValue, RECONCILE_LOCK_TTL);
    if (!lockAcquired) {
      this.logger.debug('Another instance is handling payment reconciliation');
      return;
    }

    this.logger.log('Starting scheduled payment reconciliation...');
    const stats: ReconcileStats = {
      total: 0,
      reconciled: 0,
      notPaid: 0,
      alreadyPaid: 0,
      errors: 0,
      skipped: 0,
    };

    try {
      const pendingPayments = await this.paymentsService.getPaymentsForReconciliation();
      stats.total = pendingPayments.length;

      if (pendingPayments.length === 0) {
        this.logger.debug('No pending payments due for reconciliation');
        return;
      }

      this.logger.log(`Found ${pendingPayments.length} payments due for reconciliation`);

      for (const payment of pendingPayments) {
        // Verify we still own the lock before each payment
        if (!(await this.verifyLockOwnership(RECONCILE_LOCK_KEY, lockValue))) {
          this.logger.warn('Lost reconcile lock mid-run, stopping');
          break;
        }

        try {
          if (!payment.qpayInvoiceId) {
            stats.skipped++;
            continue;
          }

          await this.sleep(RATE_LIMIT_DELAY_MS);

          const qpayCheck = await this.qpayService.checkPayment(payment.qpayInvoiceId);

          const result = await this.paymentsService.reconcilePaymentIdempotent(
            payment.invoiceCode,
            qpayCheck,
            ReconcileSource.CRON,
          );

          switch (result.action) {
            case 'created':
              stats.reconciled++;
              this.logger.log(
                `Payment ${payment.id} marked as PAID (cron reconciliation)`,
              );
              break;
            case 'already_paid':
              stats.alreadyPaid++;
              break;
            case 'updated':
              stats.notPaid++;
              break;
            case 'skipped':
              stats.skipped++;
              break;
          }
        } catch (error) {
          stats.errors++;
          this.logger.error(
            `Error reconciling payment ${payment.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      this.logReconcileSummary(stats);

      if (stats.errors > 5 || (stats.total > 0 && stats.errors / stats.total > 0.5)) {
        this.logger.warn(
          `High error rate in payment reconciliation: ${stats.errors}/${stats.total} failed`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Scheduled payment reconciliation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      await this.releaseLock(RECONCILE_LOCK_KEY, lockValue);
    }
  }

  @Cron('0 0 * * * *') // Every hour at :00:00
  async expireOldPayments() {
    if (process.env.WORKER !== 'true') return;

    const lockValue = `${this.instanceId}:${Date.now()}`;
    const lockAcquired = await this.acquireLock(EXPIRE_LOCK_KEY, lockValue, EXPIRE_LOCK_TTL);
    if (!lockAcquired) return;

    this.logger.log('Starting scheduled expiration of old payments...');

    try {
      await this.paymentsService.expireOldPayments();
      this.logger.log('Old payments expired successfully');
    } catch (error) {
      this.logger.error(
        `Payment expiration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      await this.releaseLock(EXPIRE_LOCK_KEY, lockValue);
    }
  }

  private async acquireLock(key: string, value: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.redis.getClient().set(key, value, 'EX', ttl, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.error(`Failed to acquire lock ${key}: ${error}`);
      return false;
    }
  }

  private async verifyLockOwnership(key: string, expectedValue: string): Promise<boolean> {
    try {
      const currentValue = await this.redis.getClient().get(key);
      return currentValue === expectedValue;
    } catch {
      return false;
    }
  }

  private async releaseLock(key: string, value: string): Promise<void> {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await this.redis.getClient().eval(script, 1, key, value);
    } catch (error) {
      this.logger.error(`Failed to release lock ${key}: ${error}`);
    }
  }

  private logReconcileSummary(stats: ReconcileStats): void {
    this.logger.log(
      `Reconciliation complete: ${stats.reconciled} paid, ${stats.notPaid} pending, ` +
      `${stats.alreadyPaid} already paid, ${stats.errors} errors, ${stats.skipped} skipped ` +
      `(total: ${stats.total})`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
