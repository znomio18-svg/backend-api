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
var PaymentScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const payments_service_1 = require("./payments.service");
const qpay_service_1 = require("./qpay.service");
const redis_service_1 = require("../../config/redis.service");
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const RECONCILE_LOCK_KEY = 'payment:reconcile:lock';
const RECONCILE_LOCK_TTL = 55;
const EXPIRE_LOCK_KEY = 'payment:expire:lock';
const EXPIRE_LOCK_TTL = 3500;
const RATE_LIMIT_DELAY_MS = 200;
let PaymentScheduler = PaymentScheduler_1 = class PaymentScheduler {
    constructor(paymentsService, qpayService, redis) {
        this.paymentsService = paymentsService;
        this.qpayService = qpayService;
        this.redis = redis;
        this.logger = new common_1.Logger(PaymentScheduler_1.name);
        this.instanceId = (0, uuid_1.v4)();
    }
    async checkPendingPayments() {
        if (process.env.WORKER !== 'true')
            return;
        const lockValue = `${this.instanceId}:${Date.now()}`;
        const lockAcquired = await this.acquireLock(RECONCILE_LOCK_KEY, lockValue, RECONCILE_LOCK_TTL);
        if (!lockAcquired) {
            this.logger.debug('Another instance is handling payment reconciliation');
            return;
        }
        this.logger.log('Starting scheduled payment reconciliation...');
        const stats = {
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
                    const result = await this.paymentsService.reconcilePaymentIdempotent(payment.invoiceCode, qpayCheck, client_1.ReconcileSource.CRON);
                    switch (result.action) {
                        case 'created':
                            stats.reconciled++;
                            this.logger.log(`Payment ${payment.id} marked as PAID (cron reconciliation)`);
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
                }
                catch (error) {
                    stats.errors++;
                    this.logger.error(`Error reconciling payment ${payment.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            this.logReconcileSummary(stats);
            if (stats.errors > 5 || (stats.total > 0 && stats.errors / stats.total > 0.5)) {
                this.logger.warn(`High error rate in payment reconciliation: ${stats.errors}/${stats.total} failed`);
            }
        }
        catch (error) {
            this.logger.error(`Scheduled payment reconciliation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            await this.releaseLock(RECONCILE_LOCK_KEY, lockValue);
        }
    }
    async expireOldPayments() {
        if (process.env.WORKER !== 'true')
            return;
        const lockValue = `${this.instanceId}:${Date.now()}`;
        const lockAcquired = await this.acquireLock(EXPIRE_LOCK_KEY, lockValue, EXPIRE_LOCK_TTL);
        if (!lockAcquired)
            return;
        this.logger.log('Starting scheduled expiration of old payments...');
        try {
            await this.paymentsService.expireOldPayments();
            this.logger.log('Old payments expired successfully');
        }
        catch (error) {
            this.logger.error(`Payment expiration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            await this.releaseLock(EXPIRE_LOCK_KEY, lockValue);
        }
    }
    async acquireLock(key, value, ttl) {
        try {
            const result = await this.redis.getClient().set(key, value, 'EX', ttl, 'NX');
            return result === 'OK';
        }
        catch (error) {
            this.logger.error(`Failed to acquire lock ${key}: ${error}`);
            return false;
        }
    }
    async verifyLockOwnership(key, expectedValue) {
        try {
            const currentValue = await this.redis.getClient().get(key);
            return currentValue === expectedValue;
        }
        catch {
            return false;
        }
    }
    async releaseLock(key, value) {
        try {
            const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
            await this.redis.getClient().eval(script, 1, key, value);
        }
        catch (error) {
            this.logger.error(`Failed to release lock ${key}: ${error}`);
        }
    }
    logReconcileSummary(stats) {
        this.logger.log(`Reconciliation complete: ${stats.reconciled} paid, ${stats.notPaid} pending, ` +
            `${stats.alreadyPaid} already paid, ${stats.errors} errors, ${stats.skipped} skipped ` +
            `(total: ${stats.total})`);
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.PaymentScheduler = PaymentScheduler;
__decorate([
    (0, schedule_1.Cron)('0 * * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PaymentScheduler.prototype, "checkPendingPayments", null);
__decorate([
    (0, schedule_1.Cron)('0 0 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PaymentScheduler.prototype, "expireOldPayments", null);
exports.PaymentScheduler = PaymentScheduler = PaymentScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService,
        qpay_service_1.QpayService,
        redis_service_1.RedisService])
], PaymentScheduler);
//# sourceMappingURL=payment.scheduler.js.map