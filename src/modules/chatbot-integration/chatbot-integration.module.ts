import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { MoviesModule } from '../movies/movies.module';
import { PaymentsModule } from '../payments/payments.module';
import { WatchAccessModule } from '../watch-access/watch-access.module';
import { ChatbotIntegrationController } from './chatbot-integration.controller';
import { ChatbotIntegrationService } from './chatbot-integration.service';
import { InternalApiKeyGuard } from './internal-api-key.guard';

@Module({
  imports: [AdminModule, MoviesModule, PaymentsModule, WatchAccessModule],
  controllers: [ChatbotIntegrationController],
  providers: [ChatbotIntegrationService, InternalApiKeyGuard],
})
export class ChatbotIntegrationModule {}
