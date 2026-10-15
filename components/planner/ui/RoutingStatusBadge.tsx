import { AlertTriangle, CheckCircle2, OctagonAlert, Repeat2, RefreshCw } from 'lucide-react';
import { useCableRouteSnapshot, type CableRoutePhase } from '../../edges/utils/cableRouteStore';
import { totalViolations } from '../../../lib/routing/finalValidation';

/**
 * UI-AUDIT 2026-10-13 — Vertrag zwischen Routing-Phasen und E2E-Selektoren.
 *
 * Das Badge ist die einzige Stelle, an der der Routing-Lebenszyklus im DOM
 * sichtbar wird. `tests/e2e/routing-stability.spec.ts` wartet auf diesen
 * Zustand, läuft aber nicht in jedem lokalen Lauf (echter Browser). Damit eine
 * neue Phase nicht unbemerkt ohne Selektor bleibt, ist die Zuordnung hier
 * ausdrücklich ausformuliert und durch `components/e2eSelectors.test.tsx`
 * gegen den Quelltext und die Spec geprüft.
 *
 * Der `Record`-Typ erzwingt Vollständigkeit zur Compile-Zeit: Kommt eine Phase
 * in `CableRoutePhase` hinzu, bricht `npm run typecheck` so lange, bis sie hier
 * einen Selektor hat.
 */
export const ROUTING_STATUS_TESTID: Readonly<Record<CableRoutePhase, string>> = {
  idle: 'routing-status-idle',
  routing: 'routing-status-stale',
  valid: 'routing-status-valid',
  invalid: 'routing-status-invalid',
  'not-converged': 'routing-status-not-converged',
  error: 'routing-status-error',
};

/**
 * Phasen, in denen ein Routing-Lauf ABGESCHLOSSEN ist — Ergebnis, Regelverstoß,
 * Konvergenzschranke oder Fehler. `idle` (noch nichts passiert) und `routing`
 * (Lauf angekündigt) gehören nicht dazu: Wer auf „fertig" wartet, darf auf
 * diese beiden nicht reagieren.
 */
export const ROUTING_TERMINAL_PHASES: readonly CableRoutePhase[] = [
  'valid',
  'invalid',
  'not-converged',
  'error',
];

/**
 * AUDIT F-07 — sichtbare Routing-Final-Gate-Anzeige.
 *
 * `validateFinalRouting` ist absichtlich binär und darf `INVALID` melden,
 * solange der Router in einzelnen Plänen noch I1/I2/I3-Restverletzungen
 * erzeugt. Damit dieser Zustand nicht stillschweigend bleibt, zeigt der
 * Planer hier immer den Ergebnisstatus des zuletzt gerouteten Plans an:
 *
 * - `VALID`    → grün "Routing verifiziert"
 * - `INVALID`  → orange "Routing prüfen · n Regelverletzungen", mit Tooltip
 *                über die betroffenen Invarianten und den nächsten sinnvollen
 *                Schritt. Die Zahl „Regelverletzungen" ist die Summe der
 *                Final-Gate-Befunde, kein einzelner Routing-Score.
 * - undefined  → neutral, solange der erste Routinglauf noch nicht fertig
 *                ist.
 *
 * Die Anzeige liest denselben Report, den der Router beim Publizieren der
 * Waypoints erzeugt hat — nicht eine Neuberechnung im Render-Pfad.
 */
export function RoutingStatusBadge() {
  // UI-AUDIT RS-001/RS-002: EIN Snapshot statt zwei getrennter Abos.
  // Vorher las das Badge den Report und die Generation aus zwei Zuständen,
  // die nacheinander publiziert wurden — für die Dauer eines Laufs zeigte es
  // damit die Regelverletzungen der VORGÄNGER-Eingabe als aktuellen Stand.
  const { report, generation, phase, errorMessage } = useCableRouteSnapshot();

  // Spec #19 (ROUTING_NOT_CONVERGED): Wenn der Tracker für dieselbe Eingabe
  // zu viele Läufe gezählt hat und weitere Läufe verbietet, ist das ein
  // eigener Zustand — nicht stillschweigend weitermachen. Die Meldung
  // nennt die Ursache (Rückkopplung), nicht eine generische „Fehler\"-Floskel.
  if (generation && generation.allowed === false) {
    return (
      <span
        data-testid="routing-status-not-converged"
        role="alert"
        aria-live="polite"
        aria-label="Routing konvergiert nicht"
        title={`${generation.reason ?? 'Routing hat die Konvergenzschranke erreicht.'} Es entsteht keine Endlosschleife; der letzte gültige Stand wird angezeigt. Ein kleines Verschieben eines Bauteils löst das Problem üblicherweise.`}
        className="border-error/50 bg-error/10 text-error inline-flex h-11 items-center justify-center gap-1 rounded border px-2 text-xs font-semibold"
      >
        <Repeat2 className="h-4 w-4" aria-hidden="true" />
        <span className="hidden xl:inline">Routing: Konvergenzfehler</span>
      </span>
    );
  }

  // UI-AUDIT RS-003: Ein fehlgeschlagener Lauf. Die letzte Geometrie bleibt
  // stehen (failCableRouteRun verwirft sie nicht) — das muss die Anzeige
  // genauso sagen, sonst wirkt ein Fehler wie ein stiller Planverlust.
  if (phase === 'error') {
    return (
      <span
        data-testid="routing-status-error"
        role="alert"
        aria-live="polite"
        aria-label="Routing fehlgeschlagen"
        title={
          `Der letzte Routing-Lauf ist fehlgeschlagen: ${errorMessage ?? 'unbekannter Fehler'}. ` +
          (report
            ? 'Die zuletzt geprüfte Trassenführung bleibt angezeigt; sie gehört zur vorherigen Eingabe. Verschiebe ein Bauteil leicht, um einen neuen Lauf auszulösen.'
            : 'Es ist noch keine Trassenführung veröffentlicht. Verschiebe ein Bauteil leicht, um einen neuen Lauf auszulösen.')
        }
        className="border-error/50 bg-error/10 text-error inline-flex h-11 items-center justify-center gap-1 rounded border px-2 text-xs font-semibold"
      >
        <OctagonAlert className="h-4 w-4" aria-hidden="true" />
        <span className="hidden xl:inline">Routing fehlgeschlagen</span>
      </span>
    );
  }

  // UI-AUDIT RS-002: Eingabe geändert, Ergebnis noch nicht veröffentlicht.
  // Die angezeigten Wege gehören einer älteren Eingabe — das darf nicht als
  // „verifiziert“ durchgehen. Der Report bleibt bewusst sichtbar (er ist der
  // letzte geprüfte Stand), wird aber ausdrücklich als veraltet markiert.
  if (phase === 'routing') {
    const stale = report !== undefined;
    const publishedEdges = report?.edgeCount ?? 0;
    const detail = stale
      ? `Die Eingabe hat sich geändert; ein neuer Routing-Lauf ist angekündigt. ` +
        `Angezeigt wird noch der Stand der vorherigen Eingabe ` +
        `(Generation ${generation?.generation ?? 0} läuft, veröffentlicht sind ` +
        `${publishedEdges} Kanten aus einem früheren Lauf). ` +
        `Die Bewertung wird ersetzt, sobald der Lauf fertig ist.`
      : 'Der erste Routing-Lauf ist angekündigt; noch ist keine Trassenführung veröffentlicht.';
    return (
      <span
        data-testid="routing-status-stale"
        role="status"
        aria-live="polite"
        aria-label={stale ? 'Routing läuft, Anzeige veraltet' : 'Routing läuft'}
        title={detail}
        className="inline-flex h-11 items-center justify-center gap-1 rounded border border-border bg-accent px-2 text-xs font-semibold text-muted-foreground"
      >
        <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span className="hidden xl:inline">{stale ? 'Routing läuft · veraltet' : 'Routing läuft'}</span>
      </span>
    );
  }

  if (!report) {
    return (
      <span
        data-testid="routing-status-idle"
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
    // ROUTE-BUG-36: Die verringerte normale Bauteil-Reserve muss auch im
    // grünen Fall sichtbar bleiben. `VALID` bedeutet, dass I1–I3 den
    // verbindlichen Mindestabstand bestätigen; eine Reserve unter
    // `OBSTACLE_MARGIN` ist ein separater Hinweis auf eine Engstelle.
    const tight = report.tightMarginRoutes ?? 0;
    const detail =
      `${report.edgeCount} Kanten, I1=0, I2=0, I3=0` +
      (tight > 0
        ? ` — davon ${tight} Leitung(en) mit verringerter Bauteil-Reserve ` +
          `(Engstelle): verbindlicher Mindestabstand eingehalten, ` +
          `zusätzliche Routing-Reserve geringer`
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

  const countText = total === 1 ? '1 Regelverletzung' : `${total} Regelverletzungen`;
  const causes = [
    ...(report.counts.edgeNodeCollisions > 0
      ? [`I1 Bauteil-Kollisionen: ${report.counts.edgeNodeCollisions}`]
      : []),
    ...(report.counts.edgeEdgeOverlaps > 0
      ? [`I2 Leitungs-Überdeckungen: ${report.counts.edgeEdgeOverlaps}`]
      : []),
    ...(report.counts.clearanceViolations > 0
      ? [`I3 Mindestabstands-Verstöße: ${report.counts.clearanceViolations}`]
      : []),
    ...((report.counts.lockedRouteViolations ?? 0) > 0
      ? [`Fixierte Trassen: ${report.counts.lockedRouteViolations} Konflikt(e)`]
      : []),
    ...((report.counts.sanityViolations ?? 0) > 0
      ? [`Ungültige Routing-Geometrie: ${report.counts.sanityViolations}`]
      : []),
  ];
  const detail = [
    `${report.edgeCount} geprüfte Kanten`,
    `${countText}`,
    ...causes,
    ...(report.tightMarginRoutes
      ? [
          `davon ${report.tightMarginRoutes} Leitung(en) mit verringerter Bauteil-Reserve ` +
            `(Engstelle/Port-Stub); der verbindliche Mindestabstand wird separat in I3 geprüft`,
        ]
      : []),
    // ADR 0014: Es gibt kein manuelles Leitungs-Legen mehr — „Leitungen
    // umlegen“ war eine Anleitung zu einer Handlung, die die App nicht
    // anbietet. Genannt wird jetzt der Hebel, den der Nutzer wirklich hat:
    // Bauteile verschieben, danach routet der nächste Lauf von selbst.
    'Der Plan ist nicht layout-verifiziert. Verschiebe die betroffenen Bauteile mit mehr Abstand; das Routing wird danach automatisch neu berechnet.',
    ...((report.counts.lockedRouteViolations ?? 0) > 0
      ? ['Prüfe außerdem die fixierte Trasse oder entsperre sie.']
      : []),
  ].join(' — ');
  return (
    <span
      data-testid="routing-status-invalid"
      role="status"
      aria-label={`Routing nicht verifiziert: ${countText}`}
      title={detail}
      className="inline-flex h-11 items-center justify-center gap-1 rounded border border-oxide/50 bg-oxide/10 px-2 text-xs font-semibold text-oxide"
    >
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      <span className="hidden xl:inline">Routing prüfen · {countText}</span>
    </span>
  );
}
