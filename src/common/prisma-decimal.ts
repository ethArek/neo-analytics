import { Prisma } from '@prisma/client';

export type DecimalLike = Prisma.Decimal | bigint | number | string;

export const decimalToBigInt = (value: DecimalLike | null | undefined): bigint => {
  if (value === null || value === undefined) {
    return 0n;
  }

  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'string') {
    return BigInt(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return 0n;
    }

    return BigInt(Math.trunc(value));
  }

  return BigInt(value.toFixed(0));
};
