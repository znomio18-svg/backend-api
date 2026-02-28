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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const admin_service_1 = require("./admin.service");
const movies_service_1 = require("../movies/movies.service");
const payments_service_1 = require("../payments/payments.service");
const users_service_1 = require("../users/users.service");
const bank_accounts_service_1 = require("./bank-accounts.service");
const admin_settings_service_1 = require("./admin-settings.service");
const subscriptions_service_1 = require("../subscriptions/subscriptions.service");
const auth_service_1 = require("../auth/auth.service");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
class ChangePasswordDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'currentPassword123' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "currentPassword", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'newPassword123' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MinLength)(6),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "newPassword", void 0);
let AdminController = class AdminController {
    constructor(adminService, moviesService, paymentsService, usersService, bankAccountsService, adminSettingsService, subscriptionsService, authService) {
        this.adminService = adminService;
        this.moviesService = moviesService;
        this.paymentsService = paymentsService;
        this.usersService = usersService;
        this.bankAccountsService = bankAccountsService;
        this.adminSettingsService = adminSettingsService;
        this.subscriptionsService = subscriptionsService;
        this.authService = authService;
    }
    async getDashboard() {
        return this.adminService.getDashboardStats();
    }
    async getReports(type, startDate, endDate) {
        return this.adminService.getReportData(type, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
    }
    async getRevenue(startDate, endDate) {
        return this.adminService.getRevenueStats({
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
        });
    }
    async getMovies(page, limit, search) {
        return this.moviesService.findAll({
            page: page || 1,
            limit: limit || 20,
            search,
        });
    }
    async getMovieStats() {
        return this.moviesService.getStats();
    }
    async getMovie(id) {
        return this.moviesService.findOne(id);
    }
    async createMovie(dto) {
        return this.moviesService.create(dto);
    }
    async updateMovie(id, dto) {
        return this.moviesService.update(id, dto);
    }
    async toggleFeatured(id, isFeatured) {
        return this.moviesService.update(id, { isFeatured });
    }
    async deleteMovie(id) {
        await this.moviesService.delete(id);
        return { success: true };
    }
    async getUsers(page, limit, search) {
        const skip = ((page || 1) - 1) * (limit || 20);
        const where = search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                ],
            }
            : undefined;
        return this.usersService.findAll({
            skip,
            take: limit || 20,
            where,
            orderBy: { createdAt: 'desc' },
        });
    }
    async getUser(id) {
        return this.usersService.findOne(id);
    }
    async getPayments(page, limit, status, startDate, endDate, search) {
        const skip = ((page || 1) - 1) * (limit || 20);
        return this.paymentsService.getPaymentLogs({
            skip,
            take: limit || 20,
            status,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            search: search || undefined,
        });
    }
    async confirmPayment(id) {
        return this.paymentsService.confirmBankTransferPayment(id);
    }
    async rejectPayment(id, reason) {
        return this.paymentsService.rejectBankTransferPayment(id, reason);
    }
    async getBankAccounts(includeInactive) {
        return this.bankAccountsService.findAll(includeInactive === true);
    }
    async getBankAccount(id) {
        return this.bankAccountsService.findOne(id);
    }
    async createBankAccount(dto) {
        return this.bankAccountsService.create(dto);
    }
    async updateBankAccount(id, dto) {
        return this.bankAccountsService.update(id, dto);
    }
    async deleteBankAccount(id) {
        await this.bankAccountsService.delete(id);
        return { success: true };
    }
    async getSettings() {
        return this.adminSettingsService.getAll();
    }
    async getSetting(key) {
        const value = await this.adminSettingsService.get(key);
        return { key, value };
    }
    async updateSetting(key, body) {
        return this.adminSettingsService.set(key, body.value, body.description);
    }
    async getSubscriptionPlans(includeInactive) {
        return this.subscriptionsService.getPlans(includeInactive === true);
    }
    async getSubscriptionPlan(id) {
        return this.subscriptionsService.getPlan(id);
    }
    async createSubscriptionPlan(dto) {
        return this.subscriptionsService.createPlan(dto);
    }
    async updateSubscriptionPlan(id, dto) {
        return this.subscriptionsService.updatePlan(id, dto);
    }
    async deleteSubscriptionPlan(id) {
        await this.subscriptionsService.deletePlan(id);
        return { success: true };
    }
    async getMoviePurchases(page, limit, movieId) {
        const skip = ((page || 1) - 1) * (limit || 20);
        return this.adminService.getMoviePurchases({
            skip,
            take: limit || 20,
            movieId: movieId || undefined,
        });
    }
    async getSubscriptionStats() {
        return this.subscriptionsService.getSubscriptionStats();
    }
    async changePassword(req, dto) {
        return this.authService.changeAdminPassword(req.user.id, dto.currentPassword, dto.newPassword);
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, swagger_1.ApiOperation)({ summary: 'Get dashboard statistics' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('reports'),
    (0, swagger_1.ApiOperation)({ summary: 'Get reports with date range' }),
    (0, swagger_1.ApiQuery)({ name: 'type', enum: ['today', 'week', 'month', 'custom'] }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: false }),
    __param(0, (0, common_1.Query)('type')),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getReports", null);
__decorate([
    (0, common_1.Get)('revenue'),
    (0, swagger_1.ApiOperation)({ summary: 'Get revenue statistics' }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: false }),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getRevenue", null);
__decorate([
    (0, common_1.Get)('movies'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all movies (including unpublished)' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getMovies", null);
__decorate([
    (0, common_1.Get)('movies/stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get movie statistics' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getMovieStats", null);
__decorate([
    (0, common_1.Get)('movies/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get movie details' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getMovie", null);
__decorate([
    (0, common_1.Post)('movies'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new movie' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createMovie", null);
__decorate([
    (0, common_1.Put)('movies/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a movie' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateMovie", null);
__decorate([
    (0, common_1.Put)('movies/:id/featured'),
    (0, swagger_1.ApiOperation)({ summary: 'Toggle movie featured status' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('isFeatured')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "toggleFeatured", null);
__decorate([
    (0, common_1.Delete)('movies/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a movie' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "deleteMovie", null);
__decorate([
    (0, common_1.Get)('users'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all users' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getUsers", null);
__decorate([
    (0, common_1.Get)('users/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get user details' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getUser", null);
__decorate([
    (0, common_1.Get)('payments'),
    (0, swagger_1.ApiOperation)({ summary: 'Get payment logs' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, enum: client_1.PaymentStatus }),
    (0, swagger_1.ApiQuery)({ name: 'startDate', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'endDate', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false, description: 'Search by username or invoice' }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('startDate')),
    __param(4, (0, common_1.Query)('endDate')),
    __param(5, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getPayments", null);
__decorate([
    (0, common_1.Post)('payments/:id/confirm'),
    (0, swagger_1.ApiOperation)({ summary: 'Manually confirm a bank transfer payment' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "confirmPayment", null);
__decorate([
    (0, common_1.Post)('payments/:id/reject'),
    (0, swagger_1.ApiOperation)({ summary: 'Reject a bank transfer payment' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('reason')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "rejectPayment", null);
__decorate([
    (0, common_1.Get)('bank-accounts'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all bank accounts' }),
    (0, swagger_1.ApiQuery)({ name: 'includeInactive', required: false, type: Boolean }),
    __param(0, (0, common_1.Query)('includeInactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Boolean]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getBankAccounts", null);
__decorate([
    (0, common_1.Get)('bank-accounts/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get bank account by ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getBankAccount", null);
__decorate([
    (0, common_1.Post)('bank-accounts'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new bank account' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createBankAccount", null);
__decorate([
    (0, common_1.Put)('bank-accounts/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a bank account' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateBankAccount", null);
__decorate([
    (0, common_1.Delete)('bank-accounts/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a bank account' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "deleteBankAccount", null);
__decorate([
    (0, common_1.Get)('settings'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all admin settings' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getSettings", null);
__decorate([
    (0, common_1.Get)('settings/:key'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a specific setting by key' }),
    __param(0, (0, common_1.Param)('key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getSetting", null);
__decorate([
    (0, common_1.Put)('settings/:key'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a setting' }),
    __param(0, (0, common_1.Param)('key')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateSetting", null);
__decorate([
    (0, common_1.Get)('subscription-plans'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all subscription plans' }),
    (0, swagger_1.ApiQuery)({ name: 'includeInactive', required: false, type: Boolean }),
    __param(0, (0, common_1.Query)('includeInactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Boolean]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getSubscriptionPlans", null);
__decorate([
    (0, common_1.Get)('subscription-plans/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get subscription plan by ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getSubscriptionPlan", null);
__decorate([
    (0, common_1.Post)('subscription-plans'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new subscription plan' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createSubscriptionPlan", null);
__decorate([
    (0, common_1.Put)('subscription-plans/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a subscription plan' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "updateSubscriptionPlan", null);
__decorate([
    (0, common_1.Delete)('subscription-plans/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a subscription plan' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "deleteSubscriptionPlan", null);
__decorate([
    (0, common_1.Get)('movie-purchases'),
    (0, swagger_1.ApiOperation)({ summary: 'Get movie purchase history' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'movieId', required: false, type: String }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('movieId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getMoviePurchases", null);
__decorate([
    (0, common_1.Get)('subscriptions/stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Get subscription statistics' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getSubscriptionStats", null);
__decorate([
    (0, common_1.Put)('password'),
    (0, swagger_1.ApiOperation)({ summary: 'Change admin password' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ChangePasswordDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "changePassword", null);
exports.AdminController = AdminController = __decorate([
    (0, swagger_1.ApiTags)('Admin'),
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt'), roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.UserRole.ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [admin_service_1.AdminService,
        movies_service_1.MoviesService,
        payments_service_1.PaymentsService,
        users_service_1.UsersService,
        bank_accounts_service_1.BankAccountsService,
        admin_settings_service_1.AdminSettingsService,
        subscriptions_service_1.SubscriptionsService,
        auth_service_1.AuthService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map