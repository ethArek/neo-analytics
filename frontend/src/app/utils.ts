import type { CSSProperties } from 'react';
import type { PageData } from './types';

declare global {
  interface Window {
    __PAGE__?: string;
    __PAGE_DATA__?: PageData;
  }
}

export const getPageName = () => window.__PAGE__ ?? 'dashboard';

export const getPageData = <T extends PageData = PageData>(): T =>
  (window.__PAGE_DATA__ ?? {}) as T;

export const ensureArray = <T>(value?: T[] | null): T[] => (Array.isArray(value) ? value : []);

export const delayStyle = (delay: string): CSSProperties => ({ '--delay': delay }) as CSSProperties;
