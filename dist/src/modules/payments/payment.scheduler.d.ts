import { PaymentsService } from './payments.service';
import { QpayService } from './qpay.service';
import { RedisService } from '../../config/redis.service';
export declare class PaymentScheduler {
    private paymentsService;
    private qpayService;
    private redis;
    private readonly logger;
    private readonly instanceId;
    constructor(paymentsService: PaymentsService, qpayService: QpayService, redis: RedisService);
    checkPendingPayments(): Promise<void>;
    expireOldPayments(): Promise<void>;
    private acquireLock;
    private verifyLockOwnership;
    private releaseLock;
    private logReconcileSummary;
    private sleep;
}
