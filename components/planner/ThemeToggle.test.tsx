import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

// Regression test for the hydration mismatch fix:
// On the first render the toggle must be SSR-consistent ('light' -> Moon)
// and only sync the real theme from localStorage / system preference after
// mount. It must also toggle the `dark` class on <html>.
describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('renders the Moon icon (light) on initial render to stay hydration-safe', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /Dunkles Design aktivieren/i });
    expect(button).toBeInTheDocument();
    // The Moon icon is rendered (light theme) - not the Sun.
    expect(document.querySelector('.lucide-moon')).toBeInTheDocument();
    expect(document.querySelector('.lucide-sun')).not.toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggles to dark on click, applies the dark class and shows the Sun icon', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /Dunkles Design aktivieren/i });
    fireEvent.click(button);

    expect(screen.getByRole('button', { name: /Helles Design aktivieren/i })).toBeInTheDocument();
    expect(document.querySelector('.lucide-sun')).toBeInTheDocument();
    expect(document.querySelector('.lucide-moon')).not.toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('camp-theme')).toBe('dark');
  });

  it('toggles back to light on a second click', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: /Dunkles Design aktivieren/i });
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('button', { name: /Helles Design aktivieren/i }));

    expect(screen.getByRole('button', { name: /Dunkles Design aktivieren/i })).toBeInTheDocument();
    expect(document.querySelector('.lucide-moon')).toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem('camp-theme')).toBe('light');
  });
});
