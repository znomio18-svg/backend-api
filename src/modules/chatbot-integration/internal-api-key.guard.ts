import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Service-to-service auth for the chatbot backend. The key lives only in the
 * two servers' environments — never in a web or mobile client. Without a
 * configured key every request is refused (fail closed).
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);
  private readonly expectedDigest: Buffer | null;

  constructor(configService: ConfigService) {
    const key = configService.get<string>('CHATBOT_INTERNAL_API_KEY');
    if (!key || key.length < 32) {
      this.logger.warn(
        'CHATBOT_INTERNAL_API_KEY is missing or shorter than 32 chars — internal chatbot API disabled',
      );
      this.expectedDigest = null;
    } else {
      this.expectedDigest = this.digest(key);
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-internal-api-key'];

    if (!this.expectedDigest || typeof provided !== 'string' || !provided) {
      throw new UnauthorizedException();
    }

    // Compare fixed-length digests so the check is timing-safe for any input length
    if (!crypto.timingSafeEqual(this.digest(provided), this.expectedDigest)) {
      throw new UnauthorizedException();
    }
    return true;
  }

  private digest(value: string): Buffer {
    return crypto.createHash('sha256').update(value).digest();
  }
}
