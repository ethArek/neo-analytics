import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import { Navbar } from './Navbar';

describe('Navbar', () => {
  it('highlights the active nav item', () => {
    render(
      <ThemeProvider>
        <Navbar nav={{ defi: true }} />
      </ThemeProvider>,
    );

    const defiLink = screen.getByRole('link', { name: /defi/i });
    const dashboardLink = screen.getByText('Dashboard');

    expect(defiLink).toHaveClass('nav-link', 'is-active');
    expect(dashboardLink).toHaveClass('nav-link');
    expect(dashboardLink).not.toHaveClass('is-active');
    expect(screen.getByText('new')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();
  });
});
