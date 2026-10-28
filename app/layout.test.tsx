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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
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

  it('lädt Inter und Outfit vor, damit der Text nicht nachträglich umbricht (M11-6)', () => {
    // Gemessen wird am Quelltext, weil `preload()` seine Wirkung erst beim
    // Rendern auf dem Server entfaltet (<link rel="preload"> im Kopf). Dass im
    // Export genau vier Preloads stehen und keine doppelt, prüft
    // `scripts/seo/auditExport.ts` (FONT-PRELOAD-*); hier wird geprüft, dass
    // die vier Schnitte überhaupt angefordert werden — und zwar mit `preload()`
    // und nicht als <link>-Kind im Baum: React 19 hoistet `<link
    // rel="preload">` zusätzlich und verdoppelt es damit (ADR 0039).
    const quelle = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8');
    expect(quelle).toContain("import { preload } from 'react-dom'");

    for (const datei of [
      'ibm-plex-mono-latin-400-normal.woff2',
      'ibm-plex-mono-latin-500-normal.woff2',
      'inter-latin-wght-normal.woff2',
      'outfit-latin-wght-normal.woff2',
    ]) {
      expect(quelle).toContain(datei);
    }

    const aufrufe = quelle.match(/preload\((?:mono|inter|outfit)[A-Za-z0-9]*LatinUrl,/g) ?? [];
    expect(aufrufe).toHaveLength(4);
    // Kein <link rel="preload"> im Baum — der wäre die Doppelung.
    expect(quelle).not.toContain('rel="preload" as="font"');
    // Fonts werden immer im CORS-Modus geholt; ohne crossOrigin läuft der
    // Preload ins Leere (Chrome: „preload … was not used").
    expect(quelle.match(/crossOrigin: 'anonymous'/g) ?? []).toHaveLength(4);
  });

  it('definiert die Autorenangabe einmal für die ganze Auslieferung', () => {
    const element = RootLayout({ children: <div /> }) as React.ReactElement<{
      children?: React.ReactNode;
    }>;
    const head = React.Children.toArray(element.props.children).find(
      (child): child is React.ReactElement<{ children: React.ReactNode }> =>
        React.isValidElement(child) && child.type === 'head'
    );
    const scripts = React.Children.toArray(head!.props.children).filter(
      (child): child is React.ReactElement<{ type?: string; dangerouslySetInnerHTML?: { __html: string } }> =>
        React.isValidElement(child) && (child.props as { type?: string }).type === 'application/ld+json'
    );
    const siteGraph = scripts
      .map((script) => script.props.dangerouslySetInnerHTML?.__html ?? '')
      .map((html) => {
        try {
          return JSON.parse(html) as { '@graph'?: Array<Record<string, unknown>> };
        } catch {
          return {};
        }
      })
      .find((graph) => graph['@graph']?.some((node) => node['@type'] === 'WebSite'));

    const person = siteGraph?.['@graph']?.find((node) => node['@type'] === 'Person');
    expect(person).toBeDefined();
    expect(person?.['@id']).toBe('https://elektroplaner-camper.de/#author');
    expect(person?.['name']).toBe('Jonas Rieckhoff');
    // Die Organisation steht im selben Graphen und wird nur verwiesen.
    expect(person?.['worksFor']).toEqual({ '@id': 'https://elektroplaner-camper.de/#organization' });
  });

  it('liefert nur globale Standards; Canonical und Vorschaukarten gehören zur jeweiligen Route', () => {
    expect(metadata.metadataBase?.toString()).toBe('https://elektroplaner-camper.de/');
    expect(metadata.title).toEqual({
      default: 'Camper-Ausbau planen: Elektrik, Dach und Heizlast | Elektroplaner',
      template: '%s | Elektroplaner',
    });
    // Ein vererbter Homepage-Canonical oder ein Homepage-Open-Graph auf einer
    // Fehlerroute wäre widersprüchlich. Indexierbare Seiten setzen beides über
    // metadataForPage() selbst.
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toBeUndefined();
    expect(metadata.twitter).toBeUndefined();
  });
});
