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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../config/prisma.service");
const redis_service_1 = require("../../config/redis.service");
const public_decorator_1 = require("../../common/decorators/public.decorator");
let HealthController = class HealthController {
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    async check() {
        const health = { status: 'ok' };
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            health.database = 'ok';
        }
        catch {
            health.status = 'degraded';
            health.database = 'error';
        }
        try {
            const pong = await this.redis.getClient().ping();
            health.redis = pong === 'PONG' ? 'ok' : 'error';
        }
        catch {
            health.status = 'degraded';
            health.redis = 'error';
        }
        return health;
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "check", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], HealthController);
//# sourceMappingURL=health.controller.js.map