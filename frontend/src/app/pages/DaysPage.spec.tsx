import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import type { DaysData } from '../types';
import { DaysPage } from './DaysPage';

describe('DaysPage', () => {
  beforeEach(() => {
    delete window.__PAGE_DATA__;
  });

  it('renders the daily stats table', () => {
    const data: DaysData = {
      rangeLabel: '2024-01-01 to 2024-01-02',
      rangeFrom: '2024-01-01',
      rangeTo: '2024-01-02',
      stats: [
        {
          dateLabel: '2024-01-01',
          totalTxCountLabel: '10',
          swapsCountLabel: '1',
          transfersCountLabel: '2',
          gasClaimsCountLabel: '3',
          othersCountLabel: '4',
          realUsageTotalLabel: '6',
        },
      ],
    };

    window.__PAGE_DATA__ = data;

    render(
      <ThemeProvider>
        <DaysPage />
      </ThemeProvider>,
    );

    expect(screen.getByText('Daily activity table')).toBeInTheDocument();
    expect(screen.getByText('2024-01-01')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute(
      'href',
      '/dashboard?from=2024-01-01&to=2024-01-02',
    );
  });
});
