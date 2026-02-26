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
var RedisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = require("ioredis");
let RedisService = RedisService_1 = class RedisService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(RedisService_1.name);
        this.isConnected = false;
        const redisUrl = this.configService.get('REDIS_URL') || 'redis://localhost:6379';
        const commandTimeout = parseInt(this.configService.get('REDIS_COMMAND_TIMEOUT') || '5000', 10);
        const connectTimeout = parseInt(this.configService.get('REDIS_CONNECT_TIMEOUT') || '10000', 10);
        this.client = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            commandTimeout,
            connectTimeout,
            retryStrategy: (times) => {
                if (times > 3) {
                    this.logger.warn(`Redis connection failed after ${times} attempts, will keep retrying`);
                    return 5000;
                }
                return Math.min(times * 200, 2000);
            },
            lazyConnect: false,
        });
        this.client.on('connect', () => {
            this.isConnected = true;
            this.logger.log('Redis connected');
        });
        this.client.on('error', (err) => {
            this.isConnected = false;
            this.logger.warn(`Redis error: ${err.message}`);
        });
        this.client.on('close', () => {
            this.isConnected = false;
            this.logger.warn('Redis connection closed');
        });
    }
    async onModuleDestroy() {
        await this.client.quit();
    }
    async get(key) {
        if (!this.isConnected)
            return null;
        try {
            return await this.client.get(key);
        }
        catch {
            return null;
        }
    }
    async set(key, value, ttl) {
        if (!this.isConnected)
            return;
        try {
            if (ttl) {
                await this.client.set(key, value, 'EX', ttl);
            }
            else {
                await this.client.set(key, value);
            }
        }
        catch {
        }
    }
    async del(key) {
        if (!this.isConnected)
            return;
        try {
            await this.client.del(key);
        }
        catch {
        }
    }
    async exists(key) {
        if (!this.isConnected)
            return false;
        try {
            const result = await this.client.exists(key);
            return result === 1;
        }
        catch {
            return false;
        }
    }
    async setJson(key, value, ttl) {
        await this.set(key, JSON.stringify(value), ttl);
    }
    async getJson(key) {
        const value = await this.get(key);
        if (!value)
            return null;
        try {
            return JSON.parse(value);
        }
        catch {
            return null;
        }
    }
    async keys(pattern) {
        if (!this.isConnected)
            return [];
        try {
            return await this.client.keys(pattern);
        }
        catch {
            return [];
        }
    }
    async flushPattern(pattern) {
        if (!this.isConnected)
            return;
        try {
            const keys = await this.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(...keys);
            }
        }
        catch {
        }
    }
    getClient() {
        return this.client;
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RedisService);
//# sourceMappingURL=redis.service.js.map