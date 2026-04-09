const NEO_N3_STABLECOIN_SYMBOLS = new Set(['FUSD', 'USDT', 'USDC']);

export const normalizeHash = (value?: string): string => {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('0x')) {
    return normalized;
  }

  return `0x${normalized}`;
};

export const normalizeSymbol = (value: string): string => {
  return value.trim().toUpperCase();
};

export const normalizeMethod = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.toLowerCase();
};

export const normalizeContract = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('0x')) {
    return lower;
  }

  return `0x${lower}`;
};

export const normalizeAsset = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
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

export const normalizeAddress = (value?: string): string | undefined => {
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

export const isStablecoinSymbol = (symbol: string): boolean => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return false;
  }

  return NEO_N3_STABLECOIN_SYMBOLS.has(normalized);
};
