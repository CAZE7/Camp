Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
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
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import RootLayout, { metadata } from './layout';

describe('RootLayout', () => {
  it('renders children correctly', () => {
    // Because RootLayout returns <html> and <body>, and testing-library/react wraps with <div>,
    // it complains about <html> inside <div>.
    // However, we can just call RootLayout as a function to inspect its output React elements instead of rendering it.

    const element = RootLayout({ children: <div data-testid="child">Test Child</div> });

    expect(element.type).toBe('html');
    expect(element.props.lang).toBe('de');

    const bodyElement = element.props.children;
    expect(bodyElement.type).toBe('body');
    expect(bodyElement.props.className).toContain('font-sans');
    expect(bodyElement.props.className).toContain('min-h-screen');

    // Body enthält den Skip-Link (a) und die Children.
    const bodyChildren = React.Children.toArray(bodyElement.props.children);
    const skipLink = bodyChildren[0] as React.ReactElement<{ href: string }>;
    expect(skipLink.type).toBe('a');
    expect(skipLink.props.href).toBe('#main');

    const childElement = bodyChildren[1] as React.ReactElement<{
      'data-testid': string;
      children: string;
    }>;
    expect(childElement.props['data-testid']).toBe('child');
    expect(childElement.props.children).toBe('Test Child');
  });

  it('exports the correct metadata', () => {
    expect(metadata).toEqual({
      title: 'Werft — Erst der Plan. Dann das Blech.',
      description:
        'Werkstatt für den Camper-Ausbau. 12V-Schaltplan, Dachfläche, Heizlast und Normen — geplant, bevor gebohrt wird.',
    });
  });
});
