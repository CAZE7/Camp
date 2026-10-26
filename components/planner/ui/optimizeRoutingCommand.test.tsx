/**
 * Regression zur Nutzer-Rückmeldung 2026-10-26: „Optimieren“ war ein eigener
 * Chip in der Werkzeugleiste und stand zusätzlich im `⋯`-Menü — neben
 * „Vorschlag prüfen“ wirkte das wie zwei Automatikknöpfe. Der Chip ist weg,
 * die Aktion lebt im Menü. Der Befehl bleibt derselbe und bleibt gesperrt,
 * solange kein gültiger Routingstand vorliegt oder der Optimierungslauf
 * bereits verbraucht ist.
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useOptimizeRoutingCommand } from './optimizeRoutingCommand';
import { clearCableRoutes, publishCableRouteGeneration } from '../../edges/utils/cableRouteStore';

afterEach(() => {
  cleanup();
  clearCableRoutes();
});

describe('useOptimizeRoutingCommand', () => {
  it('ist ohne aktuellen Plan gesperrt und wird mit einem gültigen Stand frei', () => {
    const { result } = renderHook(() => useOptimizeRoutingCommand());
    expect(result.current.disabled).toBe(true);

    act(() =>
      publishCableRouteGeneration({
        hash: 'h',
        generation: 1,
        revision: 1,
        allowed: true,
        converged: true,
        state: 'valid',
      })
    );
    expect(result.current.disabled).toBe(false);

    // Nach dem Optimierungslauf bleibt der zweite Lauf gesperrt.
    act(() =>
      publishCableRouteGeneration({
        hash: 'h',
        generation: 1,
        revision: 2,
        allowed: true,
        converged: true,
        state: 'partial',
        optimization: { attempted: 4, accepted: 1, budgetExhausted: true },
      })
    );
    expect(result.current.disabled).toBe(true);
  });
});
