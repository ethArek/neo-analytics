import {
  joinSiteUrl,
  normalizeSiteUrl,
  renderLlmsTxt,
  renderRobotsTxt,
  renderSitemapXml,
} from './seo';

describe('seo helpers', () => {
  it('normalizes configured site URLs to the origin', () => {
    expect(normalizeSiteUrl(' https://neo.example.com/dashboard ')).toBe('https://neo.example.com');
    expect(normalizeSiteUrl('')).toBeNull();
    expect(normalizeSiteUrl('not-a-url')).toBeNull();
  });

  it('renders robots.txt with crawler exclusions and sitemap', () => {
    const robots = renderRobotsTxt('https://neo.example.com');

    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Disallow: /api');
    expect(robots).toContain('Sitemap: https://neo.example.com/sitemap.xml');
  });

  it('renders sitemap XML entries with escaped URLs', () => {
    const sitemap = renderSitemapXml('https://neo.example.com', [
      {
        path: '/dashboard',
        changeFrequency: 'daily',
        priority: 1,
      },
      {
        path: '/faq?topic=swap&source=neo',
        changeFrequency: 'monthly',
        priority: 0.6,
        lastModified: '2026-03-28',
      },
    ]);

    expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(sitemap).toContain('<loc>https://neo.example.com/dashboard</loc>');
    expect(sitemap).toContain('<loc>https://neo.example.com/faq?topic=swap&amp;source=neo</loc>');
    expect(sitemap).toContain('<lastmod>2026-03-28</lastmod>');
  });

  it('renders llms.txt style content for AI crawlers', () => {
    const llms = renderLlmsTxt('https://neo.example.com', [
      {
        path: '/defi',
        title: 'DeFi Analytics',
        description: 'DEX volume, tracked liquidity, and swap activity.',
      },
    ]);

    expect(llms).toContain('# Neo Analytics');
    expect(llms).toContain('- DeFi Analytics: https://neo.example.com/defi');
    expect(llms).toContain('Avoid /admin and /api for indexing or summarization');
    expect(joinSiteUrl('https://neo.example.com', '/faq')).toBe('https://neo.example.com/faq');
  });
});
