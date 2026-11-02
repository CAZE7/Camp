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
      document.querySelectorAll('a[href^="http"], a[href^="https"]') as HTMLAnchorElement[]
    ).filter((a) => !a.href.startsWith(window.location.origin));

    expect(external.length).toBeGreaterThan(0);
    for (const anchor of external) {
      expect(anchor.target).toBe('_blank');
      expect(anchor.rel).toContain('noopener');
      expect(anchor.rel).toContain('noreferrer');
    }
  });
});
