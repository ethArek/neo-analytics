import { delayStyle, ensureArray, getPageData, getPageName } from './utils';
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
});
