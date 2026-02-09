import React from 'react';
import { render, screen } from '@testing-library/react';
import { SpecialThanksPage } from './SpecialThanksPage';
import type { DashboardData } from '../types';

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

    render(<SpecialThanksPage />);

    expect(screen.getByRole('heading', { name: 'Special thanks' })).toBeInTheDocument();
    expect(screen.getByText('City of Zion (CoZ)')).toBeInTheDocument();
  });
});
