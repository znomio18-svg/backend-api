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
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiProperty,
} from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { AdminService } from './admin.service';
import { MoviesService, CreateMovieDto, UpdateMovieDto } from '../movies/movies.service';
import { PaymentsService } from '../payments/payments.service';
import { UsersService } from '../users/users.service';
import { BankAccountsService, CreateBankAccountDto, UpdateBankAccountDto } from './bank-accounts.service';
import { AdminSettingsService } from './admin-settings.service';
import { SubscriptionsService, CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto } from '../subscriptions/subscriptions.service';
import { AuthService } from '../auth/auth.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole, PaymentStatus } from '@prisma/client';

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

  @Get('movies/:id')
  @ApiOperation({ summary: 'Get movie details' })
  async getMovie(@Param('id') id: string) {
    return this.moviesService.findOne(id);
  }

  @Post('movies')
  @ApiOperation({ summary: 'Create a new movie' })
  async createMovie(@Body() dto: CreateMovieDto) {
    return this.moviesService.create(dto);
  }

  @Put('movies/:id')
  @ApiOperation({ summary: 'Update a movie' })
  async updateMovie(@Param('id') id: string, @Body() dto: UpdateMovieDto) {
    return this.moviesService.update(id, dto);
  }

  @Put('movies/:id/featured')
  @ApiOperation({ summary: 'Toggle movie featured status' })
  async toggleFeatured(
    @Param('id') id: string,
    @Body('isFeatured') isFeatured: boolean,
  ) {
    return this.moviesService.update(id, { isFeatured });
  }

  @Delete('movies/:id')
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
  async getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    const skip = ((page || 1) - 1) * (limit || 20);

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
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

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user details' })
  async getUser(@Param('id') id: string) {
    return this.usersService.findOne(id);
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
  async getPayments(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: PaymentStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
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

  @Post('payments/:id/confirm')
  @ApiOperation({ summary: 'Manually confirm a bank transfer payment' })
  async confirmPayment(@Param('id') id: string) {
    return this.paymentsService.confirmBankTransferPayment(id);
  }

  @Post('payments/:id/reject')
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
  @ApiOperation({ summary: 'Create a new bank account' })
  async createBankAccount(@Body() dto: CreateBankAccountDto) {
    return this.bankAccountsService.create(dto);
  }

  @Put('bank-accounts/:id')
  @ApiOperation({ summary: 'Update a bank account' })
  async updateBankAccount(
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.bankAccountsService.update(id, dto);
  }

  @Delete('bank-accounts/:id')
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
  @ApiOperation({ summary: 'Create a new subscription plan' })
  async createSubscriptionPlan(@Body() dto: CreateSubscriptionPlanDto) {
    return this.subscriptionsService.createPlan(dto);
  }

  @Put('subscription-plans/:id')
  @ApiOperation({ summary: 'Update a subscription plan' })
  async updateSubscriptionPlan(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptionsService.updatePlan(id, dto);
  }

  @Delete('subscription-plans/:id')
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
  @ApiOperation({ summary: 'Change admin password' })
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changeAdminPassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
