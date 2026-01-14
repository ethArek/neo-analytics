import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  databaseUrl: process.env.DATABASE_URL,
  neoNetwork: process.env.NEO_NETWORK ?? 'MainNet',
  rpcEndpoints: [process.env.RPC_ENDPOINT_1, process.env.RPC_ENDPOINT_2].filter(
    (endpoint): endpoint is string => Boolean(endpoint),
  ),
  adminToken: process.env.ADMIN_TOKEN ?? '',
}));
