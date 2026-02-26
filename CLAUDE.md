# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

1MinDrama is a movie streaming platform backend API built with NestJS 10, Prisma ORM (PostgreSQL), and Redis (ioredis). It serves a Mongolian movie marketplace with subscription-based access. Currency is MNT (Mongolian Tugrik).

## Common Commands

```bash
# Development
npm run start:dev          # API server with hot-reload (ts-node-dev, port 4000)
npm run worker:dev         # Background worker with hot-reload (cron jobs, no HTTP)
npm run build              # prisma generate && nest build → outputs to dist/

# Database
npm run prisma:generate    # Regenerate Prisma client after schema changes
npm run migration:generate # Create new migration (interactive, runs prisma migrate dev)
npm run migration:deploy   # Apply pending migrations (production)
npm run prisma:studio      # Open Prisma Studio GUI

# Docker
npm run docker:up          # Start MySQL, Redis, API, and Worker containers
npm run docker:down        # Stop all containers

# No test framework is configured in this project.
```

## Architecture

**Two-process deployment:** The same `AppModule` powers both processes. `main.ts` starts the HTTP server (port 4000); `worker.ts` starts an application context with no HTTP. `ScheduleModule` is conditionally loaded only when `WORKER=true`, preventing duplicate cron timers across API replicas.

**Authentication system:**
- **Facebook OAuth** — the only user authentication method. Users must log in via Facebook. After successful OAuth, a JWT is issued. No anonymous/guest access.
- **JWT auth** (`JwtAuthGuard`) — all protected user and admin routes use JWT Bearer tokens.
- **Admin login** — separate username/password flow that also issues JWT. Combined with `RolesGuard` + `@Roles(UserRole.ADMIN)`.
- Both guards respect the `@Public()` decorator to skip authentication.

**Subscription-only model:**
- No per-movie purchases. Users need an active subscription to stream any movie.
- `SubscriptionGuard` enforces subscription checks on streaming endpoints. Returns 403 with structured `SUBSCRIPTION_REQUIRED` error if no active subscription.
- Payments are exclusively for subscription plans (monthly/yearly).

**Module layout** (`src/modules/`):
- `auth` — Facebook OAuth strategy, JWT strategy, admin login, `/auth/me`
- `movies` — Catalog browsing (public), featured movies, streaming URLs via Bunny CDN (requires subscription)
- `payments` — QPay integration, bank transfer flow, webhook handling (signature verification), scheduled reconciliation with exponential backoff
- `subscriptions` — Plan management, user subscription lifecycle, scheduled expiration
- `admin` — Dashboard stats, revenue reports, movie CRUD, featured toggle, payment confirmation/rejection, bank account & settings management
- `upload` — Image upload to Bunny CDN (admin only, 5MB limit, memory storage)
- `users` — User data, subscription status
- `health` — DB + Redis connectivity check at `/api/v1/health`

**Shared infrastructure** (`src/common/`):
- `guards/` — `JwtAuthGuard`, `RolesGuard`, `SubscriptionGuard`
- `decorators/` — `@CurrentUser()`, `@Roles()`, `@Public()`
- `interceptors/` — `TimeoutInterceptor` (30s global timeout)

**Config services** (`src/config/`): `PrismaService` (with configurable pool size/timeout), `RedisService` (with command/connect timeouts), `EmailService` — each as global NestJS modules.

**API prefix:** All routes are prefixed with `/api`. Swagger docs at `/api/docs`.

**Path alias:** `@/*` maps to `src/*` (configured in tsconfig.json).

## Database

Prisma with PostgreSQL. Schema at `prisma/schema.prisma`. Key models: `User` (facebookId required), `Movie` (isFeatured, no genre/price), `Payment` (subscription-only, QPay + bank transfer, reconciliation tracking), `Subscription`, `SubscriptionPlan`, `BankAccount`, `QPayToken`, `AdminSettings`.

## Key Patterns

- DTOs use `class-validator` decorators with global `ValidationPipe` (whitelist + forbidNonWhitelisted + transform)
- Payment reconciliation uses exponential backoff (`reconcileAttempts`, `nextReconcileAt` fields)
- Worker locks use Redis SET NX EX with lock ownership verification (fenced tokens)
- Admin module uses `forwardRef` to resolve circular dependency with AuthModule
- CORS configured for `FRONTEND_URL` and `ADMIN_URL` environment variables
- Graceful shutdown hooks enabled for both API and worker processes
- Prisma connection pool size/timeout configurable via `DATABASE_POOL_SIZE` and `DATABASE_POOL_TIMEOUT` env vars
- Redis command/connect timeouts configurable via `REDIS_COMMAND_TIMEOUT` and `REDIS_CONNECT_TIMEOUT` env vars

## Environment Variables (Required)

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Secret for JWT signing
- `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_CALLBACK_URL` — Facebook OAuth
- `FRONTEND_URL` — Frontend URL for OAuth redirect and CORS
- `QPAY_USERNAME`, `QPAY_PASSWORD`, `QPAY_INVOICE_CODE`, `QPAY_CALLBACK_URL` — QPay integration
- `BUNNY_LIBRARY_ID`, `BUNNY_API_KEY`, `BUNNY_CDN_HOSTNAME` — Bunny CDN video
