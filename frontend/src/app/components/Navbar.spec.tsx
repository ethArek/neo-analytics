import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import { Navbar } from './Navbar';

describe('Navbar', () => {
  it('highlights the active nav item', () => {
    render(
      <ThemeProvider>
        <Navbar nav={{ neoX: true }} brandMark="NX" brandHref="/neo-x" />
      </ThemeProvider>,
    );

    const neoXLink = screen.getByRole('link', { name: 'Neo X new' });
    const neoN3Link = screen.getByText('Neo N3');
    const defiLink = screen.getByRole('link', { name: 'DeFi' });

    expect(neoXLink).toHaveClass('nav-link', 'is-active');
    expect(neoN3Link).toHaveClass('nav-link');
    expect(neoN3Link).not.toHaveClass('is-active');
    expect(neoXLink).toHaveTextContent('new');
    expect(defiLink).not.toHaveTextContent('new');
    expect(screen.getByRole('link', { name: 'Neo X new' })).toHaveAttribute('href', '/neo-x');
    expect(screen.getByRole('link', { name: /Neo Analytics/i })).toHaveAttribute('href', '/neo-x');
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();
  });
});
