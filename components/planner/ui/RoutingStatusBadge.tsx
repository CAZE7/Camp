import { AlertTriangle, CheckCircle2, Repeat2 } from 'lucide-react';
import { useCableRouteFinalValidation, useCableRouteGeneration } from '../../edges/utils/cableRouteStore';
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
 * - `INVALID`  → orange "Routing prüfen · n Regelverletzungen", mit Tooltip
 *                über die betroffenen Invarianten und den nächsten sinnvollen
 *                Schritt. Die Zahl „Regelverletzungen" ist die Summe der
 *                Final-Gate-Befunde, kein einzelner Routing-Score.
 * - undefined  → neutral, solange der erste Routinglauf noch nicht fertig
 *                ist.
 *
 * Die Anzeige liest denselben Report, den der Router beim Publizieren der
 * Waypoints erzeugt hat — nicht eine Neuberechnung im Render-Pfad.
 *
 * Breite (M12): Unterhalb von `2xl` bleibt nur das Symbol (~34 px) — die
 * ausgeschriebene Zeile ist bis zu 253 px breit und verdrängte in der
 * Werkzeugleiste die Aktionen. Der zugängliche Name (`aria-label`) und der
 * Tooltip nennen den Zustand in jeder Breite vollständig.
 */
export function RoutingStatusBadge() {
  const report = useCableRouteFinalValidation();
  const generation = useCableRouteGeneration();

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
        title={`${generation.reason ?? 'Routing hat die Konvergenzschranke erreicht.'} Weitere Läufe wurden gestoppt. Der angezeigte Stand muss gegen die aktuellen Anschlüsse geprüft werden.`}
        className="border-error/50 bg-error/10 text-error inline-flex h-11 items-center justify-center gap-1 rounded border px-2 text-xs font-semibold"
      >
        <Repeat2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="cad-tb-short">Konvergenz</span>
        <span className="cad-tb-explain">Routing: Konvergenzfehler</span>
      </span>
    );
  }

  if (generation?.state && generation.state !== 'valid' && generation.state !== 'invalid') {
    // Zustandstabelle statt zusammengesetzter Kennung: Jeder Zustand nennt
    // Beschriftung UND `data-testid` ausdrücklich. Beides war vorher implizit
    // (`routing-status-${state}` im JSX), wodurch die Kennung nur zur Laufzeit
    // existierte — `components/e2eSelectors.test.tsx` („jede getByTestId-
    // Verwendung in tests/e2e ist im Anwendungscode vorhanden") konnte sie
    // nicht finden und schlug fehl, obwohl `tests/e2e/routing-optimization.spec.ts`
    // genau darauf wartet. Die Kennungen sind unverändert.
    const states = {
      optimized: {
        label: 'Routing: Optimierung geprüft',
        shortLabel: 'Optimiert',
        testId: 'routing-status-optimized',
      },
      partial: {
        label: 'Routing: teilweise optimiert',
        shortLabel: 'Teilweise',
        testId: 'routing-status-partial',
      },
      pending: {
        label: 'Routing: neu zu berechnen',
        shortLabel: 'Ausstehend',
        testId: 'routing-status-pending',
      },
      routing: {
        label: 'Routing: in Bearbeitung',
        shortLabel: 'Rechnet…',
        testId: 'routing-status-routing',
      },
      retained: {
        label: 'Routing: vorheriger gültiger Stand',
        shortLabel: 'Vorstand ok',
        testId: 'routing-status-retained',
      },
      stale: {
        label: 'Routing: veraltete Geometrie',
        shortLabel: 'Veraltet',
        testId: 'routing-status-stale',
      },
      error: {
        label: 'Routing: Berechnung fehlgeschlagen',
        shortLabel: 'Fehler',
        testId: 'routing-status-error',
      },
    };
    const { label, shortLabel, testId } = states[generation.state];
    return (
      <span
        data-testid={testId}
        role="status"
        aria-label={label}
        title={generation.reason ?? 'Die sichtbare Geometrie ist noch nicht für diese Eingabe bestätigt.'}
        className="inline-flex h-11 items-center justify-center gap-1 rounded border border-oxide/50 bg-oxide/10 px-2 text-xs font-semibold text-oxide"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="hidden xl:inline" aria-hidden="true">
          <span className="cad-tb-short">{shortLabel}</span>
        </span>
        <span className="cad-tb-explain">{label}</span>
      </span>
    );
  }

  if (!report) {
    return (
      <span
        className="inline-flex h-11 items-center justify-center gap-1 rounded border border-border bg-accent px-2 text-xs font-semibold text-muted-foreground"
        title="Der Kabelrouting-Status wird nach dem ersten Routinglauf angezeigt."
      >
        <span className="h-2 w-2 rounded-full bg-muted-foreground/40" aria-hidden="true" />
        <span className="cad-tb-explain">Routing: wartet</span>
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
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="hidden xl:inline" aria-hidden="true">
          <span className="cad-tb-short">Routing ok</span>
        </span>
        <span className="cad-tb-explain">Routing verifiziert</span>
      </span>
    );
  }

  const countText = total === 1 ? '1 Regelverletzung' : `${total} Regelverletzungen`;
  const causes = [
    ...((report.counts.contractViolations ?? 0) > 0
      ? [`Unvollständige oder gelöste Routen: ${report.counts.contractViolations}`]
      : []),
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
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="cad-tb-short whitespace-nowrap tabular-nums" aria-hidden="true">
        {total}
        <span className="hidden xl:inline"> Regelverl.</span>
      </span>
      <span className="cad-tb-explain">Routing prüfen · {countText}</span>
    </span>
  );
}
