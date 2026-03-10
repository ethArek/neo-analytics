import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import type { AdminLoginData } from '../types';
import { AdminLoginPage } from './AdminLoginPage';

describe('AdminLoginPage', () => {
  beforeEach(() => {
    delete window.__PAGE_DATA__;
  });

  it('renders the login form and error message', () => {
    const data: AdminLoginData = {
      email: 'admin@example.com',
      error: 'Invalid credentials.',
    };

    window.__PAGE_DATA__ = data;

    render(
      <ThemeProvider>
        <AdminLoginPage />
      </ThemeProvider>,
    );

    expect(screen.getByText('Admin access')).toBeInTheDocument();
    expect(screen.getByText('Invalid credentials.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('admin@example.com');
  });
});
