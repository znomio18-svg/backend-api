import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { QpayService } from './qpay.service';
import { PaymentScheduler } from './payment.scheduler';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, QpayService, PaymentScheduler],
  exports: [PaymentsService, QpayService],
})
export class PaymentsModule {}
