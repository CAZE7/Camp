import { requestCableRouteOptimization, useCableRouteGeneration } from '../../edges/utils/cableRouteStore';

/**
 * Dieselbe Sperrbedingung, die den Knopf in der Werkzeugleiste sperrt — als
 * Hook, damit der `⋯`-Eintrag (Zugang auf 320 px, wo der Knopf aus der Leiste
 * weicht) nicht auseinanderläuft: zwei Beschreibungen derselben Aktion wären
 * zwei Gelegenheiten, sie unterschiedlich zu verdrahten.
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

/**
 * Separat von ELK: Diese Aktion verschiebt niemals Geräte.
 *
 * Beschriftung und Breite (M12): In der Werkzeugleiste steht bis 1850 px nur
 * „Optimieren“ — „Kabel optimieren“ ist ~35 px breiter. Der **zugängliche**
 * Name bleibt in jeder Breite vollständig (`aria-label`), und „Optimieren“ ist
 * darin enthalten (WCAG 2.5.3 „Label in Name“). Unter 360 px nimmt
 * `globals.css` (§7a) den Knopf ganz aus der Leiste; dort trägt das
 * `⋯`-Menü dieselbe Aktion als `action-optimize-routing`.
 */
export function OptimizeRoutingButton() {
  const { disabled, run } = useOptimizeRoutingCommand();
  return (
    <button
      type="button"
      aria-label="Kabel optimieren"
      /* `cad-status-optimize`: Anker für die CSS-Regel, die den Knopf unter
         360 px aus der Leiste nimmt (globals.css §7a). */
      className="cad-status-optimize inline-flex h-11 items-center rounded border border-border px-2 text-xs font-semibold disabled:opacity-50"
      disabled={disabled}
      onClick={run}
      title="Bis zu vier Kabel werden mit allen anderen als feste Hindernisse neu geprüft. Nur gültige, global bessere Ergebnisse werden übernommen. Geräte bleiben stehen."
    >
      <span className="cad-tb-explain">Kabel optimieren</span>
      <span className="cad-tb-short">Optimieren</span>
    </button>
  );
}
