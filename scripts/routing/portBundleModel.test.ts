import { describe, expect, it } from 'vitest';
import { GOLDEN_PLANS } from '../goldenmaster/plans';
import { captureGoldenMaster } from '../goldenmaster/pipeline';
import { analyzeOverlaps } from './audit';
import {
  checkClearance,
  checkInvariants,
  type NodeRect,
  type RoutedEdge,
} from '../../lib/routing/invariants';
import { SegmentSpatialIndex, distanceSegmentToSegment } from '../../lib/routing/geometry';
import { ROUTING_TOKENS } from '../../lib/routing/tokens';
import { segmentExtraCost } from '../../lib/routing/rules/costModel';
import {
  isPortBundleOverlap,
  isPortBundleProximity,
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

/**
 * Gemessen am 2026-09-27 (Produktivpfad, Referenzpläne am Ursprung);
 * nachgezogen 2026-10-03 (ADR 0033): `complex` 15 → 12, Σ 47 → 44.
 *
 * Grund für den Nachzug: Die ADR-0033-Korrektur der Trassenlage
 * (`busbar-plus` 496 / `busbar-minus` 688, Trenngang + Längen-Nachlauf) führt
 * drei bisher kollinear gebündelte complex-Paare auf getrennten Achsen — sie
 * sind keine Port-Bündel mehr, sondern Abstand. Eine SENKENDE Zahl ist der
 * einzige zulässige Nachzug; steigt `hardPairs`, meldet der Test unten
 * „Baseline ist nicht zu locker" und das Audit I2.
 */
const PORT_BUNDLE_PAIRS: Record<string, number> = {
  simple: 4,
  camper: 10,
  solar: 4,
  inverter: 4,
  acdc: 10,
  complex: 12,
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

/**
 * ROUTE-006-Rest (2026-09-28): `analyzeOverlaps` ließ Kantenpaare OHNE
 * gemeinsame Anschlussstelle komplett aus (Vorfilter `sharesPort`). Ein solches
 * Paar konnte sich vollständig überdecken, und die Diagnose meldete
 * `elsewhere = 0`, während der Invarianten-Check I2 zählte — in verschobenen
 * acdc-Läufen gemessen (I2 = 1, elsewhere = 0). Der Vorfilter ist entfernt
 * (die Ausnahme prüft `isPortBundleOverlap` selbst); diese Fälle halten die
 * Vollständigkeit und die Kopplung Diagnose ↔ Gate fest.
 */
describe('analyzeOverlaps — Vollständigkeit außerhalb gemeinsamer Anschlussstellen', () => {
  const edge = (id: string, source: string, target: string, waypoints: { x: number; y: number }[]) => ({
    id,
    source,
    target,
    waypoints,
  });

  it('zählt eine Überdeckung ohne gemeinsame Anschlussstelle als elsewhere', () => {
    const routed = [
      edge('a', 'n1', 'n2', [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
      ]),
      edge('b', 'n3', 'n4', [
        { x: 120, y: 100 },
        { x: 280, y: 100 },
      ]),
    ];
    expect(analyzeOverlaps(routed)).toEqual({ atPort: 0, elsewhere: 1 });
    // Kopplung Diagnose ↔ Gate: eine Überdeckung ohne Port-Bündel ist I2.
    expect(checkInvariants(routed, [] as NodeRect[]).I2).toHaveLength(1);
  });

  it('zählt ein legitim gebündeltes Port-Paar weiterhin als atPort', () => {
    const routed = [
      edge('a', 'n1', 'n2', [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 200 },
      ]),
      edge('b', 'n1', 'n3', [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
        { x: 120, y: 300 },
      ]),
    ];
    const overlaps = analyzeOverlaps(routed);
    expect(overlaps.atPort).toBe(1);
    expect(overlaps.elsewhere).toBe(0);
    expect(checkInvariants(routed, [] as NodeRect[]).I2).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ADR 0031 — I3-Rest ist ehrlich: keine strukturelle Bündel-Überschreitung
// zählt noch als Verletzung, und jede gemeldete Verletzung ist echt.
// ---------------------------------------------------------------------------

/**
 * Ratchet des I3-RESTS je Referenzplan (Segment×Segment, ohne Segment×Node —
 * der liefert seit ROUTE-012 ohnehin 0). Gemessen 2026-10-03 am Produktivpfad
 * (Referenzpläne am Ursprung) unter der LOCUS-Regel (ADR 0031 v2):
 * Freistellung nur, wenn die nächste Annäherung beider Pfade innerhalb
 * `portFacingClearance` vom gemeinsamen Port liegt. Die Fenster-Fassung
 * (v1, 2026-10-02: 2/7/0/6/3/23) stellte 8 Paare zu Unrecht frei — u. a.
 * solar e-auto-1↔e-auto-10 (Berührung ohne gemeinsamen Port). Der Router-
 * Output ist byte-identisch zur v1-Messung (Recapture-Ledger in
 * scripts/routing/finalValidationRatchet.ts). Vor ADR 0031:
 * 6/21/4/12/13/42 — davon 69 strukturelle Port-Bündel-Fälle.
 * Diese Zahlen dürfen nur sinken.
 */
const I3_RESIDUE: Record<string, number> = {
  // Nachgezogen 2026-10-03 (ADR 0033): Der Trenngang stellt die
  // Kabel-Freigabe her, deshalb ist der Rest über ALLEN Plänen 0. Die
  // Buchhaltung unten (Modell ↔ Checker ↔ Audit) bleibt unverändert scharf:
  // Sie prüft die Zahl nicht gegen sich selbst, sondern Paar für Paar gegen
  // `classifySegmentAgainstSegment` + `isPortBundleProximity`.
  simple: 0,
  camper: 0,
  solar: 0,
  inverter: 0,
  acdc: 0,
  complex: 0,
};

describe('ADR 0031 — I3 zählt nur noch echte Restfälle über die Referenzpläne', () => {
  it('genau die nicht freigestellten weighted-Paare werden gemeldet — keines mehr, keines weniger', () => {
    // Buchhaltungs-Beweis je Kantenpaar: I3 zählt ein Segmentpaar genau
    // dann, wenn das Kollisionsmodell `weighted` liefert UND die Port-
    // Bündel-Ausnahme (gemeinsame Anschlussstelle + Korridor-Segmente)
    // NICHT greift. Ein Paar kann beides haben — legitime Bündel-Nähe am
    // gemeinsamen Port UND eine echte Unterschreitung an freier Trasse;
    // nur Letztere darf zählen.
    for (const [planName, expectedResidue] of Object.entries(I3_RESIDUE)) {
      const model = models.get(planName)!;
      const report = checkClearance(model.routed, [] as NodeRect[]);
      const segmentViolations = report.filter((v) => v.detail.includes('zwischen Kanten'));
      expect(
        segmentViolations,
        `${planName}: I3-Rest ${segmentViolations.length} statt ${expectedResidue} — I3_RESIDUE nachziehen (nur sinken erlaubt)`
      ).toHaveLength(expectedResidue);

      const violationsByPair = new Map<string, number>();
      for (const violation of segmentViolations) {
        const key = [violation.edgeId, violation.otherId].sort().join('↔');
        violationsByPair.set(key, (violationsByPair.get(key) ?? 0) + 1);
      }

      // Ungeordnete Paare wie im Checker: nachzählen und abgleichen.
      const countedByPair = new Map<string, number>();
      let exemptWeighted = 0;
      for (let i = 0; i < model.routed.length; i++) {
        for (let j = i + 1; j < model.routed.length; j++) {
          const left = model.routed[i]!;
          const right = model.routed[j]!;
          const leftGeometry = routedPathGeometry(left.waypoints);
          const rightGeometry = routedPathGeometry(right.waypoints);
          const key = [left.id, right.id].sort().join('↔');
          for (const s1 of leftGeometry.segments) {
            for (const s2 of rightGeometry.segments) {
              if (classifySegmentAgainstSegment(s1, s2).class !== 'weighted') continue;
              if (
                isPortBundleProximity(leftGeometry, rightGeometry, s1, s2, ROUTING_TOKENS.portFacingClearance)
              ) {
                exemptWeighted += 1;
                continue;
              }
              countedByPair.set(key, (countedByPair.get(key) ?? 0) + 1);
            }
          }
        }
      }
      // Jede gemeldete Verletzung entspricht einem nicht freigestellten
      // weighted-Paar — und jedes nicht freigestellte weighted-Paar ist
      // gemeldet. Die Ausnahme schweigt nie still und zählt nie doppelt.
      expect([...countedByPair.entries()].sort()).toEqual([...violationsByPair.entries()].sort());
      // Es gibt weiterhin legitime Bündel-Nähe (die Ausnahme wirkt überhaupt).
      // Die Bedingung hängt NUR an den Port-Bündel-Paaren — nicht mehr am
      // I3-Rest: Sonst würde sie mit dem Rest auf 0 still verschwinden (und
      // damit die einzige Prüfung, dass die Ausnahme überhaupt greift).
      if ((PORT_BUNDLE_PAIRS[planName] ?? 0) > 0) {
        expect(exemptWeighted, `${planName}: Ausnahme muss greifen`).toBeGreaterThan(0);
      }
    }
  });

  it('kein Referenzplan hat noch einen echten I3-Rest — auch der Ecken-Kontakt ist weg', () => {
    // Historie: ADR 0031 v2 (Locus-Regel) hatte den Fenster-Blindfleck
    // geschlossen und dabei in `solar` einen ECHTEN Restfall sichtbar gemacht:
    // `e-auto-1↔e-auto-10` berührten sich an einer Ecke (Abstand 0 px) und
    // teilten keinen gemeinsamen Port — kein Bündelfall, also musste der
    // Router ihn lösen, nicht der Checker freistellen.
    //
    // ADR 0033 (2026-10-03) hat ihn gelöst: Der Trenngang zieht die Pfade
    // auseinander. Der Checker blieb dabei unangetastet — die Prüfung unten
    // schaut ausdrücklich NACH, dass das Paar weiterhin existiert und jetzt
    // getrennt läuft; sie verschwindet also nicht mit dem Verstoß.
    const model = models.get('solar')!;
    expect(checkClearance(model.routed, [] as NodeRect[])).toHaveLength(0);

    const left = model.routed.find((e) => e.id === 'e-auto-1');
    const right = model.routed.find((e) => e.id === 'e-auto-10');
    expect(left, 'e-auto-1 fehlt — der Vergleich setzt die Kante voraus').toBeDefined();
    expect(right, 'e-auto-10 fehlt — der Vergleich setzt die Kante voraus').toBeDefined();

    const geometryLeft = routedPathGeometry(left!.waypoints);
    const geometryRight = routedPathGeometry(right!.waypoints);
    let minimumGap = Infinity;
    let touching:
      { s1: (typeof geometryLeft.segments)[number]; s2: (typeof geometryRight.segments)[number] } | undefined;
    for (const s1 of geometryLeft.segments) {
      for (const s2 of geometryRight.segments) {
        const gap = distanceSegmentToSegment(s1, s2);
        if (gap < minimumGap) {
          minimumGap = gap;
          touching = { s1, s2 };
        }
      }
    }
    // Der ehemalige Restfall existiert noch (die beiden Pfade laufen sich am
    // gemeinsamen Zielanschluss in die Quere) …
    expect(minimumGap, 'Der ehemalige Restfall ist verschwunden — Test prüft ins Leere').toBeLessThan(
      ROUTING_TOKENS.cableClearance
    );
    // … ist aber jetzt ein LEGITIMER Bündel-Fall: beide Pfade enden am selben
    // Anschluss, und die engste Stelle liegt im Port-Korridor. Genau diese
    // Begründung nimmt der Checker (dieselbe Funktion!) — der Verstoß ist
    // nicht stummgeschaltet, sondern strukturell aufgelöst.
    expect(left!.waypoints.at(-1), 'e-auto-1 endet nicht mehr am gemeinsamen Ziel').toEqual(
      right!.waypoints.at(-1)
    );
    expect(
      isPortBundleProximity(
        geometryLeft,
        geometryRight,
        touching!.s1,
        touching!.s2,
        ROUTING_TOKENS.portFacingClearance
      ),
      'Die engste Stelle liegt NICHT im Port-Korridor eines gemeinsamen Anschlusses — dann wäre es ein echter Verstoß'
    ).toBe(true);
  });

  it('die Locus-Regel lässt einen echten Ecken-Kontakt ohne gemeinsamen Port nicht durch', () => {
    // Gegenprobe zum Plan-Beweis oben: Über die Referenzpläne ist der Rest auf
    // 0 — das darf nicht heißen, dass die Ausnahme alles durchlässt. Diese
    // beiden Geometrien sind die Minimalform des damaligen solar-Falls
    // (Berührung im Punkt, kein gemeinsamer Anschluss) gegen die Minimalform
    // eines echten Bündels (Ecke AM gemeinsamen Port).
    const touching: RoutedEdge[] = [
      {
        id: 'l',
        source: 'n1',
        target: 'n2',
        waypoints: [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
        ],
      },
      {
        id: 'r',
        source: 'n3',
        target: 'n4',
        waypoints: [
          { x: 120, y: 0 },
          { x: 120, y: 200 },
        ],
      },
    ];
    expect(checkClearance(touching, [] as NodeRect[])).toHaveLength(1);

    const bundled: RoutedEdge[] = [
      {
        id: 'l',
        source: 'n1',
        target: 'n2',
        waypoints: [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
        ],
      },
      {
        id: 'r',
        source: 'n2',
        target: 'n4',
        waypoints: [
          { x: 200, y: 0 },
          { x: 200, y: 200 },
        ],
      },
    ];
    expect(checkClearance(bundled, [] as NodeRect[])).toHaveLength(0);
  });
});
