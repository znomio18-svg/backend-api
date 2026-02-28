-- AlterTable
ALTER TABLE "movies" ADD COLUMN "price" INTEGER;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "subscriptionPlanId" DROP NOT NULL,
ADD COLUMN "movieId" TEXT;

-- CreateTable
CREATE TABLE "movie_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movie_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "movie_purchases_paymentId_key" ON "movie_purchases"("paymentId");

-- CreateIndex
CREATE INDEX "movie_purchases_userId_idx" ON "movie_purchases"("userId");

-- CreateIndex
CREATE INDEX "movie_purchases_movieId_idx" ON "movie_purchases"("movieId");

-- CreateIndex
CREATE UNIQUE INDEX "movie_purchases_userId_movieId_key" ON "movie_purchases"("userId", "movieId");

-- CreateIndex
CREATE INDEX "payments_movieId_idx" ON "payments"("movieId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropForeignKey (make subscriptionPlan optional)
ALTER TABLE "payments" DROP CONSTRAINT "payments_subscriptionPlanId_fkey";

-- AddForeignKey (re-add as optional)
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movie_purchases" ADD CONSTRAINT "movie_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movie_purchases" ADD CONSTRAINT "movie_purchases_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movie_purchases" ADD CONSTRAINT "movie_purchases_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
