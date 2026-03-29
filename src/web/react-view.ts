import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { ClientAssets, ReactPageOptions, ViteManifest } from './react-view.types';

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const matomoScript = `
  <!-- Matomo -->
  <script>
    (function() {
      var hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return;
      }
      var _paq = window._paq = window._paq || [];
      _paq.push(['trackPageView']);
      _paq.push(['enableLinkTracking']);
      var u="//stats0.small.pl/";
      _paq.push(['setTrackerUrl', u+'matomo.php']);
      _paq.push(['setSiteId', '337']);
      var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
      g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
    })();
  </script>
  <!-- End Matomo Code -->
`;

const manifestCandidates = [
  join(__dirname, '..', 'public', 'app', 'manifest.json'),
  join(__dirname, '..', 'public', 'app', '.vite', 'manifest.json'),
  join(__dirname, '..', '..', 'public', 'app', 'manifest.json'),
  join(__dirname, '..', '..', 'public', 'app', '.vite', 'manifest.json'),
  join(process.cwd(), 'public', 'app', 'manifest.json'),
  join(process.cwd(), 'public', 'app', '.vite', 'manifest.json'),
];

const loadManifest = (): ViteManifest | null => {
  for (const candidate of manifestCandidates) {
    if (existsSync(candidate)) {
      try {
        return JSON.parse(readFileSync(candidate, 'utf-8')) as ViteManifest;
      } catch (error) {
        console.warn(
          `Unable to read Vite manifest from "${candidate}". Trying next candidate.`,
          error,
        );
      }
    }
  }

  return null;
};

const resolveClientAssets = (): ClientAssets => {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    return {
      scripts: [`${devServerUrl}/@vite/client`, `${devServerUrl}/src/main.tsx`],
      styles: [],
      isModule: true,
    };
  }

  const manifest = loadManifest();
  if (!manifest) {
    return {
      scripts: ['/app/assets/index.js'],
      styles: [],
      isModule: true,
    };
  }

  const entry = manifest['index.html'] ?? manifest['src/main.tsx'];
  if (!entry) {
    return {
      scripts: ['/app/assets/index.js'],
      styles: [],
      isModule: true,
    };
  }

  return {
    scripts: [join('/app', entry.file).replace(/\\/g, '/')],
    styles: (entry.css ?? []).map((href) => join('/app', href).replace(/\\/g, '/')),
    isModule: true,
  };
};

export const renderReactPage = ({
  title,
  page,
  data,
  description,
  canonicalUrl,
  robots,
}: ReactPageOptions): string => {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(
    description ??
      'Neo N3 analytics dashboard with daily activity, DeFi metrics, and public data views.',
  );
  const safeRobots = escapeHtml(robots ?? 'index, follow');
  const safeCanonicalUrl = canonicalUrl ? escapeHtml(canonicalUrl) : null;
  const serialized = JSON.stringify(data).replace(/</g, '\\u003c');
  const assets = resolveClientAssets();
  const scriptTags = assets.scripts
    .map(
      (src) =>
        `<script ${assets.isModule ? 'type="module"' : ''} src="${escapeHtml(src)}"></script>`,
    )
    .join('\n');
  const styleTags = assets.styles
    .map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}" />`)
    .join('\n');

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <meta name="robots" content="${safeRobots}" />
    <meta property="og:site_name" content="Neo Analytics" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="theme-color" content="#16a34a" />
    ${safeCanonicalUrl ? `<link rel="canonical" href="${safeCanonicalUrl}" />` : ''}
    ${safeCanonicalUrl ? `<meta property="og:url" content="${safeCanonicalUrl}" />` : ''}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap"
      rel="stylesheet"
    />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/css/styles.css" />
    ${matomoScript}
    ${styleTags}
  </head>
  <body>
    <div id="root"></div>
    <script>
      window.__PAGE__ = ${JSON.stringify(page)};
      window.__PAGE_DATA__ = ${serialized};
    </script>
    ${scriptTags}
  </body>
</html>
  `.trim();
};
