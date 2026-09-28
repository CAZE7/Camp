import { describe, expect, it } from 'vitest';
import { GOLDEN_PLANS } from '../goldenmaster/plans';
import { captureGoldenMaster } from '../goldenmaster/pipeline';
import { analyzeOverlaps } from './audit';
import { checkInvariants, type NodeRect, type RoutedEdge } from '../../lib/routing/invariants';
import { SegmentSpatialIndex } from '../../lib/routing/geometry';
import { segmentExtraCost } from '../../lib/routing/rules/costModel';
import {
  isPortBundleOverlap,
  routedPathGeometry,
  type RoutedPathGeometry,
} from '../../lib/routing/rules/portBundle';
import { classifySegmentAgainstSegment } from '../../lib/routing/rules/collision';

/**
 * Port-Bündel-Ausnahme: drei Stellen, eine Wahrheit (ROUTE-002 Teil 2).
 *
 * Das Kostenmodell (`segmentExtraCost`) kann seit 2026-09-27 die Stub-Kenntnis
 * des Nachbarn entgegennehmen und eine kollineare Überdeckung am gemeinsamen
 * Handle durchlassen — die Entscheidung trifft dieselbe Funktion wie I2
 * (`lib/routing/invariants.ts`) und das Audit (`scripts/routing/audit.ts`).
 *
 * Dieser Test prüft das über die sechs Referenzpläne (Produktivpfad, echte
 * Trassen) nach und friert die Zahlen ein:
 *
 *   1. Der Invarianten-Check meldet I2 = 0.
 *   2. Das Modell OHNE Stub-Kenntnis verwirft genau die legitimen Bündel
 *      (Σ 47) — das ist der Grund, warum der Anschluss sie braucht.
 *   3. Das Modell MIT Stub-Kenntnis lässt genau diese Paare durch
 *      (`portBundleShared`) und meldet 0 harte Überdeckungen außerhalb.
 *   4. Das Audit zählt dieselben Paare als `atPort` und 0 × `elsewhere`.
 *
 * Die Zahlen sind Ratchet: Sinkt eine, muss sie hier nachgezogen werden (sonst
 * schafft die Verbesserung still neuen Spielraum); steigt eine, ist das der
 * Fehler, den dieser Test meldet.
 */

/** Gemessen am 2026-09-27 (Produktivpfad, Referenzpläne am Ursprung). */
const PORT_BUNDLE_PAIRS: Record<string, number> = {
  simple: 4,
  camper: 10,
  solar: 4,
  inverter: 4,
  acdc: 10,
  complex: 15,
};

const TOTAL = Object.values(PORT_BUNDLE_PAIRS).reduce((sum, n) => sum + n, 0);

type PlanModel = {
  routed: RoutedEdge[];
  edgeCount: number;
  /** Ungeordnete Kantenpaare mit mindestens einer kollinearen Überdeckung (= I2-Begriff). */
  hardPairs: number;
  /** Davon: Paare, bei denen ALLE Überdeckungen die Port-Bündel-Ausnahme erfüllen. */
  exemptPairs: number;
  /** Paare mit harter Überdeckung außerhalb der Stubs (muss 0 sein, wenn I2 = 0 ist). */
  notExemptPairs: number;
  /** Modell ohne Stub-Kenntnis: Paare, für die es `Infinity` liefert (fail-safe). */
  modelHardPairs: number;
  /** Modell mit Stub-Kenntnis: Paare, für die es trotzdem `Infinity` liefert. */
  modelHardPairsWithKnowledge: number;
  /** Summe der durchgelassenen Überdeckungen (`portBundleShared`), je Paar einmal gezählt. */
  exemptSegmentPairs: number;
};

function modelFor(planName: string): PlanModel {
  const plan = GOLDEN_PLANS[planName]!;
  const master = captureGoldenMaster(plan);
  const routed: RoutedEdge[] = Object.entries(master.routing).map(([id, route]) => ({
    id,
    source: id,
    target: id,
    waypoints: route.waypoints,
  }));
  const geometry = new Map<string, RoutedPathGeometry>(
    routed.map((edge) => [edge.id, routedPathGeometry(edge.waypoints)])
  );

  let hardPairs = 0;
  let exemptPairs = 0;
  let notExemptPairs = 0;
  let modelHardPairs = 0;
  let modelHardPairsWithKnowledge = 0;
  let exemptSegmentPairs = 0;

  // Ungeordnete Paare — genau die Grundmenge von I2 (`checkEdgeEdgeOverlaps`)
  // und von `analyzeOverlaps` im Audit.
  for (let i = 0; i < routed.length; i++) {
    for (let j = i + 1; j < routed.length; j++) {
      const left = geometry.get(routed[i]!.id)!;
      const right = geometry.get(routed[j]!.id)!;
      const ownerOf = new Map<object, RoutedPathGeometry>();
      for (const segment of right.segments) ownerOf.set(segment, right);
      const index = new SegmentSpatialIndex([...right.segments]);
      let hard = false;
      let allExempt = true;
      let shared = 0;
      for (const s1 of left.segments) {
        for (const s2 of right.segments) {
          if (classifySegmentAgainstSegment(s1, s2).class !== 'hard') continue;
          hard = true;
          if (isPortBundleOverlap(left, right, s1, s2)) shared += 1;
          else allExempt = false;
        }
      }
      if (!hard) continue;
      hardPairs += 1;
      if (allExempt) exemptPairs += 1;
      else notExemptPairs += 1;

      // Modell-Verhalten für DASSELBE Paar, in einer Richtung:
      // ohne Kenntnis muss es hart sein, mit Kenntnis nicht mehr.
      const without = left.segments.map((s) => segmentExtraCost(s, index));
      const withKnowledge = left.segments.map((s) =>
        segmentExtraCost(s, index, { portBundle: { own: left, otherOf: (s2) => ownerOf.get(s2) } })
      );
      if (without.some((r) => r.cost === Infinity)) modelHardPairs += 1;
      if (withKnowledge.some((r) => r.cost === Infinity)) modelHardPairsWithKnowledge += 1;
      exemptSegmentPairs += withKnowledge.reduce((sum, r) => sum + r.portBundleShared, 0);
    }
  }

  return {
    routed,
    edgeCount: routed.length,
    hardPairs,
    exemptPairs,
    notExemptPairs,
    modelHardPairs,
    modelHardPairsWithKnowledge,
    exemptSegmentPairs,
  };
}
const models = new Map<string, PlanModel>();
for (const planName of Object.keys(PORT_BUNDLE_PAIRS)) models.set(planName, modelFor(planName));

describe('Port-Bündel-Ausnahme über die Referenzpläne — Modell, I2 und Audit sind einig', () => {
  for (const planName of Object.keys(PORT_BUNDLE_PAIRS)) {
    const expectedPairs = PORT_BUNDLE_PAIRS[planName]!;

    it(`${planName}: I2 = 0, Modell lässt genau die ${expectedPairs} Bündel-Paare durch`, () => {
      const model = models.get(planName)!;
      const report = checkInvariants(model.routed, [] as NodeRect[]);

      // 1. Der Invarianten-Check (die harte Regel) meldet nichts.
      expect(report.I2, `I2-Verstöße in ${planName}`).toHaveLength(0);
      // 2. Genau so viele Kantenpaare sind kollinear überdeckt …
      expect(model.hardPairs, `kollineare Paare (${planName})`).toBe(expectedPairs);
      // 3. … und alle davon sind Port-Bündel (nichts bleibt hart).
      expect(model.exemptPairs, `erlaubte Bündel-Paare (${planName})`).toBe(expectedPairs);
      expect(model.notExemptPairs, `harte Überdeckung außerhalb der Stubs (${planName})`).toBe(0);
      // 4. Das Modell spiegelt das: ohne Kenntnis hart, mit Kenntnis nicht mehr.
      expect(model.modelHardPairs, `Modell ohne Kenntnis (${planName})`).toBe(expectedPairs);
      expect(model.modelHardPairsWithKnowledge, `Modell mit Kenntnis (${planName})`).toBe(0);
      expect(model.exemptSegmentPairs, `durchgelassene Überdeckungen (${planName})`).toBeGreaterThan(0);
      // 5. Das Audit sieht dieselben Paare — und keine echten Fehler.
      const overlaps = analyzeOverlaps(model.routed);
      expect(overlaps.atPort, `Audit atPort (${planName})`).toBeGreaterThanOrEqual(expectedPairs);
      expect(overlaps.elsewhere, `Audit elsewhere (${planName})`).toBe(0);
    });
  }

  it(`Summe über die sechs Pläne: ${TOTAL} legitime Bündel-Paare — ohne Stub-Kenntnis wären alle hart`, () => {
    let hard = 0;
    let exempt = 0;
    for (const model of models.values()) {
      hard += model.hardPairs;
      exempt += model.exemptPairs;
    }
    expect(hard).toBe(TOTAL);
    expect(exempt).toBe(TOTAL);
    expect(hard).toBeGreaterThan(0);
  });

  it('Baseline ist nicht zu locker (Verbesserungen müssen nachgezogen werden)', () => {
    for (const [planName, expectedPairs] of Object.entries(PORT_BUNDLE_PAIRS)) {
      const model = models.get(planName)!;
      expect(
        model.hardPairs,
        `${planName}: nur ${model.hardPairs} statt ${expectedPairs} kollineare Paare — ` +
          'PORT_BUNDLE_PAIRS nachziehen, wenn die Trassen bewusst besser wurden.'
      ).toBe(expectedPairs);
    }
  });
});
