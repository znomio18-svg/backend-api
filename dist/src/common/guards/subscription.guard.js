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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionGuard = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma.service");
const client_1 = require("@prisma/client");
let SubscriptionGuard = class SubscriptionGuard {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            return false;
        }
        const subscription = await this.prisma.subscription.findFirst({
            where: {
                userId: user.id,
                status: client_1.SubscriptionStatus.ACTIVE,
                endDate: { gt: new Date() },
            },
        });
        if (subscription) {
            return true;
        }
        const movieId = request.params?.id;
        if (movieId) {
            const purchase = await this.prisma.moviePurchase.findUnique({
                where: {
                    userId_movieId: {
                        userId: user.id,
                        movieId,
                    },
                },
            });
            if (purchase) {
                return true;
            }
        }
        throw new common_1.ForbiddenException({
            statusCode: 403,
            error: 'SUBSCRIPTION_REQUIRED',
            message: 'Энэ контентыг үзэхийн тулд эрх худалдан авна уу.',
            messageEn: 'An active subscription is required to access this content.',
        });
    }
};
exports.SubscriptionGuard = SubscriptionGuard;
exports.SubscriptionGuard = SubscriptionGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SubscriptionGuard);
//# sourceMappingURL=subscription.guard.js.map