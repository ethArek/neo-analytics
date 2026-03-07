import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  databaseUrl: process.env.NEO_DATABASE_URL,
  neoNetwork: process.env.NEO_NETWORK ?? 'MainNet',
  doraApiUrls: [process.env.DORA_API_URL].filter((endpoint): endpoint is string =>
    Boolean(endpoint),
  ),
  flamingoPriceApiUrl:
    process.env.FLAMINGO_PRICE_API_URL ??
    'https://neo-api.b-cdn.net/flamingo/live-data/prices/latest',
  defiMetricsAvailableFrom: process.env.DEFI_METRICS_AVAILABLE_FROM?.trim() ?? '',
  adminToken: process.env.ADMIN_TOKEN ?? '',
}));
