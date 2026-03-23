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
      marketPrices: {
        neo: {
          price: '$12.34',
          change24h: '+2.40%',
          tone: 'positive',
        },
        gas: {
          price: '$3.21',
          change24h: '-1.10%',
          tone: 'negative',
        },
      },
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
    expect(document.body).toHaveTextContent('NEO $12.34 (+2.40%)');
    expect(document.body).toHaveTextContent('GAS $3.21 (-1.10%)');
    expect(screen.getByText('City of Zion (CoZ)')).toBeInTheDocument();
  });
});
