import { Module, forwardRef } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BankAccountsService } from './bank-accounts.service';
import { AdminSettingsService } from './admin-settings.service';
import { MoviesModule } from '../movies/movies.module';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MoviesModule,
    PaymentsModule,
    UsersModule,
    SubscriptionsModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [AdminController],
  providers: [AdminService, BankAccountsService, AdminSettingsService],
  exports: [BankAccountsService, AdminSettingsService],
})
export class AdminModule {}
