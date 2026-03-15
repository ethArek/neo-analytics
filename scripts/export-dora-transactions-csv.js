require('dotenv').config();
require('ts-node/register/transpile-only');

const fs = require('fs');
const path = require('path');
const { Logger } = require('@nestjs/common');
const { RpcNeoClient } = require('../src/neo-client/neo-client.service');
const {
  ClassifiedType,
  classifyTransaction,
  defaultSwapMethods,
} = require('../src/classifier/classifier');

const dayTxHeader = [
  'day_label',
  'txid',
  'block_index',
  'timestamp_utc',
  'type',
  'classification_reason',
  'transfer_count',
  'from',
  'to',
  'primary_asset',
  'primary_amount_raw',
  'method',
  'contract',
  'notification_names',
  'notification_contracts',
  'transfers',
];

const parseArgs = (argv) => {
  const parsed = {
    day: process.env.DORA_EXPORT_DAY,
    from: process.env.DORA_EXPORT_FROM,
    to: process.env.DORA_EXPORT_TO,
    out: process.env.DORA_EXPORT_OUT,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg.startsWith('--out=')) {
      parsed.out = arg.slice('--out='.length);
      continue;
    }

    if (arg === '--out') {
      const nextArg = argv[index + 1];
      if (!nextArg) {
        throw new Error('Missing value for --out.');
      }

      parsed.out = nextArg;
      index += 1;
      continue;
    }

    if (arg.startsWith('--from=')) {
      parsed.from = arg.slice('--from='.length);
      continue;
    }

    if (arg === '--from') {
      const nextArg = argv[index + 1];
      if (!nextArg) {
        throw new Error('Missing value for --from.');
      }

      parsed.from = nextArg;
      index += 1;
      continue;
    }

    if (arg.startsWith('--to=')) {
      parsed.to = arg.slice('--to='.length);
      continue;
    }

    if (arg === '--to') {
      const nextArg = argv[index + 1];
      if (!nextArg) {
        throw new Error('Missing value for --to.');
      }

      parsed.to = nextArg;
      index += 1;
      continue;
    }

    if (!parsed.day) {
      parsed.day = arg;
      continue;
    }

    throw new Error(`Unexpected argument: ${arg}`);
  }

  return parsed;
};

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

const createConfigService = () => {
  const values = {
    app: {
      neoNetwork: process.env.NEO_NETWORK ?? 'MainNet',
      doraApiUrls: [process.env.DORA_API_URL].filter(Boolean),
    },
  };

  return {
    get(key) {
      const parts = key.split('.');
      let current = values;

      for (const part of parts) {
        if (current === null || current === undefined || typeof current !== 'object') {
          return undefined;
        }

        current = current[part];
      }

      return current;
    },
  };
};

const isRecord = (value) => {
  return typeof value === 'object' && value !== null;
};

const getNotifications = (applicationLog) => {
  const notifications = [];
  const executions = applicationLog.executions;
  if (Array.isArray(executions)) {
    for (const execution of executions) {
      if (!isRecord(execution)) {
        continue;
      }

      const nestedNotifications = execution.notifications;
      if (!Array.isArray(nestedNotifications)) {
        continue;
      }

      for (const notification of nestedNotifications) {
        if (!isRecord(notification)) {
          continue;
        }

        notifications.push(notification);
      }
    }
  }

  const topLevelNotifications = applicationLog.notifications;
  if (Array.isArray(topLevelNotifications)) {
    for (const notification of topLevelNotifications) {
      if (!isRecord(notification)) {
        continue;
      }

      notifications.push(notification);
    }
  }

  return notifications;
};

const normalizeMethod = (method) => {
  if (!method) {
    return undefined;
  }

  const trimmed = method.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.toLowerCase();
};

const normalizeContract = (contract) => {
  if (!contract) {
    return undefined;
  }

  const trimmed = contract.trim();
  if (!trimmed) {
    return undefined;
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('0x')) {
    return lower;
  }

  return `0x${lower}`;
};

const normalizeAsset = (asset) => {
  if (!asset) {
    return undefined;
  }

  const trimmed = asset.trim();
  if (!trimmed) {
    return undefined;
  }

  const upper = trimmed.toUpperCase();
  if (upper === 'NEO' || upper === 'GAS') {
    return upper;
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('0x')) {
    return lower;
  }

  return `0x${lower}`;
};

const normalizeAddress = (value) => {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('0x')) {
    return lower;
  }

  return `0x${lower}`;
};

const getPrimaryTransfer = (transfers) => {
  if (transfers.length === 0) {
    return undefined;
  }

  const primary = transfers.find(
    (transfer) => transfer.asset === 'NEO' || transfer.asset === 'GAS',
  );

  return primary ?? transfers[0];
};

const getNotificationSummary = (raw) => {
  if (!isRecord(raw) || !isRecord(raw.applicationLog)) {
    return {
      names: '',
      contracts: '',
    };
  }

  const names = new Set();
  const contracts = new Set();
  const notifications = getNotifications(raw.applicationLog);
  for (const notification of notifications) {
    const eventName =
      typeof notification.eventname === 'string'
        ? notification.eventname
        : typeof notification.event_name === 'string'
          ? notification.event_name
          : '';
    const contract =
      typeof notification.contract === 'string'
        ? (normalizeContract(notification.contract) ?? '')
        : '';

    if (eventName) {
      names.add(eventName);
    }

    if (contract) {
      contracts.add(contract);
    }
  }

  return {
    names: Array.from(names).join('|'),
    contracts: Array.from(contracts).join('|'),
  };
};

const serializeTransfers = (transfers) => {
  const normalizedTransfers = transfers.map((transfer) => {
    return {
      asset: normalizeAsset(transfer.asset) ?? '',
      amountRaw: transfer.amount ?? '',
      from: normalizeAddress(transfer.from) ?? '',
      to: normalizeAddress(transfer.to) ?? '',
    };
  });

  return JSON.stringify(normalizedTransfers);
};

const sanitizeFileLabel = (value) => {
  const collapsed = value.replace(/[:.]/g, '-').replace(/[^\w-]+/g, '_');

  return collapsed.replace(/^_+|_+$/g, '');
};

const resolveOutputPath = (label, out) => {
  if (out) {
    return path.isAbsolute(out) ? out : path.resolve(process.cwd(), out);
  }

  return path.join(process.cwd(), 'exports', `dora-transactions-${sanitizeFileLabel(label)}.csv`);
};

const formatClassificationTypeLabel = (value) => {
  if (value === ClassifiedType.NORMAL_TRANSFER) {
    return 'TRANSFER';
  }

  return value;
};

const formatDuration = (durationMs) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
};

const fetchTransactions = async (neoClient, options, onProgress) => {
  const transactions = [];
  let cursor;
  let blockStart;
  let blockEnd;
  let page = 0;
  const startedAt = Date.now();

  do {
    const pageStartedAt = Date.now();
    const pageCursor = cursor;
    const response =
      options.type === 'range'
        ? await neoClient.fetchTransactionsForRange(options.from, options.to, cursor)
        : await neoClient.fetchTransactionsForDay(options.day, cursor);
    page += 1;
    transactions.push(...response.transactions);
    cursor = response.nextCursor;

    if (blockStart === undefined && response.blockStart !== undefined) {
      blockStart = response.blockStart;
    }

    if (blockEnd === undefined && response.blockEnd !== undefined) {
      blockEnd = response.blockEnd;
    }

    if (onProgress) {
      const pageBlockStart =
        pageCursor !== undefined
          ? Number(pageCursor)
          : response.blockStart !== undefined
            ? response.blockStart
            : undefined;
      const pageBlockEnd = response.lastBlockIndex;
      const totalBlocks =
        blockStart !== undefined && blockEnd !== undefined ? blockEnd - blockStart + 1 : undefined;
      const completedBlocks =
        blockStart !== undefined && pageBlockEnd !== undefined
          ? pageBlockEnd - blockStart + 1
          : undefined;

      onProgress({
        page,
        pageTransactions: response.transactions.length,
        totalTransactions: transactions.length,
        pageBlockStart,
        pageBlockEnd,
        totalBlocks,
        completedBlocks,
        elapsedMs: Date.now() - startedAt,
        pageElapsedMs: Date.now() - pageStartedAt,
        isComplete: !response.nextCursor,
      });
    }
  } while (cursor);

  return {
    transactions,
    blockStart,
    blockEnd,
  };
};

const buildCsvRows = (transactions) => {
  const counts = Object.values(ClassifiedType).reduce((accumulator, value) => {
    accumulator[value] = 0;

    return accumulator;
  }, {});
  const rows = transactions.map((transaction) => {
    const transfers = transaction.transfers ?? [];
    const classification = classifyTransaction(transaction, {
      swapMethodAllowlist: defaultSwapMethods,
    });
    const primaryTransfer = getPrimaryTransfer(transfers);
    const notificationSummary = getNotificationSummary(transaction.raw);

    counts[classification.type] += 1;

    return [
      new Date(transaction.timestamp).toISOString().slice(0, 10),
      transaction.txid,
      transaction.blockIndex ?? '',
      new Date(transaction.timestamp).toISOString(),
      formatClassificationTypeLabel(classification.type),
      classification.reason,
      transfers.length,
      normalizeAddress(classification.from) ?? '',
      normalizeAddress(classification.to) ?? '',
      normalizeAsset(primaryTransfer?.asset) ?? '',
      primaryTransfer?.amount ?? '',
      normalizeMethod(transaction.invocation?.method) ?? '',
      normalizeContract(transaction.invocation?.contract) ?? '',
      notificationSummary.names,
      notificationSummary.contracts,
      serializeTransfers(transfers),
    ];
  });

  return {
    rows,
    counts,
  };
};

const isValidIsoTimestamp = (value) => {
  if (!value) {
    return false;
  }

  return Number.isFinite(Date.parse(value));
};

const resolveFetchMode = (args) => {
  if (args.from || args.to) {
    if (!args.from || !args.to) {
      throw new Error('Both --from and --to are required when exporting a time range.');
    }

    if (args.day) {
      throw new Error('Pass either a UTC day or a --from/--to range, not both.');
    }

    if (!isValidIsoTimestamp(args.from) || !isValidIsoTimestamp(args.to)) {
      throw new Error('Invalid --from/--to format. Use ISO timestamps like 2026-03-13T00:00:00Z.');
    }

    const from = new Date(args.from);
    const to = new Date(args.to);
    if (from.getTime() > to.getTime()) {
      throw new Error('--from must be earlier than or equal to --to.');
    }

    return {
      type: 'range',
      from,
      to,
      label: `${from.toISOString()}-to-${to.toISOString()}`,
    };
  }

  const day = args.day ?? '2026-02-18';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(`Invalid date format: ${day}. Use YYYY-MM-DD.`);
  }

  return {
    type: 'day',
    day,
    label: day,
  };
};

const printUsage = () => {
  console.log('Usage: npm run export:dora-csv -- <YYYY-MM-DD> [--out path/to/file.csv]');
  console.log(
    '   or: npm run export:dora-csv -- --from 2026-03-13T00:00:00Z --to 2026-03-13T00:10:00Z',
  );
  console.log(
    'Env overrides: DORA_EXPORT_DAY, DORA_EXPORT_FROM, DORA_EXPORT_TO, DORA_EXPORT_OUT, DORA_API_URL, NEO_NETWORK',
  );
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  Logger.overrideLogger(false);

  const fetchMode = resolveFetchMode(args);
  const outputPath = resolveOutputPath(fetchMode.label, args.out);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const neoClient = new RpcNeoClient(createConfigService());
  console.log(
    fetchMode.type === 'range'
      ? `Starting Dora export for UTC range ${fetchMode.from.toISOString()} -> ${fetchMode.to.toISOString()}.`
      : `Starting Dora export for UTC day ${fetchMode.day}.`,
  );
  console.log(
    'This can take a while for a full day because the script scans blocks and application logs.',
  );

  const { transactions, blockStart, blockEnd } = await fetchTransactions(
    neoClient,
    fetchMode,
    (progress) => {
      if (!progress.isComplete && progress.page !== 1 && progress.page % 10 !== 0) {
        return;
      }

      const blockLabel =
        progress.pageBlockStart !== undefined && progress.pageBlockEnd !== undefined
          ? `${progress.pageBlockStart}-${progress.pageBlockEnd}`
          : 'unknown';
      const progressLabel =
        progress.completedBlocks !== undefined &&
        progress.totalBlocks !== undefined &&
        progress.totalBlocks > 0
          ? `${progress.completedBlocks}/${progress.totalBlocks} blocks (${(
              (progress.completedBlocks / progress.totalBlocks) * 100
            ).toFixed(1)}%)`
          : 'progress pending';

      console.log(
        `Page ${progress.page}: blocks ${blockLabel}, +${progress.pageTransactions} tx, total ${progress.totalTransactions} tx, ${progressLabel}, page ${formatDuration(progress.pageElapsedMs)}, elapsed ${formatDuration(progress.elapsedMs)}.`,
      );
    },
  );
  if (transactions.length === 0) {
    throw new Error(`No Dora transactions found for ${fetchMode.label}.`);
  }

  const { rows, counts } = buildCsvRows(transactions);
  writeCsv(outputPath, dayTxHeader, rows);

  console.log(`CSV exported: ${outputPath}`);
  if (fetchMode.type === 'range') {
    console.log(`UTC range: ${fetchMode.from.toISOString()} -> ${fetchMode.to.toISOString()}`);
  } else {
    console.log(`UTC day: ${fetchMode.day}`);
  }
  if (blockStart !== undefined && blockEnd !== undefined) {
    console.log(`Blocks: ${blockStart}-${blockEnd}`);
  }
  console.log(`Rows: ${rows.length}`);
  console.log(`SWAP: ${counts[ClassifiedType.SWAP]}`);
  console.log(`ORACLE: ${counts[ClassifiedType.ORACLE]}`);
  console.log(`TRANSFER: ${counts[ClassifiedType.NORMAL_TRANSFER]}`);
  console.log(`GAS_CLAIM: ${counts[ClassifiedType.GAS_CLAIM]}`);
  console.log(`IGNORED: ${counts[ClassifiedType.IGNORED]}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
