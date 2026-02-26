"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const cookieParser = require("cookie-parser");
const app_module_1 = require("./app.module");
const timeout_interceptor_1 = require("./common/interceptors/timeout.interceptor");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableShutdownHooks();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.enableCors({
        origin: [
            process.env.FRONTEND_URL || 'http://localhost:3000',
            process.env.ADMIN_URL || 'http://localhost:3002',
        ],
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.useGlobalInterceptors(new timeout_interceptor_1.TimeoutInterceptor(30000));
    const config = new swagger_1.DocumentBuilder()
        .setTitle('ZNom Movie API')
        .setDescription('Movie streaming platform API')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
    const port = process.env.PORT || 4000;
    const server = await app.listen(port, '0.0.0.0');
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    logger.log(`Application is running on port ${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map