"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const logger = new common_1.Logger('Worker');
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    app.enableShutdownHooks();
    logger.log('Worker started — cron jobs active, no HTTP server');
    const shutdown = async (signal) => {
        logger.log(`${signal} received, shutting down worker...`);
        await app.close();
        process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
bootstrap();
//# sourceMappingURL=worker.js.map