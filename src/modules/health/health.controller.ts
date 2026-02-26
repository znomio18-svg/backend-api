import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { RedisService } from '../../config/redis.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async check() {
    const health: Record<string, string> = { status: 'ok' };

    // Check database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      health.database = 'ok';
    } catch {
      health.status = 'degraded';
      health.database = 'error';
    }

    // Check Redis
    try {
      const pong = await this.redis.getClient().ping();
      health.redis = pong === 'PONG' ? 'ok' : 'error';
    } catch {
      health.status = 'degraded';
      health.redis = 'error';
    }

    return health;
  }
}
