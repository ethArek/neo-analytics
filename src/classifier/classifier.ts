import { normalizeHash } from '../common/hash.utils';
import type { NeoTransaction } from '../neo-client/neo-client.interface';
import type { ClassifiedResult, ClassifierConfig } from './classifier.types';

export enum ClassifiedType {
  SWAP = 'SWAP',
  ORACLE = 'ORACLE',
  NORMAL_TRANSFER = 'NORMAL_TRANSFER',
  GAS_CLAIM = 'GAS_CLAIM',
  IGNORED = 'IGNORED',
}

const normalize = (value?: string) => value?.trim().toLowerCase() ?? '';

export const defaultSwapMethods = [
  'swap',
  'swaptoken',
  'swaptokens',
  'swapexacttokens',
  'swaptokensforexacttokens',
  'swapexacttokensfortokens',
];

export const defaultSwapContracts = [
  '0xec268e9c642b7d09d10fe658bcb1cc63c0895d4d',
  '0xca2d20610d7982ebe0bed124ee7e9b2d580a6efc',
  '0x3244fcadcccff190c329f7b3083e4da2af60fbce',
  '0xde3a4b093abbd07e9a69cdec88a54d9a1fe14975',
];

export const defaultOracleContracts = [
  '0x017520f068fd602082fe5572596185e62a4ad991',
  '0x03013f49c42a14546c8bbe58f9d434c3517fccab',
];

const swapContractAllowlist = new Set(
  defaultSwapContracts.map((contract) => normalizeHash(contract)),
);
const oracleContractAllowlist = new Set(
  defaultOracleContracts.map((contract) => normalizeHash(contract)),
);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isAllowlistedSwapContract = (contract?: string): boolean => {
  return swapContractAllowlist.has(normalizeHash(contract));
};

const isAllowlistedOracleContract = (contract?: string): boolean => {
  return oracleContractAllowlist.has(normalizeHash(contract));
};

const getNotificationEventName = (notification: Record<string, unknown>): string | null => {
  const legacyEventName = notification.eventname;
  if (typeof legacyEventName === 'string') {
    return legacyEventName;
  }

  const doraEventName = notification.event_name;
  if (typeof doraEventName === 'string') {
    return doraEventName;
  }

  return null;
};

const getNotifications = (applicationLog: Record<string, unknown>): Record<string, unknown>[] => {
  const notifications: Record<string, unknown>[] = [];
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

const getSwapContractNotification = (raw: Record<string, unknown>): string | null => {
  const applicationLog = raw.applicationLog;
  if (!isRecord(applicationLog)) {
    return null;
  }

  const notifications = getNotifications(applicationLog);
  for (const notification of notifications) {
    const contract = notification.contract;
    if (typeof contract !== 'string') {
      continue;
    }

    if (isAllowlistedSwapContract(contract)) {
      return contract;
    }
  }

  return null;
};

const getDexNotificationName = (raw: Record<string, unknown>): string | null => {
  const applicationLog = raw.applicationLog;
  if (!isRecord(applicationLog)) {
    return null;
  }

  const notifications = getNotifications(applicationLog);
  for (const notification of notifications) {
    const eventName = getNotificationEventName(notification);
    if (!eventName) {
      continue;
    }

    const normalized = normalize(eventName);
    if (
      normalized === 'swapped' ||
      normalized === 'orderupdated' ||
      normalized === 'orderupserted'
    ) {
      return eventName;
    }
  }

  return null;
};

const isOracleNotificationName = (eventName: string): boolean => {
  const normalized = normalize(eventName);
  if (normalized === 'feedupdated') {
    return true;
  }

  return normalized.startsWith('oracle');
};

const getOracleNotification = (
  raw: Record<string, unknown>,
): { contract?: string; eventName?: string } | null => {
  const applicationLog = raw.applicationLog;
  if (!isRecord(applicationLog)) {
    return null;
  }

  const notifications = getNotifications(applicationLog);
  for (const notification of notifications) {
    const eventName = getNotificationEventName(notification) ?? undefined;
    const contract = typeof notification.contract === 'string' ? notification.contract : undefined;
    if (eventName && isOracleNotificationName(eventName)) {
      return {
        contract,
        eventName,
      };
    }

    if (contract && isAllowlistedOracleContract(contract)) {
      return {
        contract,
        eventName,
      };
    }
  }

  return null;
};

export const classifyTransaction = (
  tx: NeoTransaction,
  config: ClassifierConfig,
): ClassifiedResult => {
  const invocation = tx.invocation;
  const transfers = tx.transfers ?? [];
  const raw = tx.raw;

  if (isAllowlistedSwapContract(invocation?.contract)) {
    return {
      type: ClassifiedType.SWAP,
      from: transfers[0]?.from,
      to: transfers[0]?.to,
      reason: `Detected swap: called known swap contract (${invocation?.contract}).`,
    };
  }

  if (invocation) {
    const method = normalize(invocation.method);
    const allowlist = new Set(config.swapMethodAllowlist.map(normalize));
    const isSwapMethod = allowlist.has(method);

    if (isSwapMethod && transfers.length >= 2) {
      return {
        type: ClassifiedType.SWAP,
        from: transfers[0]?.from,
        to: transfers[0]?.to,
        reason: 'Detected swap: multiple transfers with swap method invocation.',
      };
    }
  }

  if (isAllowlistedOracleContract(invocation?.contract)) {
    return {
      type: ClassifiedType.ORACLE,
      from: transfers[0]?.from,
      to: transfers[0]?.to,
      reason: `Detected oracle transaction: called known oracle contract (${invocation?.contract}).`,
    };
  }

  if (isRecord(raw)) {
    const swapContract = getSwapContractNotification(raw);
    if (swapContract) {
      return {
        type: ClassifiedType.SWAP,
        from: transfers[0]?.from,
        to: transfers[0]?.to,
        reason: `Detected swap: notification from known swap contract (${swapContract}).`,
      };
    }

    const dexNotification = getDexNotificationName(raw);
    if (dexNotification) {
      return {
        type: ClassifiedType.SWAP,
        from: transfers[0]?.from,
        to: transfers[0]?.to,
        reason: `Detected swap: dex notification (${dexNotification}).`,
      };
    }

    const oracleNotification = getOracleNotification(raw);
    if (oracleNotification) {
      const eventLabel = oracleNotification.eventName
        ? `${oracleNotification.eventName} notification`
        : 'notification';
      const contractLabel = oracleNotification.contract
        ? ` from ${oracleNotification.contract}`
        : '';

      return {
        type: ClassifiedType.ORACLE,
        from: transfers[0]?.from,
        to: transfers[0]?.to,
        reason: `Detected oracle transaction: ${eventLabel}${contractLabel}.`,
      };
    }
  }

  // Detect gas claim based on transaction data:
  // - GAS transfer with no 'from' address (or undefined/null)
  // - This pattern indicates GAS being distributed from the system
  const gasClaimTransfer = transfers.find(
    (transfer) => transfer.asset === 'GAS' && (!transfer.from || transfer.from.trim() === ''),
  );
  if (gasClaimTransfer?.to) {
    return {
      type: ClassifiedType.GAS_CLAIM,
      from: gasClaimTransfer.from,
      to: gasClaimTransfer.to,
      reason: 'Detected GAS claim: GAS transfer with no from address.',
    };
  }

  const primaryTransfer = transfers[0];
  if (primaryTransfer) {
    const from = primaryTransfer.from;
    const to = primaryTransfer.to;
    const amount = primaryTransfer.amount ? Number(primaryTransfer.amount) : undefined;

    if (from && to && normalize(from) === normalize(to)) {
      return {
        type: ClassifiedType.IGNORED,
        from,
        to,
        reason: 'Self-transfer excluded from totals.',
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
      reason: 'Transfer matched.',
    };
  }

  return {
    type: ClassifiedType.IGNORED,
    reason: 'No matching swap, oracle, gas claim, or transfer.',
  };
};
