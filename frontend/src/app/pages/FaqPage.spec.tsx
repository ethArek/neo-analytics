import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import type { DashboardData } from '../types';
import { FaqPage } from './FaqPage';

describe('FaqPage', () => {
  beforeEach(() => {
    delete window.__PAGE_DATA__;
  });

  it('renders the FAQ content and market prices', () => {
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
        faq: true,
      },
    };

    window.__PAGE_DATA__ = data;

    render(
      <ThemeProvider>
        <FaqPage />
      </ThemeProvider>,
    );

    expect(document.body).toHaveTextContent('NEO $12.34 (+2.40%)');
    expect(document.body).toHaveTextContent('GAS $3.21 (-1.10%)');
    expect(
      screen.getByRole('heading', { name: 'Clear answers to how Neo Analytics works.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('How often is data updated?')).toBeInTheDocument();
  });
});
