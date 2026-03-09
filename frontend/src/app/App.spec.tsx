import { render, screen } from '@testing-library/react';
import { App } from './App';

jest.mock('../charts/dashboard', () => ({
  initDashboardCharts: jest.fn(),
}));

jest.mock('../charts/defi', () => ({
  initDefiCharts: jest.fn(),
}));

describe('App', () => {
  beforeEach(() => {
    delete window.__PAGE__;
    delete window.__PAGE_DATA__;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the requested page', () => {
    window.__PAGE__ = 'faq';
    window.__PAGE_DATA__ = {
      nav: {
        faq: true,
      },
    };

    render(<App />);

    expect(screen.getByText(/Clear answers to how Neo Analytics works/i)).toBeInTheDocument();
  });

  it('falls back to the dashboard page', () => {
    render(<App />);

    expect(screen.getByText('Yesterday stats')).toBeInTheDocument();
  });
});
