type ReactPageOptions = {
  title: string;
  page: string;
  data: Record<string, unknown>;
  includeCharts?: boolean;
};

const matomoScript = `
  <!-- Matomo -->
  <script>
    var _paq = window._paq = window._paq || [];
    _paq.push(['trackPageView']);
    _paq.push(['enableLinkTracking']);
    (function() {
      var u="//stats0.small.pl/";
      _paq.push(['setTrackerUrl', u+'matomo.php']);
      _paq.push(['setSiteId', '337']);
      var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
      g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
    })();
  </script>
  <!-- End Matomo Code -->
`;

export const renderReactPage = ({
  title,
  page,
  data,
  includeCharts = false,
}: ReactPageOptions): string => {
  const serialized = JSON.stringify(data).replace(/</g, '\\u003c');
  const chartScripts = includeCharts
    ? `
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <script src="/js/dashboard.js"></script>
    `
    : '';

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
  </head>
  <body>
    <div id="root"></div>
    <script>
      window.__PAGE__ = ${JSON.stringify(page)};
      window.__PAGE_DATA__ = ${serialized};
    </script>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/htm@3.1.1/dist/htm.umd.js"></script>
    <script src="/js/app.js"></script>
    ${chartScripts}
  </body>
</html>
  `.trim();
};
