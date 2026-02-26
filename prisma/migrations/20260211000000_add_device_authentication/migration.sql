-- Migration: Add device-based authentication
-- This migration adds deviceId field to users and makes facebookId nullable
-- to support device-based authentication while preserving Facebook login for future re-enablement

-- Step 1: Make facebookId nullable (required for device-only users)
-- We use a temporary default value for existing users to avoid constraint violations
ALTER TABLE "users" ALTER COLUMN "facebookId" DROP NOT NULL;

-- Step 2: Add deviceId column with unique constraint
ALTER TABLE "users" ADD COLUMN "deviceId" TEXT;

-- Step 3: Create unique index on deviceId
CREATE UNIQUE INDEX "users_deviceId_key" ON "users"("deviceId");

-- Step 4: Create non-unique index for faster lookups
CREATE INDEX "users_deviceId_idx" ON "users"("deviceId");

-- Note: Existing users will have:
--   - facebookId: their existing Facebook ID (preserved)
--   - deviceId: NULL (can be linked later if needed)
--
-- New device-based users will have:
--   - facebookId: NULL
--   - deviceId: their device UUID
--
-- Users can later "upgrade" from device-only to Facebook-linked by:
--   1. Logging in with Facebook
--   2. Linking their existing device user to the Facebook account
