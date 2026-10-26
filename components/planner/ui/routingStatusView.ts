import { useCableRouteFinalValidation, useCableRouteGeneration } from '../../edges/utils/cableRouteStore';
import { totalViolations } from '../../../lib/routing/finalValidation';

/**
 * Zustand des Kabelroutings als ANSICHTSDATEN — eine Quelle für den gemeinsamen
 * Prüf-Einstieg (`WarningCenter`) statt eines eigenen Chips.
 *
 * Hintergrund (Nutzer-Rückmeldung 2026-10-26): Rechts in der Werkzeugleiste
 * standen zwei Zahl-Plaketten mit Warndreieck nebeneinander — „2 Regelverl.“
 * (Kabeltrassen) und „20“ (Planungsprüfung). Beides sind Prüfbefunde, beides
 * sah gleich aus, keiner sagte, was er zählt. Seitdem gibt es EINEN
 * Prüf-Einstieg; dieses Modul liefert die Kabeltrassen-Hälfte davon.
 *
 * Es rechnet nichts nach: Alle Zahlen kommen aus dem veröffentlichten
 * Final-Validation-Report bzw. aus dem Generations-Tracker des Routers.
 *
 * `findingCount` ist bewusst getrennt von `label`: Nur ein Zustand, der eine
 * HANDLUNG verlangt (Berechnung fehlgeschlagen, Geometrie veraltet, Konvergenz
 * abgebrochen) oder konkrete Regelverletzungen nennt, zählt in den gemeinsamen
 * Zähler. „Rechnet…“, „Optimierung geprüft“ und „vorheriger gültiger Stand“
 * erscheinen im Bericht, verändern die Zahl aber nicht — sonst stünde dort
 * eine Zahl ohne Befund.
 */
export type RoutingStatusTone = 'ok' | 'warn' | 'bad' | 'neutral';

export interface RoutingStatusView {
  /** Kennung des Berichtsteils (Vertrag mit `tests/e2e`, s. `e2eSelectors.test`). */
  testId: string;
  tone: RoutingStatusTone;
  /** Vollständige Aussage in einem Satz — Kopf des Berichtsteils und `aria-label`. */
  label: string;
  /** Ursachen und nächster Schritt, je eine Zeile. */
  details: string[];
  /** Befunde, die in den gemeinsamen Prüf-Zähler eingehen (0 = kein Befund). */
  findingCount: number;
}

export function useRoutingStatusView(): RoutingStatusView | null {
  const report = useCableRouteFinalValidation();
  const generation = useCableRouteGeneration();

  // Spec #19 (ROUTING_NOT_CONVERGED): Der Tracker verbietet weitere Läufe,
  // weil dieselbe Eingabe zu oft gerechnet wurde. Das ist ein eigener,
  // handlungsbedürftiger Zustand — nicht stillschweigend weitermachen.
  if (generation && generation.allowed === false) {
    return {
      testId: 'routing-status-not-converged',
      tone: 'bad',
      label: 'Routing konvergiert nicht',
      details: [
        generation.reason ?? 'Routing hat die Konvergenzschranke erreicht.',
        'Weitere Läufe wurden gestoppt. Der angezeigte Stand muss gegen die aktuellen Anschlüsse geprüft werden.',
      ],
      findingCount: 1,
    };
  }

  if (generation?.state && generation.state !== 'valid' && generation.state !== 'invalid') {
    // Zustandstabelle statt zusammengesetzter Kennung: Jeder Zustand nennt
    // Beschriftung UND `data-testid` ausdrücklich. Beides war vorher implizit
    // (`routing-status-${state}` im JSX), wodurch die Kennung nur zur Laufzeit
    // existierte — `components/e2eSelectors.test.tsx` konnte sie nicht finden.
    const states: Record<
      'optimized' | 'partial' | 'pending' | 'routing' | 'retained' | 'stale' | 'error',
      { label: string; tone: RoutingStatusTone; testId: string; findingCount: number; detail: string }
    > = {
      optimized: {
        label: 'Routing: Optimierung geprüft',
        tone: 'neutral',
        testId: 'routing-status-optimized',
        findingCount: 0,
        detail:
          'Der Optimierungslauf hat die Leitungsführung geprüft; nur global bessere Ergebnisse wurden übernommen.',
      },
      partial: {
        label: 'Routing: teilweise optimiert',
        tone: 'neutral',
        testId: 'routing-status-partial',
        findingCount: 0,
        detail: 'Ein Teil der geprüften Kabel wurde übernommen, der Rest blieb unverändert.',
      },
      pending: {
        label: 'Routing: neu zu berechnen',
        tone: 'neutral',
        testId: 'routing-status-pending',
        findingCount: 0,
        detail: 'Die Geometrie hat sich geändert; der nächste Lauf rechnet die Kabel neu.',
      },
      routing: {
        label: 'Routing: in Bearbeitung',
        tone: 'neutral',
        testId: 'routing-status-routing',
        findingCount: 0,
        detail: 'Der Router rechnet gerade. Die Anzeige aktualisiert sich, sobald das Ergebnis vorliegt.',
      },
      retained: {
        label: 'Routing: vorheriger gültiger Stand',
        tone: 'neutral',
        testId: 'routing-status-retained',
        findingCount: 0,
        detail: 'Der vorherige gültige Stand bleibt sichtbar, bis die neue Berechnung fertig ist.',
      },
      stale: {
        label: 'Routing: veraltete Geometrie',
        tone: 'warn',
        testId: 'routing-status-stale',
        findingCount: 1,
        detail:
          generation.reason ??
          'Die sichtbare Geometrie ist noch nicht für diese Eingabe bestätigt. Verschiebe ein Bauteil oder löse die nächste Berechnung aus.',
      },
      error: {
        label: 'Routing: Berechnung fehlgeschlagen',
        tone: 'bad',
        testId: 'routing-status-error',
        findingCount: 1,
        detail:
          generation.reason ??
          'Die Kabel konnten für diesen Plan nicht berechnet werden. Prüfe die Anschlüsse der betroffenen Bauteile.',
      },
    };
    const state = states[generation.state as keyof typeof states];
    return {
      testId: state.testId,
      tone: state.tone,
      label: state.label,
      details: [state.detail],
      findingCount: state.findingCount,
    };
  }

  // Noch kein Routing gelaufen: kein Befund, aber auch keine Aussage. Vorher
  // stand dafür eine neutrale Plakette „Routing: wartet“ — als Teil des
  // gemeinsamen Einstiegs wäre das eine Zeile ohne Inhalt.
  if (!report) return null;

  if (report.status === 'VALID') {
    // ROUTE-BUG-36: Die verringerte Bauteil-Reserve muss auch im grünen Fall
    // sichtbar bleiben. `VALID` heißt, dass I1–I3 den verbindlichen
    // Mindestabstand bestätigen; eine Reserve unter `OBSTACLE_MARGIN` ist ein
    // separater Hinweis auf eine Engstelle.
    const tight = report.tightMarginRoutes ?? 0;
    return {
      testId: 'routing-status-valid',
      tone: 'ok',
      label: 'Routing verifiziert',
      details: [
        `${report.edgeCount} Kanten, I1=0, I2=0, I3=0`,
        ...(tight > 0
          ? [
              `Davon ${tight} Leitung(en) mit verringerter Bauteil-Reserve (Engstelle): ` +
                'verbindlicher Mindestabstand eingehalten, zusätzliche Routing-Reserve geringer.',
            ]
          : []),
      ],
      findingCount: 0,
    };
  }

  const total = totalViolations(report.counts);
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
  return {
    testId: 'routing-status-invalid',
    tone: 'warn',
    label: `Routing nicht verifiziert: ${countText}`,
    details: [
      `${report.edgeCount} geprüfte Kanten`,
      ...causes,
      ...(report.tightMarginRoutes
        ? [
            `Davon ${report.tightMarginRoutes} Leitung(en) mit verringerter Bauteil-Reserve ` +
              '(Engstelle/Port-Stub); der verbindliche Mindestabstand wird separat in I3 geprüft.',
          ]
        : []),
      // ADR 0014: Es gibt kein manuelles Leitungs-Legen mehr — „Leitungen
      // umlegen“ wäre eine Anleitung zu einer Handlung, die die App nicht
      // anbietet. Genannt wird der Hebel, den der Nutzer wirklich hat.
      'Der Plan ist nicht layout-verifiziert. Verschiebe die betroffenen Bauteile mit mehr Abstand; das Routing wird danach automatisch neu berechnet.',
      ...((report.counts.lockedRouteViolations ?? 0) > 0
        ? ['Prüfe außerdem die fixierte Trasse oder entsperre sie.']
        : []),
    ],
    findingCount: total,
  };
}
