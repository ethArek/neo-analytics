-- Alter BIGINT raw amount columns to DECIMAL(78,0) to support NEP-17 amounts beyond int64.

ALTER TABLE "DailyTx"
ALTER COLUMN "amountRaw" TYPE DECIMAL(78, 0)
USING "amountRaw"::DECIMAL(78, 0);

ALTER TABLE "DailyTransfer"
ALTER COLUMN "amountRaw" TYPE DECIMAL(78, 0)
USING "amountRaw"::DECIMAL(78, 0);

ALTER TABLE "DailyAssetStat"
ALTER COLUMN "volumeRaw" TYPE DECIMAL(78, 0)
USING "volumeRaw"::DECIMAL(78, 0);

ALTER TABLE "DailyStat"
ALTER COLUMN "neoVolumeRaw" TYPE DECIMAL(78, 0)
USING "neoVolumeRaw"::DECIMAL(78, 0);

ALTER TABLE "DailyStat"
ALTER COLUMN "gasVolumeRaw" TYPE DECIMAL(78, 0)
USING "gasVolumeRaw"::DECIMAL(78, 0);

