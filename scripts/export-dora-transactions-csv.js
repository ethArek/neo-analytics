require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const dayTxHeader = [
  'day_label',
  'txid',
  'block_index',
  'transfer_count',
  'timestamp_utc',
  'type',
  'method',
  'contract',
];

const escapeCsv = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  const needsQuotes =
    text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r');
  if (needsQuotes) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

const toCsvLine = (values) => {
  return values.map(escapeCsv).join(',');
};

const writeCsv = (filePath, header, rows) => {
  const lines = [toCsvLine(header)];
  for (const row of rows) {
    lines.push(toCsvLine(row));
  }

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
};

const run = async () => {
  const targetDay = process.argv[2] ?? process.env.DORA_EXPORT_DAY ?? '2026-02-18';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDay)) {
    throw new Error(`Invalid date format: ${targetDay}. Use YYYY-MM-DD.`);
  }

  const connectionString = process.env.NEO_DATABASE_URL;
  if (!connectionString) {
    throw new Error('NEO_DATABASE_URL is required.');
  }

  const client = new Client({ connectionString });
  await client.connect();

  let dayTxResult;
  try {
    dayTxResult = await client.query(
      `
      select
        to_char(timestamp at time zone 'UTC', 'YYYY-MM-DD') as day_label,
        txid,
        "blockIndex" as block_index,
        "transferCount" as transfer_count,
        to_char(timestamp at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as timestamp_utc,
        type::text as type,
        coalesce(method, '') as method,
        coalesce(contract, '') as contract
      from "DailyTx"
      where to_char(timestamp at time zone 'UTC', 'YYYY-MM-DD') = $1
      order by "blockIndex" asc nulls last, timestamp asc
    `,
      [targetDay],
    );
  } finally {
    await client.end();
  }

  if (dayTxResult.rowCount === 0) {
    throw new Error(`No DailyTx rows found for UTC day ${targetDay}.`);
  }

  const outDir = path.join(process.cwd(), 'test', 'fixtures');
  fs.mkdirSync(outDir, { recursive: true });

  const dayTxPath = path.join(outDir, 'dora_day_transactions.csv');

  const dayTxRows = dayTxResult.rows.map((row) => {
    return [
      row.day_label,
      row.txid,
      row.block_index,
      row.transfer_count,
      row.timestamp_utc,
      row.type,
      row.method,
      row.contract,
    ];
  });

  writeCsv(dayTxPath, dayTxHeader, dayTxRows);

  console.log(`CSV exported: ${dayTxPath}`);
  console.log(`UTC day: ${targetDay}`);
  console.log(`Rows: ${dayTxRows.length}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
