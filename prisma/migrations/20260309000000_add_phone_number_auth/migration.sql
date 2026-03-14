-- AlterTable: make facebookId optional and add phoneNumber
ALTER TABLE "users" ALTER COLUMN "facebookId" DROP NOT NULL;

-- AddColumn
ALTER TABLE "users" ADD COLUMN "phoneNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_phoneNumber_key" ON "users"("phoneNumber");
