import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RedisService } from '../../config/redis.service';
import { WatchAccessService } from './watch-access.service';

/**
 * Most lookups arrive from the website's server, so many viewers share one IP.
 * Only failed lookups are capped per IP (that is what probing looks like);
 * successful ones are capped per purchase.
 */
const FAILED_LOOKUPS_PER_IP_PER_MINUTE = 30;
const LOOKUPS_PER_PURCHASE_PER_MINUTE = 120;

@ApiTags('Watch')
@Controller('watch')
export class WatchAccessController {
  constructor(
    private readonly watchAccessService: WatchAccessService,
    private readonly redis: RedisService,
  ) {}

  @Get(':token')
  @ApiOperation({ summary: 'Resolve a secret watch link into a playable stream (no login required)' })
  async resolve(@Param('token') token: string, @Req() req: Request) {
    const ip = req.ip || 'unknown';
    if (await this.isOverLimit(`ip:${ip}`, FAILED_LOOKUPS_PER_IP_PER_MINUTE, false)) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    try {
      const result = await this.watchAccessService.resolve(token);
      if (await this.isOverLimit(`purchase:${result.access.id}`, LOOKUPS_PER_PURCHASE_PER_MINUTE, true)) {
        throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
      }
      return result;
    } catch (error) {
      if (error instanceof NotFoundException) {
        await this.isOverLimit(`ip:${ip}`, FAILED_LOOKUPS_PER_IP_PER_MINUTE, true);
      }
      throw error;
    }
  }

  /** Fixed one-minute window; `count` false only reads the current total. */
  private async isOverLimit(subject: string, limit: number, count: boolean): Promise<boolean> {
    const key = `ratelimit:watch:${subject}:${Math.floor(Date.now() / 60000)}`;
    try {
      const current = Number((await this.redis.get(key)) ?? 0);
      if (!count) return current >= limit;
      await this.redis.set(key, String(current + 1), 60);
      return current + 1 > limit;
    } catch {
      // Redis down — fail open, the token itself is the real protection
      return false;
    }
  }
}
