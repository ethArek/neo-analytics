import type React from 'react';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminPage } from './pages/AdminPage';
import { AssetPage } from './pages/AssetPage';
import { DashboardPage } from './pages/DashboardPage';
import { DayPage } from './pages/DayPage';
import { DaysPage } from './pages/DaysPage';
import { DefiPage } from './pages/DefiPage';
import { FaqPage } from './pages/FaqPage';
import { NeoXPage } from './pages/NeoXPage';
import { SpecialThanksPage } from './pages/SpecialThanksPage';
import { ThemeProvider } from './theme';
import { getPageName } from './utils';

const pages: Record<string, React.FC> = {
  dashboard: DashboardPage,
  'neo-x': NeoXPage,
  defi: DefiPage,
  days: DaysPage,
  day: DayPage,
  asset: AssetPage,
  faq: FaqPage,
  'special-thanks': SpecialThanksPage,
  admin: AdminPage,
  'admin-login': AdminLoginPage,
};

export const App: React.FC = () => {
  const page = getPageName();
  const PageComponent = pages[page] ?? DashboardPage;

  return (
    <ThemeProvider>
      <PageComponent />
    </ThemeProvider>
  );
};
