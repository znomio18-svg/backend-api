import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MoviesModule } from './modules/movies/movies.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminModule } from './modules/admin/admin.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { UploadModule } from './modules/upload/upload.module';
import { HealthModule } from './modules/health/health.module';
import { WatchAccessModule } from './modules/watch-access/watch-access.module';
import { ChatbotIntegrationModule } from './modules/chatbot-integration/chatbot-integration.module';
import { PrismaModule } from './config/prisma.module';
import { RedisModule } from './config/redis.module';
import { EmailModule } from './config/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Only register ScheduleModule in worker mode — prevents cron timers in API replicas
    ...(process.env.WORKER === 'true' ? [ScheduleModule.forRoot()] : []),
    PrismaModule,
    RedisModule,
    EmailModule,
    HealthModule,
    AuthModule,
    UsersModule,
    MoviesModule,
    PaymentsModule,
    AdminModule,
    SubscriptionsModule,
    UploadModule,
    WatchAccessModule,
    ChatbotIntegrationModule,
  ],
})
export class AppModule {}
