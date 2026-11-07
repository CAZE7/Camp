/**
 * test/invariants/reachable-compliant.test.ts — DAS KERNVERSPRECHEN IST
 * EINLÖSBAR.
 *
 * Der schwerste Befund des Audits war nicht eine der sieben Verletzungen,
 * sondern die Messung über alle sechs Golden-Master-Pläne × drei Profile:
 * **kein einziger Plan erreichte `COMPLIANT`**. Das beste Ergebnis war
 * `INCOMPLETE` mit einem offenen Befund. Ein Prüfwerkzeug, das nie „bestanden"
 * sagen kann, ist kein Prüfwerkzeug, sondern ein Warnhinweis-Generator.
 *
 * Dieser Test trennt zwei Fragen, die vorher vermischt waren:
 *
 *   1. **Ist der grüne Pfad erreichbar?** — also: gibt es überhaupt einen Plan,
 *      für den die Engine nach vollständiger Prüfung `COMPLIANT` sagt? Diese
 *      Frage beantwortet `healthyDcPlan()` mit JA, in allen drei Profilen, mit
 *      `decisionRatio 1`. Die Engine ist nicht defekt.
 *
 *   2. **Warum erreichen die Golden-Master-Pläne ihn nicht?** — weil sie
 *      fachlich nicht bestanden werden KÖNNEN. Der beste (`camper`) scheitert
 *      an genau einem Befund: `AMP-005` findet eine Kaskade 10 A → 10 A. Unter
 *      16 A ist die Selektivitätsheuristik nicht belegt, also meldet die
 *      Engine korrekt „nicht entscheidbar" — und `INCOMPLETE` ist dafür die
 *      richtige Antwort, nicht `COMPLIANT`.
 *
 * Der Test hält BEIDES fest. Er „repariert" den camper-Plan nicht, indem er
 * ihn auf einen grünen Fall zurechtschneidet: die Golden-Master-Pläne sind
 * eingefrorene Fixtures (`scripts/goldenmaster/plans.ts`), und sie zu ändern,
 * um ein besseres Verdikt zu bekommen, wäre das Gegenteil von Verifikation.
 *
 * Was sich durch die Reparaturen vom 2026-11-06 geändert hat
 * =========================================================
 * Die sieben Invariantenverletzungen (K-3, K-4, E-2, K-2, K-2b, E-1, T-2)
 * sind behoben — jedes `it.fails` in `electrical-invariants.test.ts` ist ein
 * `it`. Dieser Test ist die Gegenprobe dazu: er zeigt, dass die Engine auf
 * einem gesunden Plan nicht aus Vorsicht „nicht bestanden" sagt.
 */
import { describe, expect, it } from 'vitest';

import { healthyDcPlan } from '../../lib/verify/planFixtures';
import { verifyPlan } from '../../lib/verify/pipeline';
import type { VerificationVerdict } from '../../lib/verify/types';

const PROFILES = ['NORM_CORE', 'CAMP_MODEL', 'PRACTICE'] as const;

const verdictFor = (profile: (typeof PROFILES)[number]): VerificationVerdict => {
  const plan = healthyDcPlan();
  return verifyPlan({
    nodes: plan.nodes,
    edges: plan.edges,
    options: { profile, context: 'VEHICLE' },
  } as never).verdict;
};

describe('COMPLIANT ist erreichbar — in jedem Profil', () => {
  it.each(PROFILES)('der gesunde 12-V-Plan ist in %s COMPLIANT', (profile) => {
    expect(verdictFor(profile)).toBe('COMPLIANT');
  });

  it('und zwar ohne offenen Befund und mit vollständiger Entscheidung', () => {
    const plan = healthyDcPlan();
    for (const profile of PROFILES) {
      const report = verifyPlan({
        nodes: plan.nodes,
        edges: plan.edges,
        options: { profile, context: 'VEHICLE' },
      } as never);
      const open = report.events.filter(
        (event) => event.kind === 'VIOLATION' || event.kind === 'UNVERIFIABLE'
      );
      expect(
        open.map((event) => event.ruleId),
        `${profile}: offene Befunde`
      ).toEqual([]);
      // Alle ausgeführten Prüfungen sind entschieden — keine `unprovable`.
      expect(report.coverage.unprovable, profile).toBe(0);
      expect(report.coverage.decisionRatio, profile).toBe(1);
    }
  });

  it('der grüne Pfad ist kein Zufall: eine einzige Änderung macht ihn rot', () => {
    // Gegenprobe gegen einen Test, der nur „irgendetwas ist COMPLIANT"
    // nachweist: dieselbe Leitung mit zu kleinem Querschnitt muss kippen.
    const plan = healthyDcPlan();
    const broken = {
      ...plan,
      edges: plan.edges.map((edge) =>
        edge.id === 'e-fuse-load' ? { ...edge, data: { ...edge.data, crossSection: 1.5 } } : edge
      ),
    };
    const report = verifyPlan({
      nodes: broken.nodes,
      edges: broken.edges,
      options: { profile: 'PRACTICE', context: 'VEHICLE' },
    } as never);
    expect(report.verdict).not.toBe('COMPLIANT');
  });
});
