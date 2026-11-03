import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CALCULATOR_BUNDLE_MARKERS } from '@/scripts/seo/checks';

import { LadestromRechner } from './LadestromRechner';

/**
 * Die Zusagen des Ladestrom-Rechners.
 *
 * Gate G12 verlangt, dass die sechs Ausgaben des alten, handgeschriebenen
 * Rechners zeichenidentisch bleiben — `lib/boosterSizing.test.ts` pinnt die
 * Zahlen, dieser Test die gerenderten Zeichenketten, die
 * `tests/e2e/ladebooster-vergleich.spec.ts` seit dem ersten Vergleich einfriert.
 */

const feld = (label: string) => screen.getByLabelText(label);

describe('LadestromRechner — eingefrorene Ausgaben', () => {
  it('zeigt mit den Vorbelegungen 330 Ah / 5 h / 180 A dieselben drei Werte', () => {
    render(<LadestromRechner />);

    expect(feld('Batteriekapazität (Ah)')).toHaveValue('330');
    expect(feld('Gewünschte Fahrzeit (h)')).toHaveValue('5');
    expect(feld('Lichtmaschine (A)')).toHaveValue('180');

    expect(screen.getByText('79 A · 0,24 C', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('90-A-Klasse', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('130 A · 72 %', { exact: true })).toBeInTheDocument();
  });

  it('zeigt mit 100 Ah / 5 h / 180 A dieselben drei Werte', () => {
    render(<LadestromRechner />);

    fireEvent.change(feld('Batteriekapazität (Ah)'), { target: { value: '100' } });

    expect(screen.getByText('24 A · 0,24 C', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('30-A-Klasse', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('53 A · 30 %', { exact: true })).toBeInTheDocument();
  });
});

describe('LadestromRechner — Eingaben', () => {
  it('nennt den Bereich, statt eine Zahl außerhalb auszugeben', () => {
    render(<LadestromRechner />);

    fireEvent.change(feld('Batteriekapazität (Ah)'), { target: { value: '10' } });

    expect(screen.getByText(/zwischen 50 und 1200 Ah/)).toBeInTheDocument();
    expect(screen.queryByText('90-A-Klasse', { exact: true })).not.toBeInTheDocument();
  });

  it('benennt eine unlesbare Eingabe, statt sie als null zu rechnen', () => {
    render(<LadestromRechner />);

    fireEvent.change(feld('Gewünschte Fahrzeit (h)'), { target: { value: 'abc' } });

    expect(screen.getByText(/Zahlen eingeben/)).toBeInTheDocument();
  });

  it('zeigt bei geleertem Feld den Hinweis statt eines Ergebnisrests', () => {
    render(<LadestromRechner />);

    fireEvent.change(feld('Lichtmaschine (A)'), { target: { value: ' ' } });

    expect(screen.getByText(/der Rechner nennt die passende Stromklasse/i)).toBeInTheDocument();
    expect(screen.queryByText('130 A · 72 %', { exact: true })).not.toBeInTheDocument();
  });

  it('rechnet Blei mit dem engeren Ladefenster', () => {
    render(<LadestromRechner />);

    fireEvent.change(feld('Batteriechemie'), { target: { value: 'Blei' } });

    // 79 A Zielstrom liegen im Blei-Fenster 66–99 A — das Gerät wird nicht
    // auf den unteren Rand gezogen, die Lichtmaschine sieht weniger Strom.
    expect(screen.getByText('108 A · 60 %', { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/im Blei-Fenster \(66–99 A\)/)).toBeInTheDocument();
  });
});

describe('LadestromRechner — Einbindung', () => {
  it('trägt die Feld-Kennungen, die das Bündel-Gate als Marker prüft', () => {
    const marker = CALCULATOR_BUNDLE_MARKERS.find((entry) => entry.id === 'ladestrom');
    expect(marker).toBeDefined();

    const { container } = render(<LadestromRechner />);
    for (const id of marker!.markers) {
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it('liefert das Ergebnis im Roh-HTML, damit der Kasten nicht erst nach der Hydration erscheint', () => {
    const html = renderToString(<LadestromRechner />);

    expect(html).toContain('90-A-Klasse');
    expect(html).toContain('79 A · 0,24 C');
    expect(html).toContain('130 A · 72 %');
  });
});
