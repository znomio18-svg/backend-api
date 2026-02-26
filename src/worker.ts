import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Worker');

  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();

  logger.log('Worker started — cron jobs active, no HTTP server');

  const shutdown = async (signal: string) => {
    logger.log(`${signal} received, shutting down worker...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap();
