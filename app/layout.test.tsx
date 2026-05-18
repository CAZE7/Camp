

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
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
    expect(bodyElement.props.className).toContain('mocked-inter-class');
    expect(bodyElement.props.className).toContain('bg-stone-50');

    // MainLayout container is rendered inside body
    const mainLayoutElement = bodyElement.props.children.find((c: any) => c && c.type && typeof c.type !== 'string');
    expect(mainLayoutElement).toBeDefined();
    const childElement = mainLayoutElement.props.children;
    expect(childElement.props['data-testid']).toBe('child');
    expect(childElement.props.children).toBe('Test Child');
  });

  it('exports the correct metadata', () => {
    expect(metadata).toEqual({
      title: 'CampCraft — DIY Camper-Ausbau Plattform',
      description: 'Plane deinen Camper-Ausbau wie ein Profi. Elektrik, Dach, Heizung und mehr — alles an einem Ort.',
    });
  });
});
