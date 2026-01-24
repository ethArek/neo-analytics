import type { PageData } from './types';

declare global {
  interface Window {
    __PAGE__?: string;
    __PAGE_DATA__?: PageData;
  }
}

export const getPageName = () => window.__PAGE__ ?? 'dashboard';

export const getPageData = (): PageData => window.__PAGE_DATA__ ?? {};

export const ensureArray = <T>(value?: T[] | null): T[] =>
  Array.isArray(value) ? value : [];
