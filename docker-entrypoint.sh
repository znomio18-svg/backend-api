#!/bin/sh
set -e

echo "=== Running Prisma migrations ==="
if [ -z "$DIRECT_DATABASE_URL" ]; then
  echo "WARNING: DIRECT_DATABASE_URL is not set. Migrations require a direct database connection (not through PgBouncer)."
fi
npx prisma migrate deploy
echo "=== Migrations applied successfully ==="

exec node dist/src/main.js
