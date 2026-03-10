import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import type { AdminData } from '../types';
import { AdminPage } from './AdminPage';

describe('AdminPage', () => {
  beforeEach(() => {
    delete window.__PAGE_DATA__;
  });

  it('renders admin details and messages', () => {
    const data: AdminData = {
      email: 'admin@example.com',
      defaultDate: '2024-01-01',
      message: 'Ingestion complete.',
      error: 'Warning message.',
    };

    window.__PAGE_DATA__ = data;

    render(
      <ThemeProvider>
        <AdminPage />
      </ThemeProvider>,
    );

    expect(screen.getByText('Admin console')).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('Ingestion complete.')).toBeInTheDocument();
    expect(screen.getByText('Warning message.')).toBeInTheDocument();
  });
});
