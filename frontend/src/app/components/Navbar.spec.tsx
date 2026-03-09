import { render, screen } from '@testing-library/react';
import { Navbar } from './Navbar';

describe('Navbar', () => {
  it('highlights the active nav item', () => {
    render(<Navbar nav={{ defi: true }} />);

    const defiLink = screen.getByRole('link', { name: /defi/i });
    const dashboardLink = screen.getByText('Dashboard');

    expect(defiLink).toHaveClass('nav-link', 'is-active');
    expect(dashboardLink).toHaveClass('nav-link');
    expect(dashboardLink).not.toHaveClass('is-active');
    expect(screen.getByText('new')).toBeInTheDocument();
  });
});
