import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { renderReactPage } from './react-view';

describe('renderReactPage', () => {
  afterEach(() => {
    delete process.env.VITE_DEV_SERVER_URL;
    jest.restoreAllMocks();
  });

  it('escapes HTML in title values', () => {
    const html = renderReactPage({
      title: 'Neo </title><script>alert("x")</script>',
      page: 'dashboard',
      data: {},
    });

    expect(html).toContain(
      '<title>Neo &lt;/title&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</title>',
    );
  });

  it('falls back to default asset when manifest content is invalid', () => {
    const manifestPath = join(process.cwd(), 'public', 'app', '.vite', 'manifest.json');
    const hadManifest = existsSync(manifestPath);
    const originalManifest = hadManifest ? readFileSync(manifestPath, 'utf-8') : null;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, 'not-json');
    try {
      const html = renderReactPage({
        title: 'Neo Analytics',
        page: 'dashboard',
        data: {},
      });

      expect(html).toContain('<script type="module" src="/app/assets/index.js"></script>');
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      if (originalManifest === null) {
        unlinkSync(manifestPath);
      } else {
        writeFileSync(manifestPath, originalManifest);
      }
    }
  });

  it('escapes page data JSON in inline script', () => {
    const html = renderReactPage({
      title: 'Neo Analytics',
      page: 'dashboard',
      data: {
        payload: '</script><script>alert("x")</script>',
      },
    });

    expect(html).toContain('\\u003c/script>\\u003cscript>alert(\\"x\\")\\u003c/script>');
  });

  it('renders dev-server asset URLs when VITE_DEV_SERVER_URL is set', () => {
    process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173';

    const html = renderReactPage({
      title: 'Neo Analytics',
      page: 'dashboard',
      data: {},
    });

    expect(html).toContain(
      '<script type="module" src="http://localhost:5173/@vite/client"></script>',
    );
    expect(html).toContain(
      '<script type="module" src="http://localhost:5173/src/main.tsx"></script>',
    );
  });

  it('falls back to default asset when manifest does not include a supported entry', () => {
    const manifestPath = join(process.cwd(), 'public', 'app', '.vite', 'manifest.json');
    const hadManifest = existsSync(manifestPath);
    const originalManifest = hadManifest ? readFileSync(manifestPath, 'utf-8') : null;

    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify({ 'foo.ts': { file: 'assets/foo.js' } }));

    try {
      const html = renderReactPage({
        title: 'Neo Analytics',
        page: 'dashboard',
        data: {},
      });

      expect(html).toContain('<script type="module" src="/app/assets/index.js"></script>');
    } finally {
      if (originalManifest === null) {
        unlinkSync(manifestPath);
      } else {
        writeFileSync(manifestPath, originalManifest);
      }
    }
  });
});
