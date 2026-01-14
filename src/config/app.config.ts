import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  databaseUrl: process.env.DATABASE_URL,
  neoNetwork: process.env.NEO_NETWORK ?? 'MainNet',
  neoApiBaseUrl: process.env.NEO_API_BASE_URL ?? '',
  adminToken: process.env.ADMIN_TOKEN ?? '',
}));
