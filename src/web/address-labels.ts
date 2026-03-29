const knownAddressLabels = new Map<string, string>([
  ['NUqLhf1p1vQyP2KJjMcEwmdEBPnbCGouVp', 'Binance'],
  ['NTWC7Hh5VYMQ5K8YJbyCLbmJ4RhfQ1Ej64', 'Gate.io'],
]);

export const getAddressLabel = (address?: string | null): string | undefined => {
  const normalizedAddress = address?.trim();
  if (!normalizedAddress) {
    return undefined;
  }

  return knownAddressLabels.get(normalizedAddress);
};
