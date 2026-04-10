import type React from 'react';
import { delayStyle } from '../utils';
import { MarketTicker } from './MarketTicker';
import type { NavbarProps } from './Navbar.types';
import { ThemeToggle } from './ThemeToggle';

const navClass = (isActive?: boolean) => (isActive ? 'nav-link is-active' : 'nav-link');

export const Navbar: React.FC<NavbarProps> = ({
  nav,
  marketPrices,
  brandMark = 'N3',
  brandHref = '/dashboard',
}) => (
  <nav className="navbar" data-animate style={delayStyle('0s')}>
    <a className="nav-brand" href={brandHref}>
      <span className="nav-mark">{brandMark}</span>
      <span className="nav-copy">
        <span className="nav-title">Neo Analytics</span>
      </span>
    </a>
    <MarketTicker marketPrices={marketPrices} className="navbar-market-ticker" />
    <div className="nav-actions">
      <div className="nav-links">
        <a className={navClass(nav?.dashboard)} href="/dashboard">
          Neo N3
        </a>
        <a className={navClass(nav?.neoX)} href="/neo-x">
          <span>Neo X</span>
          <span className="nav-badge">new</span>
        </a>
        <a className={navClass(nav?.defi)} href="/defi">
          DeFi
        </a>
        <a className={navClass(nav?.faq)} href="/faq">
          FAQ
        </a>
        <a className={navClass(nav?.specialThanks)} href="/special-thanks">
          Special thanks
        </a>
      </div>
      <ThemeToggle />
    </div>
  </nav>
);
