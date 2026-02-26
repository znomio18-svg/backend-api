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
var PrismaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
let PrismaService = PrismaService_1 = class PrismaService extends client_1.PrismaClient {
    constructor(configService) {
        const connectionLimit = parseInt(configService.get('DATABASE_POOL_SIZE') || '10', 10);
        const poolTimeout = parseInt(configService.get('DATABASE_POOL_TIMEOUT') || '10', 10);
        super({
            log: [
                { emit: 'event', level: 'warn' },
                { emit: 'event', level: 'error' },
            ],
            datasources: {
                db: {
                    url: `${configService.get('DATABASE_URL')}&connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`,
                },
            },
        });
        this.configService = configService;
        this.logger = new common_1.Logger(PrismaService_1.name);
    }
    async onModuleInit() {
        this.$on('warn', (e) => {
            this.logger.warn(`Prisma warning: ${e.message}`);
        });
        this.$on('error', (e) => {
            this.logger.error(`Prisma error: ${e.message}`);
        });
        await this.$connect();
        this.logger.log('Database connected');
    }
    async onModuleDestroy() {
        this.logger.log('Disconnecting database...');
        await this.$disconnect();
        this.logger.log('Database disconnected');
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = PrismaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map