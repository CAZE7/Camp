import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useCableRouteFinalValidation } from '../../edges/utils/cableRouteStore';
import { totalViolations } from '../../../lib/routing/finalValidation';

/**
 * AUDIT F-07 — sichtbare Routing-Final-Gate-Anzeige.
 *
 * `validateFinalRouting` ist absichtlich binär und darf `INVALID` melden,
 * solange der Router in einzelnen Plänen noch I1/I2/I3-Restverletzungen
 * erzeugt. Damit dieser Zustand nicht stillschweigend bleibt, zeigt der
 * Planer hier immer den Ergebnisstatus des zuletzt gerouteten Plans an:
 *
 * - `VALID`    → grün "Routing verifiziert"
 * - `INVALID`  → orange "Routing: n Zwänge nicht erreicht", mit Tooltip
 *                über I1 (Leitung × Bauteil), I2 (Leitung × Leitung) und
 *                I3 (Mindestabstand).
 * - undefined  → neutral, solange der erste Routinglauf noch nicht fertig
 *                ist.
 *
 * Die Anzeige liest denselben Report, den der Router beim Publizieren der
 * Waypoints erzeugt hat — nicht eine Neuberechnung im Render-Pfad.
 */
export function RoutingStatusBadge() {
  const report = useCableRouteFinalValidation();

  if (!report) {
    return (
      <span
        className="inline-flex h-11 items-center justify-center gap-1 rounded border border-border bg-accent px-2 text-xs font-semibold text-muted-foreground"
        title="Der Kabelrouting-Status wird nach dem ersten Routinglauf angezeigt."
      >
        <span className="h-2 w-2 rounded-full bg-muted-foreground/40" aria-hidden="true" />
        <span className="hidden xl:inline">Routing: wartet</span>
      </span>
    );
  }

  const total = totalViolations(report.counts);
  if (report.status === 'VALID') {
    // ROUTE-BUG-36: Die Not-Freigabe muss auch im grünen Fall sichtbar
    // bleiben. Seit der Stub-Kappung (ROUTE-BUG-31) ist sie kein Fehler
    // mehr, sondern der geregelte Ausgang für enge Stellen: I3 ist
    // eingehalten, aber die volle Freigabe war dort nicht erreichbar. Wer
    // nur das grüne Badge sieht, hält den Plan für großzügiger, als er ist.
    const tight = report.tightMarginRoutes ?? 0;
    const detail =
      `${report.edgeCount} Kanten, I1=0, I2=0, I3=0` +
      (tight > 0
        ? ` — davon ${tight} Leitung(en) mit Not-Freigabe verlegt ` +
          `(Stub endet an der Bauteil-Freigabe): Mindestabstand eingehalten, ` +
          `Bündel-Staffelung dort eingeschränkt`
        : '');
    return (
      <span
        data-testid="routing-status-valid"
        role="status"
        aria-label="Routing verifiziert"
        title={detail}
        className="inline-flex h-11 items-center justify-center gap-1 rounded border border-success/40 bg-success/10 px-2 text-xs font-semibold text-success"
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        <span className="hidden xl:inline">Routing verifiziert</span>
      </span>
    );
  }

  const countText = total === 1 ? '1 Zwang' : `${total} Zwänge`;
  const detail = [
    `${report.edgeCount} geprüfte Kanten`,
    `I1 Leitungen × Bauteile: ${report.counts.edgeNodeCollisions}`,
    `I2 Leitung × Leitung: ${report.counts.edgeEdgeOverlaps}`,
    `I3 Mindestabstand: ${report.counts.clearanceViolations}`,
    // ROUTE-BUG-23: Die Ursache nennen, nicht nur die Zahl. Eine Leitung mit
    // `tightMarginUsed` liegt enger am Bauteil als erlaubt, weil Port-Stub
    // und Mindestabstand dort geometrisch nicht gleichzeitig passen.
    ...(report.tightMarginRoutes
      ? [
          `davon ${report.tightMarginRoutes} Leitung(en) mit unterschrittenem Abstand, ` +
            `weil Port-Stub und Mindestabstand geometrisch nicht gleichzeitig passen`,
        ]
      : []),
    'Der Plan ist damit nicht layout-verifiziert. Bitte Leitungen umlegen bzw. Abstände vergrößern.',
  ].join(' — ');
  return (
    <span
      data-testid="routing-status-invalid"
      role="status"
      aria-label={`Routing: ${countText} nicht erreicht`}
      title={detail}
      className="inline-flex h-11 items-center justify-center gap-1 rounded border border-oxide/50 bg-oxide/10 px-2 text-xs font-semibold text-oxide"
    >
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      <span className="hidden xl:inline">Routing: {countText} nicht erreicht</span>
    </span>
  );
}
