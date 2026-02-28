import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Headers,
  Req,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiHeader,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { QpayService } from './qpay.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, PaymentMethod } from '@prisma/client';

class CreatePaymentDto {
  @IsString()
  @IsOptional()
  subscriptionPlanId?: string;

  @IsString()
  @IsOptional()
  movieId?: string;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsString()
  @IsOptional()
  bankAccountId?: string;
}

class WebhookBodyDto {
  @IsString()
  @IsOptional()
  invoice?: string;

  @IsString()
  @IsOptional()
  invoice_id?: string;

  @IsString()
  @IsOptional()
  invoice_status?: string;

  @IsString()
  @IsOptional()
  payment_status?: string;
}

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private paymentsService: PaymentsService,
    private qpayService: QpayService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new subscription payment' })
  async createPayment(
    @CurrentUser() user: User,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(user.id, dto);
  }

  // Static routes MUST come before parameterized routes (:id)
  @Get('bank-accounts')
  @Public()
  @ApiOperation({ summary: 'Get active bank accounts for bank transfer' })
  async getBankAccounts() {
    return this.paymentsService.getBankAccounts();
  }

  @Get('webhook')
  @Public()
  @ApiOperation({ summary: 'QPay webhook callback (GET)' })
  @ApiQuery({ name: 'invoice', required: true })
  async handleWebhook(@Query('invoice') invoiceCode: string) {
    this.logger.log(`Webhook GET received for invoice: ${invoiceCode}`);
    const result = await this.paymentsService.handleWebhook(invoiceCode);
    return {
      success: true,
      action: result.action,
    };
  }

  @Post('webhook')
  @Public()
  @ApiOperation({ summary: 'QPay webhook callback (POST)' })
  @ApiHeader({ name: 'x-qpay-signature', required: false, description: 'HMAC signature for webhook verification' })
  async handleWebhookPost(
    @Body() body: WebhookBodyDto,
    @Headers('x-qpay-signature') signature: string,
    @Req() req: Request,
  ) {
    const invoiceCode = body.invoice || body.invoice_id;

    if (!invoiceCode) {
      this.logger.warn('Webhook POST received without invoice code');
      throw new BadRequestException('Missing invoice code');
    }

    this.logger.log(`Webhook POST received for invoice: ${invoiceCode}`);

    if (signature) {
      const rawBody = JSON.stringify(body);
      const isValid = this.qpayService.verifyWebhookSignature(rawBody, signature);

      if (!isValid) {
        this.logger.warn(`Invalid webhook signature for invoice: ${invoiceCode}`);
        throw new BadRequestException('Invalid webhook signature');
      }

      this.logger.log(`Webhook signature verified for invoice: ${invoiceCode}`);
    }

    const result = await this.paymentsService.handleWebhook(invoiceCode, body);

    return {
      success: true,
      action: result.action,
      reason: result.reason,
    };
  }

  // Parameterized routes (:id) MUST come after static routes
  @Post(':id/notify-paid')
  @ApiOperation({ summary: 'Notify that bank transfer has been made' })
  async notifyBankTransferPaid(@Param('id') id: string) {
    return this.paymentsService.notifyBankTransferPaid(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment details' })
  async getPayment(@Param('id') id: string) {
    return this.paymentsService.getPayment(id);
  }

  @Post(':id/check')
  @ApiOperation({ summary: 'Check and process payment status' })
  async checkPayment(@Param('id') id: string) {
    return this.paymentsService.checkAndProcessPayment(id);
  }

  @Post(':id/reconcile')
  @ApiOperation({ summary: 'Manually trigger payment reconciliation' })
  async reconcilePayment(@Param('id') id: string) {
    return this.paymentsService.checkAndProcessPayment(id);
  }
}
