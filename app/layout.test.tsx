/** AUDIT T1: `mockImplementation` gibt `any` zurück — benannte, typisierte Factory. */
const createMatchMediaStub = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(), // Deprecated
  removeListener: vi.fn(), // Deprecated
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn(createMatchMediaStub),
});
import React from 'react';
import { describe, it, expect, vi } from 'vitest';

import { Analytics } from '@/components/analytics/Analytics';

import RootLayout, { metadata } from './layout';

describe('RootLayout', () => {
  it('renders children correctly', () => {
    // Because RootLayout returns <html> and <body>, and testing-library/react wraps with <div>,
    // it complains about <html> inside <div>.
    // However, we can just call RootLayout as a function to inspect its output React elements instead of rendering it.

    // `RootLayout` liefert ein JSX-Element, dessen `props` typseitig `any`
    // sind (AUDIT T1) — die erwartete Form wird hier ausdrücklich benannt.
    const element = RootLayout({
      children: <div data-testid="child">Test Child</div>,
    }) as React.ReactElement<{ lang?: string; children?: React.ReactNode }>;

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
    expect(bodyElement!.props.className).toContain('min-h-dvh');

    const headElement = htmlChildren.find(
      (child): child is React.ReactElement<{ children: React.ReactNode }> =>
        React.isValidElement(child) && child.type === 'head'
    );
    expect(headElement).toBeDefined();
    const headChildren = React.Children.toArray(headElement!.props.children);
    const cspMeta = headChildren.find(
      (child) =>
        React.isValidElement(child) &&
        child.type === 'meta' &&
        (child.props as { httpEquiv?: string }).httpEquiv === 'Content-Security-Policy'
    );
    expect(cspMeta).toBeDefined();
    const cspContent = (cspMeta as React.ReactElement<{ content: string }>).props.content;
    expect(cspContent).toContain('https://www.googletagmanager.com');
    expect(cspContent).toContain('https://*.google-analytics.com');

    const inlineScripts = headChildren
      .filter(
        (child): child is React.ReactElement<{ dangerouslySetInnerHTML?: { __html?: string } }> =>
          React.isValidElement(child) && child.type === 'script'
      )
      .map((script) => script.props.dangerouslySetInnerHTML?.__html ?? '');
    const consentIndex = inlineScripts.findIndex((script) => script.includes("gtag('consent','default'"));
    const darkModeIndex = inlineScripts.findIndex((script) => script.includes('prefers-color-scheme'));
    expect(consentIndex).toBeGreaterThanOrEqual(0);
    expect(consentIndex).toBeLessThan(darkModeIndex);
    expect(inlineScripts[consentIndex]).toContain("analytics_storage:'denied'");

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

    const analyticsIndex = bodyChildren.findIndex(
      (child) => React.isValidElement(child) && child.type === Analytics
    );
    expect(analyticsIndex).toBeGreaterThan(bodyChildren.indexOf(childElement!));
  });

  it('liefert nur globale Standards; Canonical und Vorschaukarten gehören zur jeweiligen Route', () => {
    expect(metadata.metadataBase?.toString()).toBe('https://12v-planer.de/');
    expect(metadata.title).toEqual({
      default: 'Camper-Ausbau planen: Elektrik, Dach und Heizlast | 12V-Planer',
      template: '%s | 12V-Planer',
    });
    // Ein vererbter Homepage-Canonical oder ein Homepage-Open-Graph auf einer
    // Fehlerroute wäre widersprüchlich. Indexierbare Seiten setzen beides über
    // metadataForPage() selbst.
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toBeUndefined();
    expect(metadata.twitter).toBeUndefined();
  });
});
