import { fireEvent, render, screen } from '@testing-library/react';
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
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
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

  it('toggles dark mode and persists the selected theme', () => {
    render(<App />);

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');

    const toggle = screen.getByRole('button', { name: /switch to light mode/i });
    fireEvent.click(toggle);

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem('neo-analytics-theme')).toBe('light');
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
  });

  it('uses the stored light mode preference on first render', () => {
    window.localStorage.setItem('neo-analytics-theme', 'light');

    render(<App />);

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
  });
});
