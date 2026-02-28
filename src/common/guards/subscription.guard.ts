import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false; // JwtAuthGuard should have already rejected
    }

    // Check for active subscription
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: SubscriptionStatus.ACTIVE,
        endDate: { gt: new Date() },
      },
    });

    if (subscription) {
      return true;
    }

    // Check for movie purchase (if accessing a specific movie)
    const movieId = request.params?.id;
    if (movieId) {
      const purchase = await this.prisma.moviePurchase.findUnique({
        where: {
          userId_movieId: {
            userId: user.id,
            movieId,
          },
        },
      });

      if (purchase) {
        return true;
      }
    }

    throw new ForbiddenException({
      statusCode: 403,
      error: 'SUBSCRIPTION_REQUIRED',
      message: 'Энэ контентыг үзэхийн тулд эрх худалдан авна уу.',
      messageEn: 'An active subscription is required to access this content.',
    });
  }
}
