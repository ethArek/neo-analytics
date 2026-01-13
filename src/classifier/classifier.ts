import { NeoTransaction } from '../neo-client/neo-client.interface';

export enum ClassifiedType {
  SWAP = 'SWAP',
  NORMAL_TRANSFER = 'NORMAL_TRANSFER',
  GAS_CLAIM = 'GAS_CLAIM',
  IGNORED = 'IGNORED',
}

export type ClassifierConfig = {
  swapMethodAllowlist: string[];
  gasClaimContracts: string[];
};

export type ClassifiedResult = {
  type: ClassifiedType;
  from?: string;
  to?: string;
  reason: string;
};

const normalize = (value?: string) => value?.toLowerCase() ?? '';

export const defaultSwapMethods = ['swap', 'swaptoken', 'swapTokens', 'swapExactTokens'];

export const classifyTransaction = (
  tx: NeoTransaction,
  config: ClassifierConfig,
): ClassifiedResult => {
  const invocation = tx.invocation;
  const transfers = tx.transfers ?? [];
  const normalizedGasContracts = config.gasClaimContracts.map(normalize);

  if (invocation) {
    const contract = normalize(invocation.contract);
    const method = normalize(invocation.method);
    const isSwapMethod = config.swapMethodAllowlist.map(normalize).includes(method);

    // Detect swap based on transaction data:
    // - Has a swap-like method invocation
    // - Has multiple transfers (typically 2+, representing the token exchange)
    if (isSwapMethod && transfers.length >= 2) {
      return {
        type: ClassifiedType.SWAP,
        from: transfers[0]?.from,
        to: transfers[0]?.to,
        reason: 'Detected swap: multiple transfers with swap method invocation.',
      };
    }

    if (normalizedGasContracts.includes(contract)) {
      return {
        type: ClassifiedType.GAS_CLAIM,
        from: transfers[0]?.from,
        to: transfers[0]?.to,
        reason: 'Matched known GAS claim contract.',
      };
    }
  }

  const primaryTransfer = transfers.find((transfer) => transfer.asset === 'NEO' || transfer.asset === 'GAS');
  if (primaryTransfer) {
    const from = primaryTransfer.from;
    const to = primaryTransfer.to;
    const amount = primaryTransfer.amount ? Number(primaryTransfer.amount) : undefined;

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
      reason: 'Native transfer matched.',
    };
  }

  return {
    type: ClassifiedType.IGNORED,
    reason: 'No matching swap, gas claim, or transfer.',
  };
};
