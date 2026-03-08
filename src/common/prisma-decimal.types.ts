import { Prisma } from '@prisma/client';

export type DecimalLike = Prisma.Decimal | bigint | number | string;
