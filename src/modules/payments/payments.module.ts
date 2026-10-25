import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { QpayService } from './qpay.service';
import { PaymentScheduler } from './payment.scheduler';
import { ChatbotNotifierService } from './chatbot-notifier.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, QpayService, PaymentScheduler, ChatbotNotifierService],
  exports: [PaymentsService, QpayService],
})
export class PaymentsModule {}
