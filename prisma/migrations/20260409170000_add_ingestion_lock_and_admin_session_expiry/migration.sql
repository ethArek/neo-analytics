ALTER TABLE "AdminUser"
ADD COLUMN "sessionExpiresAt" TIMESTAMP(3);

CREATE TABLE "IngestionLock" (
    "id" SERIAL NOT NULL,
    "lockKey" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IngestionLock_lockKey_key" ON "IngestionLock"("lockKey");
CREATE INDEX "IngestionLock_expiresAt_idx" ON "IngestionLock"("expiresAt");
