import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../config/prisma.service';
import { BunnyService } from '../movies/bunny.service';

/** Every watch token starts with this, so /watch/:param can tell it from a movie id. */
export const WATCH_TOKEN_PREFIX = 'wt_';

/**
 * A purchase never expires, but its link should not live forever once it has
 * been forwarded around — the owner can always ask the chatbot for a new one.
 */
const PURCHASE_LINK_TTL_MS = 30 * 24 * 3600 * 1000;

export interface IssuedWatchLink {
  token: string;
  webUrl: string;
  appUrl: string;
  /** When the link stops working. */
  expiresAt: Date;
  /** When access itself ends — always null: a purchase is permanent. */
  accessExpiresAt: Date | null;
}

export function isWatchToken(value: string): boolean {
  return value.startsWith(WATCH_TOKEN_PREFIX) && value.length > WATCH_TOKEN_PREFIX.length + 20;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Secret watch links for people who never logged in on the website or app —
 * e.g. a Messenger user who bought a movie through the chatbot.
 *
 * The token is the only credential, so it is 32 random bytes, stored as a
 * hash, and every use re-checks the purchase rather than trusting the token
 * alone.
 */
@Injectable()
export class WatchAccessService {
  private readonly logger = new Logger(WatchAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bunnyService: BunnyService,
    private readonly configService: ConfigService,
  ) {}

  async issueForPurchase(purchaseId: string, userId: string, source?: string): Promise<IssuedWatchLink> {
    const purchase = await this.prisma.moviePurchase.findUnique({ where: { id: purchaseId } });
    // The same answer for "not yours" and "does not exist" — no probing ids
    if (!purchase || purchase.userId !== userId) {
      throw new NotFoundException('Худалдан авалт олдсонгүй');
    }

    const expiresAt = new Date(Date.now() + PURCHASE_LINK_TTL_MS);
    const token = WATCH_TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
    await this.prisma.watchToken.create({
      data: { purchaseId: purchase.id, source, expiresAt, tokenHash: hashToken(token) },
    });
    return { token, ...this.buildUrls(token), expiresAt, accessExpiresAt: null };
  }

  buildUrls(token: string): { webUrl: string; appUrl: string } {
    const frontendUrl = (this.configService.get<string>('FRONTEND_URL') || '').replace(/\/$/, '');
    const appScheme = this.configService.get<string>('MOBILE_APP_SCHEME') || 'mindramaapp';
    return {
      webUrl: `${frontendUrl}/watch/${token}`,
      appUrl: `${appScheme}://watch/${token}`,
    };
  }

  /**
   * Resolve a watch link into something playable: the token exists and is not
   * revoked or expired, its purchase still exists, and the movie is published.
   */
  async resolve(token: string) {
    if (!isWatchToken(token)) {
      throw new NotFoundException('Watch link not found');
    }

    const watchToken = await this.prisma.watchToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { purchase: { include: { movie: true } } },
    });
    if (!watchToken || watchToken.revokedAt || !watchToken.purchase) {
      throw new NotFoundException('Watch link not found');
    }

    const now = new Date();
    if (watchToken.expiresAt <= now) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'LINK_EXPIRED',
        message: 'This link has expired. Ask for a new one.',
        expiresAt: watchToken.expiresAt,
      });
    }

    const { purchase } = watchToken;
    const movie = purchase.movie;
    if (!movie || !movie.isPublished) {
      throw new NotFoundException('Movie is not available');
    }

    // Usage stats only — never let a bookkeeping failure block playback
    this.prisma.watchToken
      .update({ where: { id: watchToken.id }, data: { lastUsedAt: now, useCount: { increment: 1 } } })
      .catch((e) => this.logger.warn(`Failed to record watch token use: ${e?.message}`));

    // Same player URL the logged-in /movies/:id/stream endpoint returns
    const embedUrl = this.bunnyService.getEmbedUrl(movie.videoId);
    return {
      kind: 'PURCHASE' as const,
      access: {
        id: purchase.id,
        startsAt: purchase.createdAt,
        expiresAt: null,
        linkExpiresAt: watchToken.expiresAt,
      },
      movie: {
        ...movie,
        thumbnailUrl: this.bunnyService.resolveImageUrl(movie.thumbnailUrl),
      },
      streamUrl: embedUrl,
      embedUrl,
    };
  }
}
