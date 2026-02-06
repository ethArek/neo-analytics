import React from 'react';
import { render, screen } from '@testing-library/react';
import { Navbar } from './Navbar';

describe('Navbar', () => {
  it('highlights the active nav item', () => {
    render(<Navbar nav={{ faq: true }} />);

    const faqLink = screen.getByText('FAQ');
    const dashboardLink = screen.getByText('Dashboard');

    expect(faqLink).toHaveClass('nav-link', 'is-active');
    expect(dashboardLink).toHaveClass('nav-link');
    expect(dashboardLink).not.toHaveClass('is-active');
  });
});
