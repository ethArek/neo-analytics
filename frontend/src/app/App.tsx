import type React from 'react';
import { getPageName } from './utils';
import { DashboardPage } from './pages/DashboardPage';
import { DefiPage } from './pages/DefiPage';
import { DaysPage } from './pages/DaysPage';
import { DayPage } from './pages/DayPage';
import { FaqPage } from './pages/FaqPage';
import { SpecialThanksPage } from './pages/SpecialThanksPage';
import { AdminPage } from './pages/AdminPage';
import { AdminLoginPage } from './pages/AdminLoginPage';

const pages: Record<string, React.FC> = {
  dashboard: DashboardPage,
  defi: DefiPage,
  days: DaysPage,
  day: DayPage,
  faq: FaqPage,
  'special-thanks': SpecialThanksPage,
  admin: AdminPage,
  'admin-login': AdminLoginPage,
};

export const App: React.FC = () => {
  const page = getPageName();
  const PageComponent = pages[page] ?? DashboardPage;

  return <PageComponent />;
};
