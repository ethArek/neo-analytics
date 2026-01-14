import { NeoTransaction } from '../neo-client/neo-client.interface';

export enum ClassifiedType {
  SWAP = 'SWAP',
  NORMAL_TRANSFER = 'NORMAL_TRANSFER',
  GAS_CLAIM = 'GAS_CLAIM',
  IGNORED = 'IGNORED',
  OTHER = 'OTHER',
}

export type ClassifierConfig = {
  swapMethodAllowlist: string[];
};

export type ClassifiedResult = {
  type: ClassifiedType;
  from?: string;
  to?: string;
  reason: string;
};

const normalize = (value?: string) => value?.toLowerCase() ?? '';

export const defaultSwapMethods = [
  'swap',
  'swaptoken',
  'swaptokens',
  'swapexacttokens',
  'swaptokensforexacttokens',
  'swapexacttokensfortokens',
];

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const getDexNotificationName = (raw: Record<string, unknown>): string | null => {
  const applicationLog = raw.applicationLog;
  if (!isRecord(applicationLog)) {

    return null;
  }

  const executions = applicationLog.executions;
  if (!Array.isArray(executions)) {

    return null;
  }

  for (const execution of executions) {
    if (!isRecord(execution)) {
      continue;
    }

    const notifications = execution.notifications;
    if (!Array.isArray(notifications)) {
      continue;
    }

    for (const notification of notifications) {
      if (!isRecord(notification)) {
        continue;
      }

      const eventName = notification.eventname;
      if (typeof eventName !== 'string') {
        continue;
      }

      const normalized = normalize(eventName);
      if (normalized === 'swapped' || normalized === 'orderupdated') {

        return eventName;
      }
    }
  }

  return null;
};

export const classifyTransaction = (
  tx: NeoTransaction,
  config: ClassifierConfig,
): ClassifiedResult => {
  const transfers = tx.transfers ?? [];
  void config;

  const raw = tx.raw;
  if (isRecord(raw)) {
    const dexNotification = getDexNotificationName(raw);
    if (dexNotification) {
      return {
        type: ClassifiedType.SWAP,
        from: transfers[0]?.from,
        to: transfers[0]?.to,
        reason: `Detected swap: dex notification (${dexNotification}).`,
      };
    }
  }

  // Detect gas claim based on transaction data:
  // - GAS transfer with no 'from' address (or undefined/null)
  // - This pattern indicates GAS being distributed from the system
  const gasClaimTransfer = transfers.find(
    (transfer) => transfer.asset === 'GAS' && (!transfer.from || transfer.from.trim() === ''),
  );
  if (gasClaimTransfer && gasClaimTransfer.to) {
    return {
      type: ClassifiedType.GAS_CLAIM,
      from: gasClaimTransfer.from,
      to: gasClaimTransfer.to,
      reason: 'Detected GAS claim: GAS transfer with no from address.',
    };
  }

  const primaryTransfer = transfers.find((transfer) => transfer.asset === 'NEO' || transfer.asset === 'GAS')
    ?? transfers[0];
  if (primaryTransfer) {
    const from = primaryTransfer.from;
    const to = primaryTransfer.to;
    const amountText = primaryTransfer.amount?.trim();
    const amount =
      amountText && amountText !== '' && /^-?\d+(\.\d+)?$/.test(amountText)
        ? Number(amountText)
        : undefined;

    if (from && to && normalize(from) === normalize(to)) {
      return {
        type: ClassifiedType.IGNORED,
        from,
        to,
        reason: 'Self-transfer excluded from real usage.',
      };
    }

    if (amount !== undefined && amount <= 0) {
      return {
        type: ClassifiedType.IGNORED,
        from,
        to,
        reason: 'Zero-amount transfer ignored.',
      };
    }

    return {
      type: ClassifiedType.NORMAL_TRANSFER,
      from,
      to,
      reason: 'NEP-17 transfer matched.',
    };
  }

  return {
    type: ClassifiedType.OTHER,
    reason: 'No matching swap, gas claim, or transfer.',
  };
};
