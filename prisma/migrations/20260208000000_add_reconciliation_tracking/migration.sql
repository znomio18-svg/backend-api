-- CreateEnum
CREATE TYPE "ReconcileSource" AS ENUM ('WEBHOOK', 'CRON', 'POLLING', 'MANUAL');

-- AlterTable: Add reconciliation tracking fields to payments
ALTER TABLE "payments" ADD COLUMN "qpayRawPayload" JSONB;
ALTER TABLE "payments" ADD COLUMN "reconcileAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN "lastReconcileAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "nextReconcileAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "reconcileSource" "ReconcileSource";

-- CreateIndex: For efficient backoff queries
CREATE INDEX "payments_status_nextReconcileAt_idx" ON "payments"("status", "nextReconcileAt");
