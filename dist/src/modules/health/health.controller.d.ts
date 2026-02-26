import { PrismaService } from '../../config/prisma.service';
import { RedisService } from '../../config/redis.service';
export declare class HealthController {
    private readonly prisma;
    private readonly redis;
    constructor(prisma: PrismaService, redis: RedisService);
    check(): Promise<Record<string, string>>;
}
