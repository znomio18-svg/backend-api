"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PaymentsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const payments_service_1 = require("./payments.service");
const qpay_service_1 = require("./qpay.service");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const client_1 = require("@prisma/client");
class CreatePaymentDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePaymentDto.prototype, "subscriptionPlanId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePaymentDto.prototype, "movieId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.PaymentMethod),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePaymentDto.prototype, "paymentMethod", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePaymentDto.prototype, "bankAccountId", void 0);
class WebhookBodyDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WebhookBodyDto.prototype, "invoice", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WebhookBodyDto.prototype, "invoice_id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WebhookBodyDto.prototype, "invoice_status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WebhookBodyDto.prototype, "payment_status", void 0);
let PaymentsController = PaymentsController_1 = class PaymentsController {
    constructor(paymentsService, qpayService) {
        this.paymentsService = paymentsService;
        this.qpayService = qpayService;
        this.logger = new common_1.Logger(PaymentsController_1.name);
    }
    async createPayment(user, dto) {
        return this.paymentsService.createPayment(user.id, dto);
    }
    async getBankAccounts() {
        return this.paymentsService.getBankAccounts();
    }
    async handleWebhook(invoiceCode) {
        this.logger.log(`Webhook GET received for invoice: ${invoiceCode}`);
        const result = await this.paymentsService.handleWebhook(invoiceCode);
        return {
            success: true,
            action: result.action,
        };
    }
    async handleWebhookPost(body, signature, req) {
        const invoiceCode = body.invoice || body.invoice_id;
        if (!invoiceCode) {
            this.logger.warn('Webhook POST received without invoice code');
            throw new common_1.BadRequestException('Missing invoice code');
        }
        this.logger.log(`Webhook POST received for invoice: ${invoiceCode}`);
        if (signature) {
            const rawBody = JSON.stringify(body);
            const isValid = this.qpayService.verifyWebhookSignature(rawBody, signature);
            if (!isValid) {
                this.logger.warn(`Invalid webhook signature for invoice: ${invoiceCode}`);
                throw new common_1.BadRequestException('Invalid webhook signature');
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
    async notifyBankTransferPaid(id) {
        return this.paymentsService.notifyBankTransferPaid(id);
    }
    async getPayment(id) {
        return this.paymentsService.getPayment(id);
    }
    async checkPayment(id) {
        return this.paymentsService.checkAndProcessPayment(id);
    }
    async reconcilePayment(id) {
        return this.paymentsService.checkAndProcessPayment(id);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new subscription payment' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreatePaymentDto]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "createPayment", null);
__decorate([
    (0, common_1.Get)('bank-accounts'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get active bank accounts for bank transfer' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "getBankAccounts", null);
__decorate([
    (0, common_1.Get)('webhook'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'QPay webhook callback (GET)' }),
    (0, swagger_1.ApiQuery)({ name: 'invoice', required: true }),
    __param(0, (0, common_1.Query)('invoice')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "handleWebhook", null);
__decorate([
    (0, common_1.Post)('webhook'),
    (0, public_decorator_1.Public)(),
    (0, swagger_1.ApiOperation)({ summary: 'QPay webhook callback (POST)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-qpay-signature', required: false, description: 'HMAC signature for webhook verification' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-qpay-signature')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [WebhookBodyDto, String, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "handleWebhookPost", null);
__decorate([
    (0, common_1.Post)(':id/notify-paid'),
    (0, swagger_1.ApiOperation)({ summary: 'Notify that bank transfer has been made' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "notifyBankTransferPaid", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get payment details' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "getPayment", null);
__decorate([
    (0, common_1.Post)(':id/check'),
    (0, swagger_1.ApiOperation)({ summary: 'Check and process payment status' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "checkPayment", null);
__decorate([
    (0, common_1.Post)(':id/reconcile'),
    (0, swagger_1.ApiOperation)({ summary: 'Manually trigger payment reconciliation' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "reconcilePayment", null);
exports.PaymentsController = PaymentsController = PaymentsController_1 = __decorate([
    (0, swagger_1.ApiTags)('Payments'),
    (0, common_1.Controller)('payments'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [payments_service_1.PaymentsService,
        qpay_service_1.QpayService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map