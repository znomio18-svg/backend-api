import { SubscriptionsService } from './subscriptions.service';
export declare class SubscriptionScheduler {
    private subscriptionsService;
    private readonly logger;
    constructor(subscriptionsService: SubscriptionsService);
    handleSubscriptionExpiration(): Promise<void>;
}
