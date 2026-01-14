-- CreateEnum
CREATE TYPE "TxType" AS ENUM ('SWAP', 'NORMAL_TRANSFER', 'GAS_CLAIM', 'IGNORED');

-- CreateTable
CREATE TABLE "DailyStat" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalTxCount" INTEGER NOT NULL DEFAULT 0,
    "swapsCount" INTEGER NOT NULL DEFAULT 0,
    "transfersCount" INTEGER NOT NULL DEFAULT 0,
    "gasClaimsCount" INTEGER NOT NULL DEFAULT 0,
    "ignoredCount" INTEGER NOT NULL DEFAULT 0,
    "realUsageTotal" INTEGER NOT NULL DEFAULT 0,
    "totalTransfers" INTEGER NOT NULL DEFAULT 0,
    "uniqueSenders" INTEGER NOT NULL DEFAULT 0,
    "uniqueReceivers" INTEGER NOT NULL DEFAULT 0,
    "uniqueAddresses" INTEGER NOT NULL DEFAULT 0,
    "neoVolumeRaw" BIGINT NOT NULL DEFAULT 0,
    "gasVolumeRaw" BIGINT NOT NULL DEFAULT 0,
    "blockCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTx" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "txid" TEXT NOT NULL,
    "type" "TxType" NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "asset" TEXT,
    "amountRaw" BIGINT,
    "transferCount" INTEGER NOT NULL DEFAULT 0,
    "method" TEXT,
    "contract" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "blockIndex" INTEGER,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyTx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTransfer" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "txid" TEXT NOT NULL,
    "transferIndex" INTEGER NOT NULL,
    "asset" TEXT NOT NULL,
    "amountRaw" BIGINT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAssetStat" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "asset" TEXT NOT NULL,
    "transferCount" INTEGER NOT NULL DEFAULT 0,
    "txCount" INTEGER NOT NULL DEFAULT 0,
    "uniqueSenders" INTEGER NOT NULL DEFAULT 0,
    "uniqueReceivers" INTEGER NOT NULL DEFAULT 0,
    "volumeRaw" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyAssetStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMethodStat" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "txCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyMethodStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyContractStat" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "contract" TEXT NOT NULL,
    "txCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyContractStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionCursor" (
    "id" SERIAL NOT NULL,
    "network" TEXT NOT NULL,
    "lastProcessedBlock" INTEGER,
    "lastProcessedTimestamp" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyStat_date_key" ON "DailyStat"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTx_txid_key" ON "DailyTx"("txid");

-- CreateIndex
CREATE INDEX "DailyTx_date_idx" ON "DailyTx"("date");

-- CreateIndex
CREATE INDEX "DailyTransfer_date_idx" ON "DailyTransfer"("date");

-- CreateIndex
CREATE INDEX "DailyTransfer_asset_idx" ON "DailyTransfer"("asset");

-- CreateIndex
CREATE INDEX "DailyTransfer_from_idx" ON "DailyTransfer"("from");

-- CreateIndex
CREATE INDEX "DailyTransfer_to_idx" ON "DailyTransfer"("to");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTransfer_txid_transferIndex_key" ON "DailyTransfer"("txid", "transferIndex");

-- CreateIndex
CREATE INDEX "DailyAssetStat_date_idx" ON "DailyAssetStat"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAssetStat_date_asset_key" ON "DailyAssetStat"("date", "asset");

-- CreateIndex
CREATE INDEX "DailyMethodStat_date_idx" ON "DailyMethodStat"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMethodStat_date_method_key" ON "DailyMethodStat"("date", "method");

-- CreateIndex
CREATE INDEX "DailyContractStat_date_idx" ON "DailyContractStat"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyContractStat_date_contract_key" ON "DailyContractStat"("date", "contract");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionCursor_network_key" ON "IngestionCursor"("network");
