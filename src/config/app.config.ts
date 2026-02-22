import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  databaseUrl: process.env.NEO_DATABASE_URL,
  neoNetwork: process.env.NEO_NETWORK ?? 'MainNet',
  doraApiUrls: [process.env.DORA_API_URL].filter((endpoint): endpoint is string => Boolean(endpoint)),
  adminToken: process.env.ADMIN_TOKEN ?? '',
}));
