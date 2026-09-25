import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WarningCenter } from './WarningCenter';
import type { ValidationWarning } from '../hooks/useLiveValidation';

/**
 * AUDIT A5/A6 — die Warn-Zentrale muss auch ohne Sehen und ohne Maus lesbar sein.
 *
 * Der Audit hat zwei konkrete Ausfälle gemessen:
 *
 *  · **A6 (Screenreader):** Die Live-Region (`role="status"`,
 *    `aria-live="polite"`) stand HINTER dem frühen `return` für „keine
 *    Hinweise“. Ein neu hinzugekommener kritischer Hinweis wurde dadurch nie
 *    angesagt: Der Knoten erschien mit seinem Inhalt zusammen, statt seinen
 *    Inhalt zu wechseln — Screenreader lesen live-Regionen aber nur vor, wenn
 *    sich der Text IN einem bereits vorhandenen Knoten ändert.
 *  · **A5 (Schwere ohne Farbe):** Die Schwere hing unter 1280 px allein am
 *    Hintergrund (rot/gelb/blau). Wer Rot nicht unterscheiden kann, sah die
 *    Zahl, aber nicht, dass es kritisch ist.
 */

const warning = (over: Partial<ValidationWarning> = {}): ValidationWarning => ({
  id: 'w1',
  category: 'safety',
  type: 'critical',
  title: 'Leitung thermisch überlastet',
  message: 'Kritisch: Die Leitung führt zu viel Strom.',
  ...over,
});

describe('WarningCenter — Barrierefreiheit (AUDIT A5/A6)', () => {
  it('A6: die Live-Region existiert AUCH im Zustand „keine Hinweise“', () => {
    render(<WarningCenter warnings={[]} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Keine Prüfhinweise im Plan.');
  });

  it('A6: dieselbe Live-Region meldet Anzahl und kritische Treffer', () => {
    const { rerender } = render(<WarningCenter warnings={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent('Keine Prüfhinweise im Plan.');

    rerender(
      <WarningCenter warnings={[warning(), warning({ id: 'w2', type: 'info', category: 'estimation' })]} />
    );

    // Der Knoten bleibt bestehen, nur sein Inhalt wechselt — genau das löst die
    // Ansage aus. Zusätzlich wird die kritische Zahl genannt, nicht nur „2“.
    expect(screen.getByRole('status')).toHaveTextContent('2 Prüfhinweise im Plan, davon 1 kritisch.');
  });

  it('A5: „Kritisch“ steht als Wort im Abzeichen, nicht nur als Rotton', () => {
    render(<WarningCenter warnings={[warning()]} />);

    expect(screen.getByRole('button', { name: /1 Prüfhinweise anzeigen/ })).toHaveTextContent('Kritisch');
  });

  it('A5: bei bloßen Hinweisen steht die Schwere ebenfalls als Wort da', () => {
    render(<WarningCenter warnings={[warning({ type: 'info', category: 'estimation' })]} />);

    const badge = screen.getByRole('button', { name: /1 Prüfhinweise anzeigen/ });
    expect(badge).toHaveTextContent('Hinweis');
    expect(badge).not.toHaveTextContent('Kritisch');
  });
});
