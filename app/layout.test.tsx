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

    // html enthält <head> (Dark-Mode-Inline-Skript) und <body>.
    const htmlChildren = React.Children.toArray(element.props.children);
    const bodyElement = htmlChildren.find(
      (child): child is React.ReactElement<{ className: string; children: React.ReactNode }> =>
        React.isValidElement(child) && child.type === 'body'
    );
    expect(bodyElement).toBeDefined();
    expect(bodyElement!.props.className).toContain('font-sans');
    expect(bodyElement!.props.className).toContain('min-h-screen');

    // Body enthält SystemThemeSync, den Skip-Link (a) und die Children —
    // gesucht wird per Typ/Props, nicht per Index.
    const bodyChildren = React.Children.toArray(bodyElement!.props.children);
    const skipLink = bodyChildren.find(
      (child): child is React.ReactElement<{ href: string }> =>
        React.isValidElement(child) && child.type === 'a'
    );
    expect(skipLink).toBeDefined();
    expect(skipLink?.props.href).toBe('#main');

    const childElement = bodyChildren.find(
      (child): child is React.ReactElement<{ 'data-testid': string; children: string }> =>
        React.isValidElement(child) && (child.props as { 'data-testid'?: string })['data-testid'] === 'child'
    );
    expect(childElement).toBeDefined();
    expect(childElement?.props.children).toBe('Test Child');
  });

  it('exports the correct metadata', () => {
    expect(metadata).toEqual({
      title: 'Werft — Erst der Plan. Dann das Blech.',
      description:
        'Werkstatt für den Camper-Ausbau. 12V-Schaltplan, Dachfläche, Heizlast und Normen — geplant, bevor gebohrt wird.',
    });
  });
});
