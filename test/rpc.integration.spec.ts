import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { api } from '@cityofzion/dora-ts';
import type {
  CsvTxRow,
  DoraBlock,
  DoraLog,
  DoraTransaction,
  DoraTransactionDetails,
  RecentTransactionSample,
} from './rpc.integration.types';

dotenv.config();

const dayCsvHeader = [
  'day_label',
  'txid',
  'block_index',
  'transfer_count',
  'timestamp_utc',
  'type',
  'method',
  'contract',
];

const doraApiUrls = Array.from(
  new Set([process.env.DORA_API_URL, 'https://api.coz.io'].filter((url): url is string => Boolean(url))),
);

const doraClients = doraApiUrls.map((url) => new api.NeoRESTApi({ url, endpoint: '/api/v2/neo3' }));

const network = (process.env.NEO_NETWORK ?? 'MainNet').toLowerCase().includes('test')
  ? 'testnet'
  : 'mainnet';

const shouldRun = process.env.REAL_DORA_TEST === 'true';
const describeDora = shouldRun ? describe : describe.skip;
const shouldRunCsv = process.env.REAL_DORA_CSV_TEST === 'true';
const describeDoraCsv = shouldRunCsv ? describe : describe.skip;

const isHexScript = (value: string): boolean => {
  return /^(0x)?[0-9a-f]+$/i.test(value);
};

const isBase64Script = (value: string): boolean => {
  if (!value || value.length % 4 !== 0) {
    return false;
  }

  return /^[A-Za-z0-9+/]+=*$/.test(value);
};

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const withRetry = async <T>(action: () => Promise<T>): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await action();

      return result;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await sleep(250 * (attempt + 1));
      }
    }
  }

  throw lastError;
};

const fetchBlockWithRetry = async (client: api.NeoRESTApi, blockIndex: number): Promise<DoraBlock> => {
  const block = await withRetry(async () => {
    return (await client.block(blockIndex, network)) as DoraBlock;
  });

  return block;
};

const fetchTransactionWithRetry = async (
  client: api.NeoRESTApi,
  txid: string,
): Promise<DoraTransactionDetails> => {
  const transaction = await withRetry(async () => {
    return (await client.transaction(txid, network)) as DoraTransactionDetails;
  });

  return transaction;
};

const fetchLogWithRetry = async (client: api.NeoRESTApi, txid: string): Promise<DoraLog> => {
  const log = await withRetry(async () => {
    return (await client.log(txid, network)) as DoraLog;
  });

  return log;
};

const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      const next = index + 1 < line.length ? line[index + 1] : '';
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);

  return values;
};

const toNumberOrNull = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid numeric value in CSV: ${value}`);
  }

  return numeric;
};

const parseDayCsv = (csvPath: string): CsvTxRow[] => {
  const content = readFileSync(csvPath, 'utf8');
  const trimmed = content.trim();
  if (!trimmed) {
    return [];
  }

  const lines = trimmed.split(/\r?\n/);
  const header = parseCsvLine(lines[0]);
  if (header.length !== dayCsvHeader.length) {
    throw new Error(`Unexpected header length in ${csvPath}.`);
  }

  for (let index = 0; index < dayCsvHeader.length; index += 1) {
    if (header[index] !== dayCsvHeader[index]) {
      throw new Error(`Unexpected header in ${csvPath}: ${lines[0]}`);
    }
  }

  const rows: CsvTxRow[] = [];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex].trim();
    if (!line) {
      continue;
    }

    const columns = parseCsvLine(line);
    if (columns.length !== dayCsvHeader.length) {
      throw new Error(`Invalid CSV row at line ${lineIndex + 1} in ${csvPath}.`);
    }

    const row: CsvTxRow = {
      dayLabel: columns[0],
      txid: columns[1],
      blockIndex: toNumberOrNull(columns[2]),
      transferCount: Number(columns[3]),
      timestampUtc: columns[4],
      type: columns[5],
      method: columns[6],
      contract: columns[7],
    };
    if (!Number.isFinite(row.transferCount)) {
      throw new Error(`Invalid transfer_count at line ${lineIndex + 1} in ${csvPath}.`);
    }

    rows.push(row);
  }

  return rows;
};

const deterministicSample = <T>(rows: T[], targetCount: number): T[] => {
  if (targetCount >= rows.length) {
    return rows.slice();
  }

  const sample: T[] = [];
  const step = rows.length / targetCount;
  for (let index = 0; index < targetCount; index += 1) {
    const rowIndex = Math.floor(index * step);
    sample.push(rows[rowIndex]);
  }

  return sample;
};

const findRecentTransactionWithScript = async (
  client: api.NeoRESTApi,
  latestIndex: number,
): Promise<RecentTransactionSample | null> => {
  for (let offset = 0; offset < 80; offset += 1) {
    const index = latestIndex - offset;
    if (index < 0) {
      break;
    }

    const block = await fetchBlockWithRetry(client, index);
    const transactions = block.tx ?? block.transactions ?? [];
    const transaction = transactions.find((candidate) => {
      if (typeof candidate.script !== 'string') {
        return false;
      }

      return candidate.script.trim().length > 0;
    });
    if (transaction) {
      return { block, tx: transaction };
    }
  }

  return null;
};

describeDora('Dora API integration', () => {
  jest.setTimeout(20000);

  it('responds to height on configured Dora endpoints', async () => {
    for (const client of doraClients) {
      const response = await client.height(network);

      expect(response.height).toBeGreaterThan(0);
    }
  });

  it('responds to blocks endpoint with summary fields', async () => {
    for (const client of doraClients) {
      const response = await client.blocks(1, network);

      expect(Array.isArray(response.items)).toBe(true);
      expect(response.items.length).toBeGreaterThan(0);
      expect(Number(response.items[0].index)).toBeGreaterThanOrEqual(0);
      expect(response.items[0].time).toBeDefined();
    }
  });

  it('responds to block/log endpoints with parser-critical payload shapes', async () => {
    for (const client of doraClients) {
      const heightResponse = await client.height(network);
      const latestIndex = Number(heightResponse.height) - 1;
      const sample = await findRecentTransactionWithScript(client, latestIndex);

      expect(sample).toBeTruthy();
      if (!sample) {
        continue;
      }

      const script = sample.tx.script?.replace(/\s+/g, '') ?? '';
      expect(isHexScript(script) || isBase64Script(script)).toBe(true);

      const log = await fetchLogWithRetry(client, sample.tx.hash);

      expect(log.txid.toLowerCase()).toBe(sample.tx.hash.toLowerCase());
      expect(Array.isArray(log.notifications)).toBe(true);
      expect(log.notifications.length).toBeGreaterThan(0);

      const notification = log.notifications[0];
      const hasEventName =
        typeof notification.event_name === 'string' || typeof notification.eventname === 'string';
      const hasArrayState = Array.isArray(notification.state);
      const hasObjectState =
        typeof notification.state === 'object' &&
        notification.state !== null &&
        !Array.isArray(notification.state);

      expect(hasEventName).toBe(true);
      expect(hasArrayState || hasObjectState).toBe(true);
    }
  });
});

describeDoraCsv('Dora API integration with one-day CSV export', () => {
  jest.setTimeout(300000);

  let rows: CsvTxRow[] = [];
  let dayLabel = '';

  beforeAll(async () => {
    const csvPath = join(process.cwd(), 'test', 'fixtures', 'dora_day_transactions.csv');
    rows = parseDayCsv(csvPath);
    if (rows.length > 0) {
      dayLabel = rows[0].dayLabel;
    }
  });

  it('loads one-day CSV rows', () => {
    const expectedDay = process.env.REAL_DORA_CSV_DAY ?? '2026-02-18';

    expect(rows.length).toBeGreaterThan(0);
    expect(dayLabel).toBe(expectedDay);

    for (const row of rows) {
      expect(row.dayLabel).toBe(expectedDay);
      expect(row.txid).toMatch(/^0x[0-9a-f]{64}$/i);
      expect(Number.isFinite(row.transferCount)).toBe(true);
      expect(row.transferCount).toBeGreaterThanOrEqual(0);
      expect(row.timestampUtc).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(row.type.length).toBeGreaterThan(0);
    }
  });

  it('validates all day rows against Dora block transactions', async () => {
    const client = doraClients[0];
    expect(client).toBeDefined();
    if (!client) {
      return;
    }

    const withBlockIndex = rows.filter((row) => row.blockIndex !== null);
    expect(withBlockIndex.length).toBeGreaterThan(0);

    const expectedByBlock = new Map<number, CsvTxRow[]>();
    for (const row of withBlockIndex) {
      const blockIndex = row.blockIndex as number;
      const existing = expectedByBlock.get(blockIndex);
      if (existing) {
        existing.push(row);
      } else {
        expectedByBlock.set(blockIndex, [row]);
      }
    }

    for (const [blockIndex, blockRows] of expectedByBlock.entries()) {
      const block = await fetchBlockWithRetry(client, blockIndex);
      const transactions = block.tx ?? block.transactions ?? [];
      const byHash = new Map<string, DoraTransaction>();
      for (const transaction of transactions) {
        byHash.set(transaction.hash.toLowerCase(), transaction);
      }

      for (const row of blockRows) {
        const chainTx = byHash.get(row.txid.toLowerCase());
        expect(chainTx).toBeDefined();
        if (!chainTx) {
          continue;
        }

        const script = chainTx.script?.replace(/\s+/g, '') ?? '';
        expect(script.length).toBeGreaterThan(0);
        expect(isHexScript(script) || isBase64Script(script)).toBe(true);
      }
    }
  });

  it('validates deterministic samples from the day via Dora transaction/log', async () => {
    const client = doraClients[0];
    expect(client).toBeDefined();
    if (!client) {
      return;
    }

    const candidates = rows.filter((row) => row.blockIndex !== null && row.transferCount > 0);
    expect(candidates.length).toBeGreaterThan(0);

    const sampleSize = Number(process.env.REAL_DORA_CSV_SAMPLE_SIZE ?? '60');
    const sampleRows = deterministicSample(candidates, Math.min(sampleSize, candidates.length));

    for (const row of sampleRows) {
      const transaction = await fetchTransactionWithRetry(client, row.txid);
      expect(transaction.hash.toLowerCase()).toBe(row.txid.toLowerCase());
      expect(Number(transaction.block)).toBe(row.blockIndex as number);

      const script = transaction.script?.replace(/\s+/g, '') ?? '';
      expect(script.length).toBeGreaterThan(0);
      expect(isHexScript(script) || isBase64Script(script)).toBe(true);

      const log = await fetchLogWithRetry(client, row.txid);
      expect(log.txid.toLowerCase()).toBe(row.txid.toLowerCase());
      expect(Array.isArray(log.notifications)).toBe(true);
      expect(log.notifications.length).toBeGreaterThan(0);

      const hasEventName = log.notifications.some((notification) => {
        return (
          typeof notification.event_name === 'string' ||
          typeof notification.eventname === 'string'
        );
      });
      expect(hasEventName).toBe(true);
    }
  });
});
