import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  databaseUrl: process.env.NEO_DATABASE_URL,
  neoNetwork: process.env.NEO_NETWORK ?? 'MainNet',
  doraApiUrls: [process.env.DORA_API_URL].filter((endpoint): endpoint is string =>
    Boolean(endpoint),
  ),
  coinPaprikaApiUrl: process.env.COINPAPRIKA_API_URL ?? 'https://api.coinpaprika.com/v1',
  flamingoPriceApiUrl:
    process.env.FLAMINGO_PRICE_API_URL ??
    'https://neo-api.b-cdn.net/flamingo/live-data/prices/latest',
  flamingoAnalyticsApiUrl:
    process.env.FLAMINGO_ANALYTICS_API_URL ??
    'https://flamingo-us-1.b-cdn.net/flamingo/analytics/rolling-30-days/total_data',
  flamingoPoolDataApiUrl:
    process.env.FLAMINGO_POOL_DATA_API_URL ??
    'https://flamingo-us-1.b-cdn.net/flamingo/live-data/pool-data/latest',
  flamingoTvlApiUrl:
    process.env.FLAMINGO_TVL_API_URL ??
    'https://flamingo-us-1.b-cdn.net/flamingo/analytics/flamingo/usd-value-locked',
  defiMetricsAvailableFrom: process.env.DEFI_METRICS_AVAILABLE_FROM?.trim() ?? '',
  adminToken: process.env.ADMIN_TOKEN ?? '',
}));
