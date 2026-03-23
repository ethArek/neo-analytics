const NEO_N3_STABLECOIN_SYMBOLS = new Set(['FUSD', 'USDT', 'USDC']);

export const normalizeSymbol = (value: string): string => {
  return value.trim().toUpperCase();
};

export const isStablecoinSymbol = (symbol: string): boolean => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return false;
  }

  return NEO_N3_STABLECOIN_SYMBOLS.has(normalized);
};
