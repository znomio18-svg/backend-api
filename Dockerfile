# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application (includes prisma generate && nest build)
RUN npm run build

# Production stage
FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy Prisma CLI from builder (prisma is a devDependency, not installed by --omit=dev)
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Generate Prisma client fresh in production image to avoid builder/runtime mismatch
RUN npx prisma generate

# Copy built application
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 4000

# Run migrations then exec into node (exec replaces shell so node receives signals directly)
CMD ["sh", "-c", "echo 'Running migrations...' && npx prisma migrate deploy && echo 'Migrations complete.' && exec node dist/src/main.js"]
