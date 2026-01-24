import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

type ReactPageOptions = {
  title: string;
  page: string;
  data: Record<string, unknown>;
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

const loadManifest = (): Record<string, { file: string; css?: string[] }> | null => {
  for (const candidate of manifestCandidates) {
    if (existsSync(candidate)) {
      return JSON.parse(readFileSync(candidate, 'utf-8')) as Record<
        string,
        { file: string; css?: string[] }
      >;
    }
  }

  return null;
};

const resolveClientAssets = () => {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    return {
      scripts: [
        `${devServerUrl}/@vite/client`,
        `${devServerUrl}/src/main.tsx`,
      ],
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
}: ReactPageOptions): string => {
  const serialized = JSON.stringify(data).replace(/</g, '\\u003c');
  const assets = resolveClientAssets();
  const scriptTags = assets.scripts
    .map(
      (src) =>
        `<script ${assets.isModule ? 'type="module"' : ''} src="${src}"></script>`,
    )
    .join('\n');
  const styleTags = assets.styles
    .map((href) => `<link rel="stylesheet" href="${href}" />`)
    .join('\n');

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
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
