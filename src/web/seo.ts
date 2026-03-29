export type SitemapEntry = {
  path: string;
  changeFrequency: 'daily' | 'weekly' | 'monthly';
  priority: number;
  lastModified?: string;
};

export type LlmsEntry = {
  path: string;
  title: string;
  description: string;
};

const escapeXml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

export const normalizeSiteUrl = (value?: string | null): string | null => {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    return url.origin;
  } catch (_error) {
    return null;
  }
};

export const joinSiteUrl = (siteUrl: string, path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${siteUrl}${normalizedPath}`;
};

export const renderRobotsTxt = (siteUrl: string): string => {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api',
    `Sitemap: ${joinSiteUrl(siteUrl, '/sitemap.xml')}`,
  ].join('\n');
};

export const renderSitemapXml = (siteUrl: string, entries: SitemapEntry[]): string => {
  const urls = entries
    .map((entry) => {
      const lines = [
        '  <url>',
        `    <loc>${escapeXml(joinSiteUrl(siteUrl, entry.path))}</loc>`,
        `    <changefreq>${entry.changeFrequency}</changefreq>`,
        `    <priority>${entry.priority.toFixed(1)}</priority>`,
      ];
      if (entry.lastModified) {
        lines.push(`    <lastmod>${escapeXml(entry.lastModified)}</lastmod>`);
      }

      lines.push('  </url>');

      return lines.join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
  ].join('\n');
};

export const renderLlmsTxt = (siteUrl: string, entries: LlmsEntry[]): string => {
  const lines = [
    '# Neo Analytics',
    '',
    '> Public analytics dashboard for Neo N3 activity, DeFi volume, and classification methodology.',
    '',
    'Canonical site:',
    `- ${joinSiteUrl(siteUrl, '/dashboard')}`,
    '',
    'Public pages:',
  ];

  for (const entry of entries) {
    lines.push(`- ${entry.title}: ${joinSiteUrl(siteUrl, entry.path)}`);
    lines.push(`  ${entry.description}`);
  }

  lines.push('');
  lines.push('Machine-readable endpoints:');
  lines.push(`- Sitemap: ${joinSiteUrl(siteUrl, '/sitemap.xml')}`);
  lines.push(`- Robots: ${joinSiteUrl(siteUrl, '/robots.txt')}`);
  lines.push('');
  lines.push('Crawling notes:');
  lines.push('- Avoid /admin and /api for indexing or summarization unless explicitly requested.');

  return lines.join('\n');
};
