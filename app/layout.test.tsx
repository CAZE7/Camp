import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RootLayout, { metadata } from './layout';

// Mock next/font/google
vi.mock('next/font/google', () => ({
  Inter: () => ({ className: 'mocked-inter-class' }),
  Geist: () => ({ variable: 'mocked-geist-variable' }),
}));

describe('RootLayout', () => {
  it('renders children correctly', () => {
    // Because RootLayout returns <html> and <body>, and testing-library/react wraps with <div>,
    // it complains about <html> inside <div>.
    // However, we can just call RootLayout as a function to inspect its output React elements instead of rendering it.

    const element = RootLayout({ children: <div data-testid="child">Test Child</div> });

    expect(element.type).toBe('html');
    expect(element.props.lang).toBe('de');
    expect(element.props.className).toContain('font-sans');
    expect(element.props.className).toContain('mocked-geist-variable');

    const bodyElement = element.props.children;
    expect(bodyElement.type).toBe('body');
    expect(bodyElement.props.className).toBe('mocked-inter-class');

    const childElement = bodyElement.props.children;
    expect(childElement.props['data-testid']).toBe('child');
    expect(childElement.props.children).toBe('Test Child');
  });

  it('exports the correct metadata', () => {
    expect(metadata).toEqual({
      title: 'Camper Elektrik Planer',
      description: '12V Camper Elektrik Kabelplaner',
    });
  });
});
