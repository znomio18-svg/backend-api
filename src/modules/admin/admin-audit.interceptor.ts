import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AdminAuditService } from './admin-audit.service';

export interface AuditOptions {
  /** Readable action name, e.g. "payment.confirm" */
  action: string;
  entityType?: string;
  /** Route param holding the entity id (default "id" when entityType is set) */
  idParam?: string;
  /** Log the (sanitized) request body as details. Default true. */
  logBody?: boolean;
  /** Extra details derived from the request and the handler's result. */
  details?: (req: any, result: any) => unknown;
  /** Entity id derived from the result (e.g. a created record). */
  entityIdFrom?: (req: any, result: any) => string | null | undefined;
}

export const AUDIT_KEY = 'admin_audit';

/** Names a mutating admin route for the audit log. */
export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function clientIp(req: any): string | null {
  const forwarded = req.headers?.['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = (first ? String(first).split(',')[0].trim() : '') || req.ip || req.socket?.remoteAddress;
  return ip ? String(ip).slice(0, 100) : null;
}

/**
 * Writes an AdminAuditLog row after every successful mutating request on the
 * controller it is applied to. Routes name themselves with @Audit(); an
 * un-annotated mutating route is still logged as "<METHOD> <path>". Logging
 * is fire-and-forget and never changes the response.
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AdminAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    if (!MUTATING.has(req.method)) return next.handle();

    const options = this.reflector.get<AuditOptions | undefined>(AUDIT_KEY, context.getHandler());

    return next.handle().pipe(
      tap((result) => {
        try {
          const user = req.user;
          if (!user?.id) return;
          const action = options?.action ?? `${req.method} ${req.route?.path ?? req.path}`;
          const idParam = options?.idParam ?? (options?.entityType ? 'id' : undefined);
          const entityId =
            options?.entityIdFrom?.(req, result) ??
            (idParam ? req.params?.[idParam] : undefined) ??
            null;

          let details: unknown;
          const extra = options?.details?.(req, result);
          const body =
            options?.logBody === false || !req.body || Object.keys(req.body).length === 0
              ? undefined
              : req.body;
          if (extra !== undefined && body !== undefined) details = { body, ...(extra as object) };
          else if (extra !== undefined) details = extra;
          else if (body !== undefined) details = { body };

          void this.audit.record({
            adminId: user.id,
            adminName: user.name ?? user.email ?? null,
            action,
            entityType: options?.entityType ?? null,
            entityId: entityId ? String(entityId) : null,
            details,
            ip: clientIp(req),
          });
        } catch {
          // never affect the response
        }
      }),
    );
  }
}
