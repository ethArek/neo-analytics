import { buildPageHref, delayStyle, ensureArray, getPageData, getPageName } from './utils';
import type { PageData } from './types';

describe('utils', () => {
  beforeEach(() => {
    delete window.__PAGE__;
    delete window.__PAGE_DATA__;
  });

  it('defaults to dashboard page name', () => {
    expect(getPageName()).toBe('dashboard');
  });

  it('reads page name from the window', () => {
    window.__PAGE__ = 'faq';

    expect(getPageName()).toBe('faq');
  });

  it('reads page data from the window', () => {
    const data: PageData = {
      nav: {
        faq: true,
      },
    };

    window.__PAGE_DATA__ = data;

    expect(getPageData<PageData>()).toEqual(data);
  });

  it('normalizes arrays', () => {
    expect(ensureArray(['a', 'b'])).toEqual(['a', 'b']);
    expect(ensureArray()).toEqual([]);
    expect(ensureArray(null)).toEqual([]);
  });

  it('builds the delay style object', () => {
    expect(delayStyle('0.1s')).toEqual({ '--delay': '0.1s' });
  });

  it('builds page hrefs from range params', () => {
    expect(
      buildPageHref('/dashboard', {
        from: '2024-01-01',
        to: '2024-01-02',
      }),
    ).toBe('/dashboard?from=2024-01-01&to=2024-01-02');
    expect(
      buildPageHref('/dashboard', {
        to: '2024-01-02',
      }),
    ).toBe('/dashboard?to=2024-01-02');
  });

  it('returns the base path when range params are empty', () => {
    expect(buildPageHref('/dashboard')).toBe('/dashboard');
    expect(
      buildPageHref('/dashboard', {
        from: '',
        to: '',
      }),
    ).toBe('/dashboard');
  });
});
