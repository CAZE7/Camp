import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SeoPageContent } from '@/lib/seo/types';

import { SeoPage } from './SeoPage';

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

  it('beschreibt die Seite in genau einer Hauptüberschrift', () => {
    render(<SeoPage page={SEITE} />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Prüfseite');
  });
});
