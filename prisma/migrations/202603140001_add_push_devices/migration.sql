CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB', 'UNKNOWN');

CREATE TABLE "push_devices" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expoPushToken" TEXT NOT NULL,
  "devicePlatform" "DevicePlatform" NOT NULL DEFAULT 'UNKNOWN',
  "deviceName" TEXT,
  "appVersion" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_devices_expoPushToken_key" ON "push_devices"("expoPushToken");
CREATE INDEX "push_devices_userId_idx" ON "push_devices"("userId");
CREATE INDEX "push_devices_lastSeenAt_idx" ON "push_devices"("lastSeenAt");

ALTER TABLE "push_devices"
ADD CONSTRAINT "push_devices_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
