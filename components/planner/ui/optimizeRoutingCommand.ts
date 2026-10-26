import { requestCableRouteOptimization, useCableRouteGeneration } from '../../edges/utils/cableRouteStore';

/**
 * „Kabel optimieren“ — Befehl und Sperrbedingung an EINER Stelle.
 *
 * Vorher stand diese Aktion als eigener Chip in der Werkzeugleiste und
 * zusätzlich im `⋯`-Menü. Neben „Vorschlag prüfen“ (Auto-verbinden) las sich
 * das wie zwei Automatikknöpfe für dieselbe Tätigkeit — Befund der
 * Nutzer-Rückmeldung 2026-10-26 („Knöpfe, die doppelt sind, wie Optimieren und
 * dieser andere Automatik-Knopf“). Seitdem gibt es genau einen sichtbaren
 * Automatik-Einstieg („Vorschlag prüfen“); die beiden nachgelagerten
 * Automatikschritte („Plan automatisch ordnen“, „Kabel optimieren“) stehen
 * gemeinsam in der Gruppe „Automatik“ des Menümodells
 * (`usePlannerActions.menus.werkzeuge`) und damit in Menüleiste und `⋯`.
 *
 * Der Hook bleibt trotzdem hier: Er ist die eine Beschreibung der
 * Sperrbedingung. Zwei Beschreibungen derselben Aktion wären zwei
 * Gelegenheiten, sie unterschiedlich zu verdrahten.
 */
export function useOptimizeRoutingCommand(): { disabled: boolean; run: () => void } {
  const generation = useCableRouteGeneration();
  return {
    disabled:
      !generation ||
      generation.state === 'pending' ||
      generation.state === 'routing' ||
      !!generation.optimization,
    run: requestCableRouteOptimization,
  };
}
