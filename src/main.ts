import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { json } from 'express';
import { AppModule } from './app.module';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable graceful shutdown hooks so onModuleDestroy (Prisma, Redis) fires on SIGTERM
  app.enableShutdownHooks();

  app.use(cookieParser());

  // Bank statement upload (base64 xlsx/csv up to 10MB) needs a bigger JSON
  // limit than Nest's default 100kb — for this one route only. Registered
  // before Nest's global parser, which then skips the already-parsed body.
  // Wrapped in a named function: Nest skips its own parser if it finds a
  // middleware literally named "jsonParser" in the stack.
  const bankStatementJson = json({ limit: '15mb' });
  app.use('/api/admin/bank-reconcile/preview', function bankStatementBody(req: any, res: any, next: any) {
    bankStatementJson(req, res, next);
  });
  // Subtitle upload / AI-translate routes carry SRT/VTT text up to 5MB.
  const subtitleJson = json({ limit: '8mb' });
  const subtitleBody = function subtitleBody(req: any, res: any, next: any) {
    if (req.method !== 'POST') return next();
    subtitleJson(req, res, next);
  };
  app.use('/api/admin/movies/:id/subtitles', subtitleBody);
  app.use('/api/admin/subtitles/translate', subtitleBody);
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
