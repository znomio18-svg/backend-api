-- CreateTable
CREATE TABLE "external_identities" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watch_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "source" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watch_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_identities_userId_idx" ON "external_identities"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "external_identities_provider_externalId_key" ON "external_identities"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "watch_tokens_tokenHash_key" ON "watch_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "watch_tokens_purchaseId_idx" ON "watch_tokens"("purchaseId");

-- AddForeignKey
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_tokens" ADD CONSTRAINT "watch_tokens_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "movie_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
