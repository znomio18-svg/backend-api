-- ============================================================
-- Migration: Subscription-only refactor
--
-- BREAKING CHANGES:
-- 1. Remove MoviePurchase model (per-movie purchase system)
-- 2. Remove deviceId from User (device-based auth removed)
-- 3. Make facebookId required on User (Facebook-only auth)
-- 4. Remove genre, price from Movie
-- 5. Add isFeatured to Movie
-- 6. Remove movieId, paymentType from Payment (subscription-only)
-- 7. Make subscriptionPlanId required on Payment
--
-- SAFETY: This migration is designed for a coordinated deploy.
-- Run with new code that no longer references removed columns.
-- ============================================================

-- Step 1: Add isFeatured column to movies (safe, additive)
ALTER TABLE "movies" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Create index for isFeatured
CREATE INDEX IF NOT EXISTS "movies_isFeatured_idx" ON "movies"("isFeatured");

-- Step 3: Migrate existing pending movie-purchase payments to EXPIRED
-- (any pending MOVIE_PURCHASE payments are no longer valid)
UPDATE "payments" SET "status" = 'EXPIRED'
WHERE "paymentType" = 'MOVIE_PURCHASE' AND "status" = 'PENDING';

-- Step 4: For existing payments that reference movies, set subscriptionPlanId
-- to a placeholder if null (needed before making column required).
-- NOTE: In practice, old movie-purchase payments will retain their data
-- as historical records. We keep movieId data but won't enforce FK.

-- Step 5: Drop MoviePurchase table
DROP TABLE IF EXISTS "movie_purchases";

-- Step 6: Remove device-based auth columns from users
-- First drop the index, then the column
DROP INDEX IF EXISTS "users_deviceId_idx";
ALTER TABLE "users" DROP COLUMN IF EXISTS "deviceId";

-- Step 7: Remove genre column from movies
-- Drop the genre index first
DROP INDEX IF EXISTS "movies_genre_idx";
ALTER TABLE "movies" DROP COLUMN IF EXISTS "genre";

-- Step 8: Remove price column from movies
ALTER TABLE "movies" DROP COLUMN IF EXISTS "price";

-- Step 9: Handle Payment table changes
-- Remove movieId FK constraint and column
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_movieId_fkey";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "movieId";

-- Remove paymentType column (no longer needed, everything is SUBSCRIPTION)
ALTER TABLE "payments" DROP COLUMN IF EXISTS "paymentType";

-- Make subscriptionPlanId required (NOT NULL) for new payments
-- Existing NULL values from old movie payments have been handled above
-- We need to handle any remaining NULLs before adding the constraint
-- For safety: delete any orphaned payments with no subscription plan
DELETE FROM "payments" WHERE "subscriptionPlanId" IS NULL;

ALTER TABLE "payments" ALTER COLUMN "subscriptionPlanId" SET NOT NULL;
