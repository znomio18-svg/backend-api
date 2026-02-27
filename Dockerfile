# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (need prisma CLI for generate)
RUN npm ci

# Copy source code
COPY . .

# Build application (includes prisma generate && nest build)
RUN npm run build

# Prune dev dependencies but keep prisma CLI (needed for migrate deploy at runtime)
RUN npm prune --omit=dev && npm install prisma@$(node -p "require('./node_modules/@prisma/client/package.json').version")

# Re-generate Prisma client after prune to ensure client matches runtime @prisma/client
RUN npx prisma generate

# Production stage
FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy everything we need from builder (single source of truth)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Expose port
EXPOSE 4000

ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
