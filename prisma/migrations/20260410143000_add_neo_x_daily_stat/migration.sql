CREATE TABLE "NeoXDailyStat" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "txCount" INTEGER NOT NULL DEFAULT 0,
    "transactionsToday" INTEGER,
    "totalAddresses" INTEGER,
    "totalBlocks" INTEGER,
    "totalTransactions" INTEGER,
    "averageBlockTimeMs" DECIMAL(20,3),
    "averageGasPriceGwei" DECIMAL(20,9),
    "gasUsedToday" DECIMAL(78,0),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NeoXDailyStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NeoXDailyStat_date_key" ON "NeoXDailyStat"("date");
CREATE INDEX "NeoXDailyStat_date_idx" ON "NeoXDailyStat"("date");
