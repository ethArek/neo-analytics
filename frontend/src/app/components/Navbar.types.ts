import type { MarketPrices, NavState } from '../types';

export type NavbarProps = {
  nav?: NavState;
  marketPrices?: MarketPrices;
  brandMark?: string;
  brandHref?: string;
};
