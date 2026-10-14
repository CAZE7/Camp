import { requestCableRouteOptimization, useCableRouteGeneration } from '../../edges/utils/cableRouteStore';

/** Separate from ELK: this operation never moves devices. */
export function OptimizeRoutingButton() {
  const generation = useCableRouteGeneration();
  const disabled =
    !generation ||
    generation.state === 'pending' ||
    generation.state === 'routing' ||
    !!generation.optimization;
  return (
    <button
      type="button"
      className="inline-flex h-11 items-center rounded border border-border px-2 text-xs font-semibold disabled:opacity-50"
      disabled={disabled}
      onClick={requestCableRouteOptimization}
      title="Bis zu vier Kabel werden mit allen anderen als feste Hindernisse neu geprüft. Nur gültige, global bessere Ergebnisse werden übernommen. Geräte bleiben stehen."
    >
      Kabel optimieren
    </button>
  );
}
