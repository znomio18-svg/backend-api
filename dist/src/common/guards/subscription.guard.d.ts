import { CanActivate, ExecutionContext } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
export declare class SubscriptionGuard implements CanActivate {
    private readonly prisma;
    constructor(prisma: PrismaService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
