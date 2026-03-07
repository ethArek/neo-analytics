import React from 'react';
import { render, screen } from '@testing-library/react';
import { DateRangeForm } from './DateRangeForm';

describe('DateRangeForm', () => {
  it('renders the provided range defaults', () => {
    render(<DateRangeForm from="2024-01-01" to="2024-01-02" animateDelay="0.1s" />);

    expect(screen.getByLabelText('From')).toHaveValue('2024-01-01');
    expect(screen.getByLabelText('To')).toHaveValue('2024-01-02');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });
});
