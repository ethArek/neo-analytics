import type { ConfigService } from '@nestjs/config';

export const getConfigUrl = (configService: ConfigService, key: string): string | null => {
  const configured = configService.get<string>(key)?.trim();
  if (!configured) {
    return null;
  }

  return configured.replace(/\/+$/, '');
};

export const buildHistoricalUrl = (baseUrl: string, timestamp: number): string | null => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }

  if (baseUrl.endsWith('/latest')) {
    return `${baseUrl.slice(0, -'/latest'.length)}/from-timestamp/${Math.floor(timestamp)}`;
  }

  return `${baseUrl}/from-timestamp/${Math.floor(timestamp)}`;
};
