import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'Get all subscription plans' })
  async getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Get('plans/:id')
  @Public()
  @ApiOperation({ summary: 'Get subscription plan by ID' })
  async getPlan(@Param('id') id: string) {
    return this.subscriptionsService.getPlan(id);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get current user subscription' })
  async getMySubscription(@CurrentUser('id') userId: string) {
    const subscription =
      await this.subscriptionsService.getActiveSubscription(userId);
    return { subscription };
  }

  @Get('my/history')
  @ApiOperation({ summary: 'Get user subscription history' })
  async getMySubscriptionHistory(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.getUserSubscriptions(userId);
  }

  @Get('my/status')
  @ApiOperation({ summary: 'Get user subscription status' })
  async getMySubscriptionStatus(@CurrentUser('id') userId: string) {
    const hasSubscription =
      await this.subscriptionsService.hasActiveSubscription(userId);
    const subscription = hasSubscription
      ? await this.subscriptionsService.getActiveSubscription(userId)
      : null;

    return {
      hasActiveSubscription: hasSubscription,
      subscription,
    };
  }

  @Delete('my')
  @ApiOperation({ summary: 'Cancel user subscription' })
  async cancelMySubscription(@CurrentUser('id') userId: string) {
    return this.subscriptionsService.cancelSubscription(userId);
  }
}
