import { readFileSync } from 'node:fs';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LadeboosterVergleich } from './LadeboosterVergleich';

describe('LadeboosterVergleich', () => {
  it('rendert Geräte, Tabelle und den Standardfall des Rechners', async () => {
    render(<LadeboosterVergleich />);

    expect(
      screen.getByRole('heading', { name: 'Ladebooster im Vergleich: 30, 60 oder 90 A?' })
    ).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /Geräteüberblick/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Orion-Tr Smart 12/12-30' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'VCC 1212-90' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('90-A-Klasse', { exact: true })).toBeInTheDocument();
    });
    expect(screen.getByText('79 A · 0,24 C', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('130 A · 72 %', { exact: true })).toBeInTheDocument();
  });

  it('filtert die Gerätekarten nach Klasse', () => {
    render(<LadeboosterVergleich />);

    fireEvent.click(screen.getByRole('button', { name: '60–70 A' }));

    const orion = screen.getByRole('heading', { name: 'Orion-Tr Smart 12/12-30' }).closest('article');
    const ective = screen.getByRole('heading', { name: 'BB 60' }).closest('article');

    expect(orion).toHaveClass('is-hidden');
    expect(ective).not.toHaveClass('is-hidden');
  });

  /**
   * Regressionstest Audit 2026-11-02: alle 54 externen Links der Seite —
   * „Handbuch", „Preis / Händler", „Datenblatt", Forum-Beiträge — öffneten im
   * selben Tab. Wer mitten in der Vergleichstabelle einen Beleg anklickte,
   * verließ die Seite und stand danach vor einem leeren Browserverlauf.
   */
  it('öffnet jeden externen Beleg in einem neuen Tab und verschluckt die Seite nicht', () => {
    render(<LadeboosterVergleich />);

    const external = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href^="http"], a[href^="https"]')
    ).filter((a) => !a.href.startsWith(window.location.origin));

    expect(external.length).toBeGreaterThan(0);
    for (const anchor of external) {
      expect(anchor.target).toBe('_blank');
      expect(anchor.rel).toContain('noopener');
      expect(anchor.rel).toContain('noreferrer');
    }
  });
});

/**
 * Befund der Agenten-Sitzung „Ladebooster Vergleichsplan": zwei Kacheln mit
 * „Eigenes Foto folgt" standen sichtbar auf der Live-Seite. Sichtbare
 * Unfertigkeit kostet Vertrauen; echte Bilder kommen erst mit den eigenen
 * Aufnahmen (BILDRECHTE.md Regel 5). Der Text bleibt, das Versprechen nicht.
 */
describe('LadeboosterVergleich — keine Foto-Platzhalter', () => {
  it('zeigt keine „Foto folgt"-Kacheln und keinen Foto-Slot mehr', () => {
    const { container } = render(<LadeboosterVergleich />);

    expect(container.textContent).not.toContain('Eigenes Foto folgt');
    expect(container.querySelectorAll('[data-photo-slot]')).toHaveLength(0);
    expect(container.querySelectorAll('.lb-photo-slot')).toHaveLength(0);
  });

  it('hält die Aussage als Text mit einem internen Verweis fest', () => {
    render(<LadeboosterVergleich />);
    expect(screen.getByRole('link', { name: 'Kabelquerschnitt-Rechner' })).toBeInTheDocument();
  });
});

/**
 * Fertige Vergleichsseite (2026-11-03): Filter wirkt auf Tabelle UND Karten,
 * Sortierung ist bedienbar, alle Karten haben dieselbe Attribut-Reihenfolge,
 * und kein langer Satz steht zweimal auf der Seite.
 */
describe('LadeboosterVergleich — fertige Scan-Schicht', () => {
  it('filtert Rangliste und Produktkarten gemeinsam', () => {
    const { container } = render(<LadeboosterVergleich />);
    const zeilen = Array.from(container.querySelectorAll<HTMLTableRowElement>('tr[data-lb-class]'));
    const karten = Array.from(container.querySelectorAll<HTMLElement>('article[data-lb-class]'));

    expect(zeilen).toHaveLength(9);
    expect(karten).toHaveLength(9);

    fireEvent.click(screen.getByRole('button', { name: '60–70 A' }));

    for (const element of [...zeilen, ...karten]) {
      const sichtbar = element.dataset.lbClass === '60';
      expect(element.classList.contains('is-hidden'), `${element.tagName} ${element.dataset.lbClass}`).toBe(
        !sichtbar
      );
    }
    expect(screen.getByRole('button', { name: '60–70 A' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Alle' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Alle' }));
    expect([...zeilen, ...karten].every((element) => !element.classList.contains('is-hidden'))).toBe(true);
  });

  it('meldet die Zahl der sichtbaren Geräte zurück', () => {
    const { container } = render(<LadeboosterVergleich />);
    const zaehler = container.querySelector('[data-lb-count]');
    expect(zaehler).toHaveTextContent('9 von 9 Geräten');

    fireEvent.click(screen.getByRole('button', { name: '30 A' }));
    expect(zaehler).toHaveTextContent('1 von 9 Geräten');
  });

  it('bietet eine Sortierung mit sichtbarem Zustand', () => {
    render(<LadeboosterVergleich />);
    const preis = screen.getByRole('button', { name: 'Nach Preis' });
    expect(preis).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(preis);
    expect(preis).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Rangfolge' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('gibt jeder Karte dieselben acht Attribute und einen Deeplink-Anker', () => {
    const { container } = render(<LadeboosterVergleich />);
    const karten = Array.from(container.querySelectorAll<HTMLElement>('article[data-lb-class]'));
    const ersteLabels = Array.from(karten[0]!.querySelectorAll('dt')).map((dt) => dt.textContent);
    expect(ersteLabels).toHaveLength(8);
    for (const karte of karten) {
      expect(Array.from(karte.querySelectorAll('dt')).map((dt) => dt.textContent)).toEqual(ersteLabels);
      expect(karte.id).toMatch(/^p-/);
      expect(karte.querySelector('h4')?.textContent?.length).toBeGreaterThan(0);
    }
  });

  it('wiederholt keinen langen Satz auf der Seite', () => {
    const { container } = render(<LadeboosterVergleich />);
    const texte = Array.from(container.querySelectorAll('p, dd, li, figcaption'))
      .map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter((text) => text.length >= 60);
    const doppelt = texte.filter((text, index) => texte.indexOf(text) !== index);
    expect(doppelt, doppelt.slice(0, 3).join('\n---\n')).toEqual([]);
  });
});

/** Das Stylesheet gehört nur noch auf diese Route, nicht in die globale Kopfzeile. */
describe('LadeboosterVergleich — kein globales CSS', () => {
  it('importiert app/layout.tsx das Vergleichs-Stylesheet nicht mehr', () => {
    const layout = readFileSync('app/layout.tsx', 'utf8');
    expect(layout).not.toContain('ladebooster-vergleich.css');
  });

  it('alle externen Belege bleiben in einem neuen Tab', () => {
    const { container } = render(<LadeboosterVergleich />);
    const external = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href^="https://"]'));
    expect(external.length).toBeGreaterThan(0);
    for (const anchor of external) {
      expect(anchor.target).toBe('_blank');
      expect(anchor.rel).toContain('noopener');
      expect(anchor.rel).toContain('noreferrer');
    }
  });
});
