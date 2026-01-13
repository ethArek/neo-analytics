import { registerAs } from '@nestjs/config';

const parseList = (value?: string): string[] =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

export default registerAs('app', () => ({
  databaseUrl: process.env.DATABASE_URL,
  neoNetwork: process.env.NEO_NETWORK ?? 'MainNet',
  neoApiBaseUrl: process.env.NEO_API_BASE_URL ?? '',
  dexContractAllowlist: parseList(process.env.DEX_CONTRACT_ALLOWLIST),
  adminToken: process.env.ADMIN_TOKEN ?? '',
}));
