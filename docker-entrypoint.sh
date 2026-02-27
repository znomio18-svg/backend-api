#!/bin/sh
set -e

echo "=== Running Prisma migrations ==="
node ./node_modules/prisma/build/index.js migrate deploy
echo "=== Migrations applied successfully ==="

exec node dist/src/main.js
