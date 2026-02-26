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
var SubscriptionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma.service");
const client_1 = require("@prisma/client");
let SubscriptionsService = SubscriptionsService_1 = class SubscriptionsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(SubscriptionsService_1.name);
    }
    async createPlan(data) {
        return this.prisma.subscriptionPlan.create({
            data,
        });
    }
    async updatePlan(id, data) {
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { id },
        });
        if (!plan) {
            throw new common_1.NotFoundException('Subscription plan not found');
        }
        return this.prisma.subscriptionPlan.update({
            where: { id },
            data,
        });
    }
    async deletePlan(id) {
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { id },
            include: { subscriptions: { where: { status: client_1.SubscriptionStatus.ACTIVE } } },
        });
        if (!plan) {
            throw new common_1.NotFoundException('Subscription plan not found');
        }
        if (plan.subscriptions.length > 0) {
            throw new common_1.BadRequestException('Cannot delete plan with active subscriptions');
        }
        await this.prisma.subscriptionPlan.delete({
            where: { id },
        });
    }
    async getPlans(includeInactive = false) {
        return this.prisma.subscriptionPlan.findMany({
            where: includeInactive ? {} : { isActive: true },
            orderBy: { durationDays: 'asc' },
        });
    }
    async getPlan(id) {
        const plan = await this.prisma.subscriptionPlan.findUnique({
            where: { id },
        });
        if (!plan) {
            throw new common_1.NotFoundException('Subscription plan not found');
        }
        return plan;
    }
    async createSubscription(userId, planId) {
        const plan = await this.getPlan(planId);
        if (!plan.isActive) {
            throw new common_1.BadRequestException('Subscription plan is not available');
        }
        const existingSubscription = await this.getActiveSubscription(userId);
        if (existingSubscription) {
            throw new common_1.BadRequestException('You already have an active subscription');
        }
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.durationDays);
        const subscription = await this.prisma.subscription.create({
            data: {
                userId,
                planId,
                startDate,
                endDate,
                status: client_1.SubscriptionStatus.ACTIVE,
            },
            include: { plan: true },
        });
        this.logger.log(`Subscription created for user ${userId}, plan ${plan.name}, expires ${endDate}`);
        return subscription;
    }
    async getActiveSubscription(userId) {
        return this.prisma.subscription.findFirst({
            where: {
                userId,
                status: client_1.SubscriptionStatus.ACTIVE,
                endDate: { gt: new Date() },
            },
            include: { plan: true },
            orderBy: { endDate: 'desc' },
        });
    }
    async hasActiveSubscription(userId) {
        const subscription = await this.getActiveSubscription(userId);
        return subscription !== null;
    }
    async getUserSubscriptions(userId) {
        return this.prisma.subscription.findMany({
            where: { userId },
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async cancelSubscription(userId) {
        const subscription = await this.getActiveSubscription(userId);
        if (!subscription) {
            throw new common_1.NotFoundException('No active subscription found');
        }
        return this.prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                status: client_1.SubscriptionStatus.CANCELLED,
                autoRenew: false,
            },
        });
    }
    async extendSubscription(userId, additionalDays) {
        const subscription = await this.getActiveSubscription(userId);
        if (!subscription) {
            throw new common_1.NotFoundException('No active subscription found');
        }
        const newEndDate = new Date(subscription.endDate);
        newEndDate.setDate(newEndDate.getDate() + additionalDays);
        return this.prisma.subscription.update({
            where: { id: subscription.id },
            data: { endDate: newEndDate },
        });
    }
    async expireSubscriptions() {
        const result = await this.prisma.subscription.updateMany({
            where: {
                status: client_1.SubscriptionStatus.ACTIVE,
                endDate: { lt: new Date() },
            },
            data: {
                status: client_1.SubscriptionStatus.EXPIRED,
            },
        });
        if (result.count > 0) {
            this.logger.log(`Expired ${result.count} subscriptions`);
        }
        return result.count;
    }
    async getSubscriptionStats() {
        const [totalSubscriptions, activeSubscriptions, expiredSubscriptions, cancelledSubscriptions, totalRevenue,] = await Promise.all([
            this.prisma.subscription.count(),
            this.prisma.subscription.count({
                where: { status: client_1.SubscriptionStatus.ACTIVE },
            }),
            this.prisma.subscription.count({
                where: { status: client_1.SubscriptionStatus.EXPIRED },
            }),
            this.prisma.subscription.count({
                where: { status: client_1.SubscriptionStatus.CANCELLED },
            }),
            this.prisma.payment.aggregate({
                where: {
                    status: 'PAID',
                },
                _sum: { amount: true },
            }),
        ]);
        return {
            totalSubscriptions,
            activeSubscriptions,
            expiredSubscriptions,
            cancelledSubscriptions,
            totalRevenue: totalRevenue._sum?.amount || 0,
        };
    }
};
exports.SubscriptionsService = SubscriptionsService;
exports.SubscriptionsService = SubscriptionsService = SubscriptionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SubscriptionsService);
//# sourceMappingURL=subscriptions.service.js.map