export const formatUnits = (value: bigint, decimals: number): string => {
  if (decimals === 0) {
    return value.toString();
  }

  const base = 10n ** BigInt(decimals);
  const integer = value / base;
  const fraction = value % base;
  const fractionText = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  if (!fractionText) {
    return integer.toString();
  }

  return `${integer.toString()}.${fractionText}`;
};

export const toNumber = (value: bigint, decimals = 0): number => {
  const factor = 10 ** decimals;

  return Number(value) / factor;
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value);
};
