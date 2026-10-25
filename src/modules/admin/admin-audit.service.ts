import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';

export interface AuditEntry {
  adminId: string;
  adminName?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: unknown;
  ip?: string | null;
}

/** Body keys never written to the audit log. */
const SECRET_KEY = /password|token|secret|contentBase64/i;
const MAX_STRING = 500;
const MAX_ARRAY = 50;

/** Drop secrets / huge blobs so a log row stays small and safe to show. */
export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (depth > 4) return '[…]';
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY).map((v) => sanitizeForAudit(v, depth + 1));
    if (value.length > MAX_ARRAY) items.push(`… +${value.length - MAX_ARRAY}`);
    return items;
  }
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY.test(key) ? '[redacted]' : sanitizeForAudit(v, depth + 1);
  }
  return out;
}

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Never throws: an audit failure must not fail the admin action. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      const details = entry.details === undefined ? undefined : sanitizeForAudit(entry.details);
      await this.prisma.adminAuditLog.create({
        data: {
          adminId: entry.adminId,
          adminName: entry.adminName ?? null,
          action: entry.action,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          details:
            details === undefined || details === null
              ? Prisma.JsonNull
              : (details as Prisma.InputJsonValue),
          ip: entry.ip ?? null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write admin audit log (${entry.action})`, error as Error);
    }
  }

  async list(params: { page?: number; limit?: number; action?: string; adminId?: string }) {
    const page = Math.max(1, Math.floor(Number(params.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(params.limit) || 20)));
    const where: Prisma.AdminAuditLogWhereInput = {};
    if (params.action) where.action = params.action;
    if (params.adminId) where.adminId = params.adminId;

    const [items, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          adminId: true,
          adminName: true,
          action: true,
          entityType: true,
          entityId: true,
          details: true,
          ip: true,
          createdAt: true,
        },
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
