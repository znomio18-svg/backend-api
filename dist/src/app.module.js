"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const movies_module_1 = require("./modules/movies/movies.module");
const payments_module_1 = require("./modules/payments/payments.module");
const admin_module_1 = require("./modules/admin/admin.module");
const subscriptions_module_1 = require("./modules/subscriptions/subscriptions.module");
const upload_module_1 = require("./modules/upload/upload.module");
const health_module_1 = require("./modules/health/health.module");
const prisma_module_1 = require("./config/prisma.module");
const redis_module_1 = require("./config/redis.module");
const email_module_1 = require("./config/email.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            ...(process.env.WORKER === 'true' ? [schedule_1.ScheduleModule.forRoot()] : []),
            prisma_module_1.PrismaModule,
            redis_module_1.RedisModule,
            email_module_1.EmailModule,
            health_module_1.HealthModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            movies_module_1.MoviesModule,
            payments_module_1.PaymentsModule,
            admin_module_1.AdminModule,
            subscriptions_module_1.SubscriptionsModule,
            upload_module_1.UploadModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map