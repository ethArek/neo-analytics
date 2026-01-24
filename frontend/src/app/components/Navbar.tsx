import React from 'react';
import type { NavState } from '../types';

type NavbarProps = {
  nav?: NavState;
};

const navClass = (isActive?: boolean) =>
  isActive ? 'nav-link is-active' : 'nav-link';

export const Navbar: React.FC<NavbarProps> = ({ nav }) => (
  <nav className="navbar" data-animate style={{ '--delay': '0s' } as React.CSSProperties}>
    <a className="nav-brand" href="/dashboard">
      <span className="nav-mark">N3</span>
      <span className="nav-copy">
        <span className="nav-title">Neo Analytics</span>
      </span>
    </a>
    <div className="nav-links">
      <a className={navClass(nav?.dashboard)} href="/dashboard">
        Dashboard
      </a>
      <a className={navClass(nav?.faq)} href="/faq">
        FAQ
      </a>
      <a className={navClass(nav?.specialThanks)} href="/special-thanks">
        Special thanks
      </a>
    </div>
  </nav>
);
