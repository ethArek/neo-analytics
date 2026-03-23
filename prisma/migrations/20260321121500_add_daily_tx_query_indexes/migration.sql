CREATE INDEX "DailyTx_date_type_idx" ON "DailyTx"("date", "type");

CREATE INDEX "DailyTx_date_type_asset_idx" ON "DailyTx"("date", "type", "asset");

CREATE INDEX "DailyTx_date_type_from_idx" ON "DailyTx"("date", "type", "from");

CREATE INDEX "DailyTx_date_type_to_idx" ON "DailyTx"("date", "type", "to");

CREATE INDEX "DailyTx_date_type_timestamp_idx" ON "DailyTx"("date", "type", "timestamp");

CREATE INDEX "DailyTx_date_type_swapUsdValue_idx" ON "DailyTx"("date", "type", "swapUsdValue");
