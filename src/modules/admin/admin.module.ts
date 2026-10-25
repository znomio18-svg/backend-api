import { Module, forwardRef } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AppConfigController } from './app-config.controller';
import { AdminService } from './admin.service';
import { BankAccountsService } from './bank-accounts.service';
import { AdminSettingsService } from './admin-settings.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { AdminFeaturesService } from './admin-features.service';
import { BankReconcileService } from './bank-reconcile.service';
import { MoviesModule } from '../movies/movies.module';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MoviesModule,
    PaymentsModule,
    UsersModule,
    SubscriptionsModule,
    NotificationsModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [AdminController, AppConfigController],
  providers: [
    AdminService,
    BankAccountsService,
    AdminSettingsService,
    AdminAuditService,
    AdminAuditInterceptor,
    AdminFeaturesService,
    BankReconcileService,
  ],
  exports: [BankAccountsService, AdminSettingsService],
})
export class AdminModule {}
