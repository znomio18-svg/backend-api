import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable graceful shutdown hooks so onModuleDestroy (Prisma, Redis) fires on SIGTERM
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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global 30s request timeout — prevents stuck requests from hogging DB connections
  app.useGlobalInterceptors(new TimeoutInterceptor(30000));

  const config = new DocumentBuilder()
    .setTitle('1MinDrama Movie API')
    .setDescription('Movie streaming platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 4000;
  const server = await app.listen(port, '0.0.0.0');

  // Set server timeouts to prevent hanging connections
  server.keepAliveTimeout = 65000; // Slightly above Railway's 60s LB timeout
  server.headersTimeout = 66000; // Must be higher than keepAliveTimeout

  logger.log(`Application is running on port ${port}`);
}

bootstrap();
