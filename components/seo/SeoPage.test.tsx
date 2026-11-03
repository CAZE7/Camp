import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AUTHOR_PROFILE_PATH, SITE_AUTHOR } from '@/lib/author';
import type { SeoPageContent } from '@/lib/seo/types';

import { jsonLdFor, SeoPage } from './SeoPage';

/**
 * Der Tisch-Scrollbereich ist der einzige Ort im Gerüst, an dem Inhalt breiter
 * als der Text werden kann. Er muss per Tastatur erreichbar sein — die
 * axe-Regel `scrollable-region-focusable` hat genau das im
 * Barrierefreiheitslauf angemahnt (WCAG 2.1.1). Dieser Test hält die
 * Eigenschaft ohne Browser fest; der eigentliche Nachweis läuft in
 * `tests/e2e/a11y.spec.ts`.
 */
const SEITE: SeoPageContent = {
  path: '/pruefseite/',
  slug: 'pruefseite',
  topicId: 'camper-elektrik',
  kind: 'cluster',
  title: 'Prüfseite',
  description: 'Eine Seite für den Test des Gerüsts, ohne Aussage über die Anwendung selbst.',
  h1: 'Prüfseite',
  lead: 'Einleitungstext.',
  priority: 'P3',
  sections: [
    {
      id: 'tabelle',
      heading: 'Spannungsfall je Querschnitt',
      table: {
        caption: 'Modellrechnung bei 12 V',
        head: ['Querschnitt', 'ΔU'],
        rows: [['2,5 mm²', '5,75 %']],
      },
    },
    {
      id: 'liste',
      heading: 'Reihenfolge',
      list: { items: ['Erst rechnen', 'Dann verlegen'], ordered: true },
    },
  ],
  related: [{ href: '/camper-elektrik/', label: 'Überblick' }],
  contentRevision: '2026-10',
  changeFrequency: 'monthly',
  sitemapPriority: 0.5,
};

describe('SeoPage', () => {
  it('gibt dem scrollbaren Tabellenrahmen einen Tab-Schritt und einen Namen', () => {
    render(<SeoPage page={SEITE} />);

    const region = screen.getByRole('group', { name: 'Tabelle: Spannungsfall je Querschnitt' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region.querySelector('table')).not.toBeNull();
  });

  it('zeigt Tabelle, Bildunterschrift und den weiteren Weg', () => {
    render(<SeoPage page={SEITE} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Modellrechnung bei 12 V')).toBeInTheDocument();
    // Next normalisiert im gerenderten href den abschließenden Schrägstrich;
    // im Export steht wieder die volle Adresse (geprüft von scripts/seo/).
    expect(screen.getByRole('link', { name: 'Überblick' })).toHaveAttribute('href', '/camper-elektrik');
  });

  it('nennt den Autor und verweist auf seine Vorstellung', () => {
    // E-E-A-T: Eine Seite ohne erkennbare Urheberschaft ist schwächer
    // einzuordnen. Der Name ist derselbe wie im Impressum (Test in
    // lib/author.test.ts), der Verweis führt auf die Autorenvorstellung.
    render(<SeoPage page={SEITE} />);

    const zeile = screen.getByText(new RegExp(`Von ${SITE_AUTHOR.name}`));
    expect(zeile).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Wer schreibt hier' });
    // Im gebauten Export steht `/ueber-elektroplaner/#autor`; beim Rendern im
    // Test entfernt Next den Schrägstrich vor dem Fragment. Beide Formen
    // führen zum selben Anker, deshalb wird der Pfad geprüft, nicht die
    // Zeichenkette.
    expect(AUTHOR_PROFILE_PATH).toBe('/ueber-elektroplaner/#autor');
    expect(link?.getAttribute('href')).toMatch(/^\/ueber-elektroplaner\/?#autor$/);
  });

  it('nennt den Autor auch in der strukturierten Beschreibung', () => {
    const graph = jsonLdFor(SEITE) as {
      '@graph': Array<Record<string, unknown>>;
    };
    const webPage = graph['@graph'].find((node) => node['@type'] === 'WebPage');
    expect(webPage?.['author']).toEqual({ '@id': 'https://elektroplaner-camper.de/#author' });
    // Die Person selbst steht im Wurzel-Layout, nicht auf jeder Seite — der
    // Verweis muss aber auf einen Knoten zeigen, der im Dokument existiert
    // (geprüft im Export-Audit: json-ld-autor).
    expect(graph['@graph'].some((node) => node['@type'] === 'Person')).toBe(false);
    expect(webPage?.['dateModified']).toBeUndefined();
  });

  it('beschreibt die Seite in genau einer Hauptüberschrift', () => {
    render(<SeoPage page={SEITE} />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Prüfseite');
  });
});
