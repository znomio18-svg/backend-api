import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiProperty,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, IsOptional } from 'class-validator';
import { AdminService } from './admin.service';
import { MoviesService, CreateMovieDto, UpdateMovieDto } from '../movies/movies.service';
import { PaymentsService } from '../payments/payments.service';
import { UsersService } from '../users/users.service';
import { BankAccountsService, CreateBankAccountDto, UpdateBankAccountDto } from './bank-accounts.service';
import { AdminSettingsService } from './admin-settings.service';
import { SubscriptionsService, CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto } from '../subscriptions/subscriptions.service';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole, PaymentStatus, MovieCategory } from '@prisma/client';
import { AdminAuditInterceptor, Audit } from './admin-audit.interceptor';
import { AdminAuditService } from './admin-audit.service';
import { AdminFeaturesService } from './admin-features.service';
import { BankReconcileService } from './bank-reconcile.service';
import {
  BankReconcileConfirmDto,
  BankReconcilePreviewDto,
  GrantMovieDto,
  GrantSubscriptionDto,
  SendToUsersDto,
} from './admin-features.dto';

type SourceFilter = 'chatbot' | 'site';
function parseSource(source?: string): SourceFilter | undefined {
  if (!source) return undefined;
  if (source === 'chatbot' || source === 'site') return source;
  throw new BadRequestException("source must be 'chatbot' or 'site'");
}
function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`Invalid date: ${value}`);
  return date;
}

class SendNotificationDto {
  @ApiProperty({ example: 'Шинэ кино нэмэгдлээ!' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Шинэ кино-г одоо үзээрэй' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({ required: false, example: { movieId: 'abc123' } })
  @IsOptional()
  data?: Record<string, string>;
}

class ChangePasswordDto {
  @ApiProperty({ example: 'currentPassword123' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ example: 'newPassword123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}

@ApiTags('Admin')
@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
@UseInterceptors(AdminAuditInterceptor)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private moviesService: MoviesService,
    private paymentsService: PaymentsService,
    private usersService: UsersService,
    private bankAccountsService: BankAccountsService,
    private adminSettingsService: AdminSettingsService,
    private subscriptionsService: SubscriptionsService,
    private authService: AuthService,
    private notificationsService: NotificationsService,
    private adminAuditService: AdminAuditService,
    private adminFeaturesService: AdminFeaturesService,
    private bankReconcileService: BankReconcileService,
  ) {}

  // Dashboard
  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  // Reports
  @Get('reports')
  @ApiOperation({ summary: 'Get reports with date range' })
  @ApiQuery({ name: 'type', enum: ['today', 'week', 'month', 'custom'] })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getReports(
    @Query('type') type: 'today' | 'week' | 'month' | 'custom',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getReportData(
      type,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue statistics' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getRevenue(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getRevenueStats({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  // Movies CRUD
  @Get('movies')
  @ApiOperation({ summary: 'Get all movies (including unpublished)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  async getMovies(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.moviesService.findAll({
      page: page || 1,
      limit: limit || 20,
      search,
    });
  }

  @Get('movies/stats')
  @ApiOperation({ summary: 'Get movie statistics' })
  async getMovieStats() {
    return this.moviesService.getStats();
  }

  @Get('movies/top-selling')
  @ApiOperation({ summary: 'Top selling movies (PAID movie payments, admin grants excluded)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getTopSellingMovies(
    @Query('limit') limit?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminFeaturesService.topSellingMovies({
      limit,
      startDate: parseDate(startDate),
      endDate: parseDate(endDate),
    });
  }

  @Get('movies/:id')
  @ApiOperation({ summary: 'Get movie details' })
  async getMovie(@Param('id') id: string) {
    return this.moviesService.findOne(id);
  }

  @Post('movies')
  @Audit({ action: 'movie.create', entityType: 'movie', entityIdFrom: (_req, result) => result?.id })
  @ApiOperation({ summary: 'Create a new movie' })
  async createMovie(@Body() dto: CreateMovieDto) {
    return this.moviesService.create(dto);
  }

  @Put('movies/:id')
  @Audit({ action: 'movie.update', entityType: 'movie' })
  @ApiOperation({ summary: 'Update a movie' })
  async updateMovie(@Param('id') id: string, @Body() dto: UpdateMovieDto) {
    return this.moviesService.update(id, dto);
  }

  @Put('movies/:id/featured')
  @Audit({ action: 'movie.feature_toggle', entityType: 'movie' })
  @ApiOperation({ summary: 'Toggle movie featured status' })
  async toggleFeatured(
    @Param('id') id: string,
    @Body('isFeatured') isFeatured: boolean,
  ) {
    return this.moviesService.update(id, { isFeatured });
  }

  @Delete('movies/:id')
  @Audit({ action: 'movie.delete', entityType: 'movie' })
  @ApiOperation({ summary: 'Delete a movie' })
  async deleteMovie(@Param('id') id: string) {
    await this.moviesService.delete(id);
    return { success: true };
  }

  // Users
  @Get('users')
  @ApiOperation({ summary: 'Get all users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'source', required: false, enum: ['chatbot', 'site'] })
  async getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('source') source?: string,
  ) {
    const skip = ((page || 1) - 1) * (limit || 20);

    const searchWhere = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;
    const sourceWhere = this.adminFeaturesService.sourceWhere(parseSource(source));
    const where =
      searchWhere && sourceWhere
        ? { AND: [searchWhere, sourceWhere] }
        : searchWhere || sourceWhere;

    const result = await this.usersService.findAll({
      skip,
      take: limit || 20,
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Additive: `source` = 'chatbot' for users created by the chatbot
    const sources = await this.adminFeaturesService.sourcesFor(result.users.map((u) => u.id));
    return {
      ...result,
      // Never send password hashes to the browser
      users: result.users.map(({ password: _password, ...u }) => ({ ...u, source: sources.get(u.id) ?? 'site' })),
    };
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user details' })
  async getUser(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    if (!user) return user;
    const { password: _password, ...rest } = user;
    const sources = await this.adminFeaturesService.sourcesFor([user.id]);
    return { ...rest, source: sources.get(user.id) ?? 'site' };
  }

  @Post('users/:id/grant-subscription')
  @Audit({ action: 'user.grant_subscription', entityType: 'user' })
  @ApiOperation({ summary: 'Grant (or extend) an active subscription to a user' })
  async grantSubscription(@Param('id') id: string, @Body() dto: GrantSubscriptionDto) {
    return this.adminFeaturesService.grantSubscription(id, dto.planId, dto.days);
  }

  @Post('users/:id/grant-movie')
  @Audit({ action: 'user.grant_movie', entityType: 'user' })
  @ApiOperation({ summary: 'Grant a movie to a user (zero-amount GRANT- payment)' })
  async grantMovie(@Param('id') id: string, @Body() dto: GrantMovieDto, @Req() req: any) {
    return this.adminFeaturesService.grantMovie(id, dto.movieId, req.user.id, dto.note);
  }

  // Payments
  @Get('payments')
  @ApiOperation({ summary: 'Get payment logs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'search', required: false, description: 'Search by username or invoice' })
  @ApiQuery({ name: 'source', required: false, enum: ['chatbot', 'site'] })
  async getPayments(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: PaymentStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('source') source?: string,
  ) {
    const skip = ((page || 1) - 1) * (limit || 20);

    return this.paymentsService.getPaymentLogs({
      skip,
      take: limit || 20,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      search: search || undefined,
      source: parseSource(source),
    });
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Get payment detail' })
  async getPaymentDetail(@Param('id') id: string) {
    return this.paymentsService.getAdminPaymentDetail(id);
  }

  @Post('payments/:id/confirm')
  @Audit({ action: 'payment.confirm', entityType: 'payment' })
  @ApiOperation({ summary: 'Manually confirm a bank transfer payment' })
  async confirmPayment(@Param('id') id: string) {
    return this.paymentsService.confirmBankTransferPayment(id);
  }

  @Post('payments/:id/reconcile')
  @Audit({ action: 'payment.reconcile', entityType: 'payment', details: (_req, r) => ({ resultStatus: r?.status }) })
  @ApiOperation({ summary: 'Manually reconcile a QPay payment (checks QPay API and updates status)' })
  async reconcilePayment(@Param('id') id: string) {
    return this.paymentsService.adminReconcilePayment(id);
  }

  @Post('payments/:id/reject')
  @Audit({ action: 'payment.reject', entityType: 'payment' })
  @ApiOperation({ summary: 'Reject a bank transfer payment' })
  async rejectPayment(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.paymentsService.rejectBankTransferPayment(id, reason);
  }

  // Bank Accounts
  @Get('bank-accounts')
  @ApiOperation({ summary: 'Get all bank accounts' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  async getBankAccounts(@Query('includeInactive') includeInactive?: boolean) {
    return this.bankAccountsService.findAll(includeInactive === true);
  }

  @Get('bank-accounts/:id')
  @ApiOperation({ summary: 'Get bank account by ID' })
  async getBankAccount(@Param('id') id: string) {
    return this.bankAccountsService.findOne(id);
  }

  @Post('bank-accounts')
  @Audit({ action: 'bank_account.create', entityType: 'bank_account', entityIdFrom: (_req, result) => result?.id })
  @ApiOperation({ summary: 'Create a new bank account' })
  async createBankAccount(@Body() dto: CreateBankAccountDto) {
    return this.bankAccountsService.create(dto);
  }

  @Put('bank-accounts/:id')
  @Audit({ action: 'bank_account.update', entityType: 'bank_account' })
  @ApiOperation({ summary: 'Update a bank account' })
  async updateBankAccount(
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.bankAccountsService.update(id, dto);
  }

  @Delete('bank-accounts/:id')
  @Audit({ action: 'bank_account.delete', entityType: 'bank_account' })
  @ApiOperation({ summary: 'Delete a bank account' })
  async deleteBankAccount(@Param('id') id: string) {
    await this.bankAccountsService.delete(id);
    return { success: true };
  }

  // Admin Settings
  @Get('settings')
  @ApiOperation({ summary: 'Get all admin settings' })
  async getSettings() {
    return this.adminSettingsService.getAll();
  }

  @Get('settings/:key')
  @ApiOperation({ summary: 'Get a specific setting by key' })
  async getSetting(@Param('key') key: string) {
    const value = await this.adminSettingsService.get(key);
    return { key, value };
  }

  @Put('settings/:key')
  @Audit({ action: 'setting.update', entityType: 'setting', idParam: 'key' })
  @ApiOperation({ summary: 'Update a setting' })
  async updateSetting(
    @Param('key') key: string,
    @Body() body: { value: string; description?: string },
  ) {
    return this.adminSettingsService.set(key, body.value, body.description);
  }

  // Subscription Plans
  @Get('subscription-plans')
  @ApiOperation({ summary: 'Get all subscription plans' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  async getSubscriptionPlans(@Query('includeInactive') includeInactive?: boolean) {
    return this.subscriptionsService.getPlans(includeInactive === true);
  }

  @Get('subscription-plans/:id')
  @ApiOperation({ summary: 'Get subscription plan by ID' })
  async getSubscriptionPlan(@Param('id') id: string) {
    return this.subscriptionsService.getPlan(id);
  }

  @Post('subscription-plans')
  @Audit({ action: 'plan.create', entityType: 'subscription_plan', entityIdFrom: (_req, result) => result?.id })
  @ApiOperation({ summary: 'Create a new subscription plan' })
  async createSubscriptionPlan(@Body() dto: CreateSubscriptionPlanDto) {
    return this.subscriptionsService.createPlan(dto);
  }

  @Put('subscription-plans/:id')
  @Audit({ action: 'plan.update', entityType: 'subscription_plan' })
  @ApiOperation({ summary: 'Update a subscription plan' })
  async updateSubscriptionPlan(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptionsService.updatePlan(id, dto);
  }

  @Delete('subscription-plans/:id')
  @Audit({ action: 'plan.delete', entityType: 'subscription_plan' })
  @ApiOperation({ summary: 'Delete a subscription plan' })
  async deleteSubscriptionPlan(@Param('id') id: string) {
    await this.subscriptionsService.deletePlan(id);
    return { success: true };
  }

  // Movie Purchases
  @Get('movie-purchases')
  @ApiOperation({ summary: 'Get movie purchase history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'movieId', required: false, type: String })
  async getMoviePurchases(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('movieId') movieId?: string,
  ) {
    const skip = ((page || 1) - 1) * (limit || 20);

    return this.adminService.getMoviePurchases({
      skip,
      take: limit || 20,
      movieId: movieId || undefined,
    });
  }

  @Get('subscriptions/stats')
  @ApiOperation({ summary: 'Get subscription statistics' })
  async getSubscriptionStats() {
    return this.subscriptionsService.getSubscriptionStats();
  }

  // Password Management
  @Put('password')
  @Audit({ action: 'admin.password_change', logBody: false })
  @ApiOperation({ summary: 'Change admin password' })
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changeAdminPassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // Push Notifications
  @Post('notifications/send')
  @Audit({ action: 'push.broadcast', details: (_req, r) => ({ sent: r?.sent, failed: r?.failed }) })
  @ApiOperation({ summary: 'Send push notification to all users' })
  async sendNotification(@Body() dto: SendNotificationDto) {
    return this.notificationsService.sendToAll(dto);
  }

  @Post('notifications/send-to-users')
  @Audit({
    action: 'push.send_to_users',
    details: (_req, r) => ({ sent: r?.sent, failed: r?.failed, targetedUsers: r?.targetedUsers }),
  })
  @ApiOperation({ summary: 'Send push notification to specific users' })
  async sendNotificationToUsers(@Body() dto: SendToUsersDto) {
    return this.notificationsService.sendToUsers(dto.userIds, {
      title: dto.title,
      body: dto.body,
      data: dto.movieId ? { movieId: dto.movieId } : undefined,
    });
  }

  // Audit log
  @Get('audit-logs')
  @ApiOperation({ summary: 'Admin audit log' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'adminId', required: false })
  async getAuditLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('action') action?: string,
    @Query('adminId') adminId?: string,
  ) {
    return this.adminAuditService.list({
      page,
      limit,
      action: action || undefined,
      adminId: adminId || undefined,
    });
  }

  // Bank statement reconciliation (not under payments/: payments/:id/confirm exists)
  @Post('bank-reconcile/preview')
  @Audit({
    action: 'bank_reconcile.preview',
    logBody: false,
    details: (req, r) => ({
      filename: req.body?.filename,
      creditLines: r?.creditLines,
      matched: r?.summary?.matched,
    }),
  })
  @ApiOperation({ summary: 'Parse a bank statement (xlsx/csv) and match it to bank transfer payments (no changes)' })
  async bankReconcilePreview(@Body() dto: BankReconcilePreviewDto) {
    return this.bankReconcileService.previewFile(dto.filename, dto.contentBase64);
  }

  @Post('bank-reconcile/confirm')
  @Audit({
    action: 'bank_reconcile.confirm',
    logBody: false,
    details: (req, r) => ({
      requested: req.body?.paymentIds?.length ?? 0,
      confirmed: r?.confirmed,
      failed: r?.failed,
    }),
  })
  @ApiOperation({ summary: 'Confirm the approved bank transfer payments' })
  async bankReconcileConfirm(@Body() dto: BankReconcileConfirmDto) {
    return this.bankReconcileService.confirm(dto.paymentIds);
  }

  // CSV export
  @Get('export/payments.csv')
  @ApiOperation({ summary: 'Export payments as CSV (max 50,000 rows)' })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'source', required: false, enum: ['chatbot', 'site'] })
  async exportPayments(
    @Res() res: Response,
    @Query('status') status?: PaymentStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('source') source?: string,
  ) {
    if (status && !Object.values(PaymentStatus).includes(status)) {
      throw new BadRequestException('Invalid status');
    }
    const csv = await this.adminFeaturesService.exportPaymentsCsv({
      status: status || undefined,
      startDate: parseDate(startDate),
      endDate: parseDate(endDate),
      search: search || undefined,
      source: parseSource(source),
    });
    this.sendCsv(res, 'payments', csv);
  }

  @Get('export/users.csv')
  @ApiOperation({ summary: 'Export users as CSV (max 50,000 rows)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'source', required: false, enum: ['chatbot', 'site'] })
  async exportUsers(
    @Res() res: Response,
    @Query('search') search?: string,
    @Query('source') source?: string,
  ) {
    const csv = await this.adminFeaturesService.exportUsersCsv({
      search: search || undefined,
      source: parseSource(source),
    });
    this.sendCsv(res, 'users', csv);
  }

  private sendCsv(res: Response, name: string, csv: string) {
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}-${date}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  }

  @Get('notifications/stats')
  @ApiOperation({ summary: 'Get push notification device count' })
  async getNotificationStats() {
    const deviceCount = await this.notificationsService.getDeviceCount();
    return { deviceCount };
  }

}
