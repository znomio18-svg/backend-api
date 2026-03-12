-- CreateEnum
CREATE TYPE "MovieCategory" AS ENUM ('NEW', 'HISTORICAL', 'MODERN');

-- AlterTable
ALTER TABLE "movies" ADD COLUMN "category" "MovieCategory" NOT NULL DEFAULT 'NEW';

-- CreateIndex
CREATE INDEX "movies_category_idx" ON "movies"("category");
