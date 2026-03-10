import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import type { DashboardData } from '../types';
import { SpecialThanksPage } from './SpecialThanksPage';

describe('SpecialThanksPage', () => {
  beforeEach(() => {
    delete window.__PAGE_DATA__;
  });

  it('renders the special thanks content', () => {
    const data: DashboardData = {
      nav: {
        specialThanks: true,
      },
    };

    window.__PAGE_DATA__ = data;

    render(
      <ThemeProvider>
        <SpecialThanksPage />
      </ThemeProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Special thanks' })).toBeInTheDocument();
    expect(screen.getByText('City of Zion (CoZ)')).toBeInTheDocument();
  });
});
