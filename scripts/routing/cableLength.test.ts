import { describe, expect, it } from 'vitest';
import { GOLDEN_PLANS, type GoldenPlanInput } from '../goldenmaster/plans';
import { captureGoldenMaster } from '../goldenmaster/pipeline';

/**
 * Längen-Ratchet auf dem Produktivpfad (Finding 2026-09-27).
 *
 * Warum diese Datei existiert
 * ===========================
 * Die Kabellänge blieb lange unbemerkt: `routingQuality.ts` misst den
 * Legacy-Router (LEGACY L-1, nicht gerendert), und der dort verwendete Faktor
 * „Länge / Manhattan-Optimum“ ist gegen Platzierung blind, weil das Optimum
 * mitwandert — bei 14.752 px Kabelweg sah er aus wie bei 2.697 px. Die
 * Nutzer-Messung („mein Plan steht nicht im Ursprung“) fiel deshalb durch
 * jedes Gate.
 *
 * Dieser Test misst die ABSOLUTE Länge über den echten Produktivpfad
 * (`Input → AutoWire → Routing`, derselbe Aufruf wie `goldenmaster:capture`)
 * und hält sie als Obergrenze je Referenzplan fest. Zwei Eigenschaften werden
 * gepinnt:
 *
 *   1. Absolute Obergrenze je Plan (Ratchet nach unten).
 *   2. Die Länge hängt nicht davon ab, WO der Plan auf dem Canvas steht —
 *      genau der gemeldete Fall. Vor dem Platzierungs-Fix wuchs derselbe
 *      Plan bei (1200, 800) von 30.269 px auf 88.693 px (Summe der sechs
 *      Pläne); jetzt liegt er bei 29.789 px.
 *
 * Die Baseline wird — wie beim Invarianten-Ratchet in
 * `scripts/routing/finalValidation.test.ts` — nur nach unten nachgezogen:
 * Wird ein Plan besser, MUSS die Zahl hier kleiner werden, sonst schafft die
 * Verbesserung still neuen Spielraum.
 */

/** Gemessen am 2026-09-27 (nach dem Platzierungs-Fix, Plan am Ursprung). */
const BASELINE_PX: Record<string, number> = {
  // Nachgezogen 2026-10-03 (ADR 0033): Der Trenngang stellt die
  // Kabel-Freigabe her (I3 49 → 0) und sein Längen-Nachlauf zieht die dabei
  // entstandenen Umwege wieder zusammen. Fünf Pläne werden dadurch KÜRZER
  // (Summe 27 799 → 27 544 px, −0,9 %): simple 2697→2665, camper 3709→3677,
  // inverter 3881→3710, acdc 5710→5646. Der sechste (`complex`) wächst um
  // +44 px (8602→8646, +0,5 %): Die einzige Geometrie, die I1–I7 = 0 UND die
  // Kreuzungs-Ratchet (≤ 25) hält, verlangt `busbar-plus` 496 /
  // `busbar-minus` 688 (gemessenes Gate-Gitter, s. ADR 0033) — acht Pixels
  // mehr Minus-Korridor kosten die vier Minus-Leitungen. Die Alternative wäre,
  // vier 4-px-Freigabeverstöße stehen zu lassen; ADR 0015 führt I3 als
  // harte Klasse. Bewusster, dokumentierter Tausch, kein schleichender
  // Qualitätsverlust (Netto über alle Pläne: −223 px).
  simple: 2665,
  // Nachgezogen 2026-09-27 (Merge des Arena-Zweigs „stabilize planning and safe
  // route reflow“): der Trunk-Reflow verlegt camper, inverter, acdc und complex
  // kürzer — gemessen 3709 / 3881 / 5710 / 8602 px statt 3805 / 3888 / 5770 /
  // 10909 px. Der Test verlangt das Nachziehen selbst („Verbesserungen müssen
  // nachgezogen werden“); simple und solar sind unverändert.
  camper: 3677,
  solar: 3200,
  inverter: 3710,
  acdc: 5646,
  complex: 8646,
};

/**
 * Toleranz für den Positions-Test: Die Platzierung rundet den Anker auf das
 * globale Raster, deshalb darf die Länge um bis zu 15 % abweichen. Gemessen am
 * 2026-09-28 bei (1200, 800): simple 2693, camper 3515, solar 3438, inverter
 * 3694, acdc 5354, complex 8538 — alle innerhalb der Toleranz, in Summe
 * 27 232 px = 2,0 % KÜRZER als am Ursprung (27 799 px).
 *
 * Achtung: Toleranz ist kein Invarianten-Ersatz. Derselbe Test misst nur die
 * LÄNGE; I1–I3 bei verschobenem Plan prüft er nicht (Befund 2026-09-28:
 * 31 von 330 Versätzen verletzen die harten Invarianten — siehe
 * KNOWN-PROBLEMS.md ROUTE-006, offener Punkt „Positions-Unabhängigkeit“).
 */
const SHIFT_TOLERANCE = 1.15;
const SHIFT_X = 1200;
const SHIFT_Y = 800;

const lengthOf = (plan: GoldenPlanInput): number => {
  const master = captureGoldenMaster(plan);
  return Math.round(Object.values(master.routing).reduce((sum, route) => sum + route.length, 0));
};

const shiftedPlan = (plan: GoldenPlanInput): GoldenPlanInput => ({
  ...plan,
  nodes: plan.nodes.map((node) => ({
    ...node,
    position: { x: node.position.x + SHIFT_X, y: node.position.y + SHIFT_Y },
  })),
});

describe('Kabellänge (Produktivpfad) — Ratchet über die Referenzpläne', () => {
  for (const planName of Object.keys(BASELINE_PX)) {
    it(`${planName}: Kabellänge ≤ ${BASELINE_PX[planName]} px`, () => {
      const total = lengthOf(GOLDEN_PLANS[planName]!);
      expect(
        total,
        `Kabellänge gestiegen: ${total} px statt ${BASELINE_PX[planName]} px. ` +
          'Ursache suchen (Platzierung/Router) — nicht die Baseline anheben.'
      ).toBeLessThanOrEqual(BASELINE_PX[planName]!);
    });
  }

  it('Baseline ist nicht zu locker (Verbesserungen müssen nachgezogen werden)', () => {
    const stale = Object.keys(BASELINE_PX).filter((planName) => {
      const total = lengthOf(GOLDEN_PLANS[planName]!);
      return total < BASELINE_PX[planName]!;
    });
    expect(
      stale,
      `Kürzer als die Baseline — bitte BASELINE_PX auf die gemessenen Werte nachziehen: ${stale.join(', ')}`
    ).toEqual([]);
  });

  /**
   * Der gemeldete Fall: „Wenn ich meinen Plan verschiebe, werden die Kabel
   * 5,5× länger." Die Platzierung darf ihre Bauteile nicht am Canvas-Ursprung
   * verankern — sonst hängt die Kabellänge von der Planposition ab und jedes
   * Optimieren ist wertlos, sobald der Nutzer seinen Plan woandershin zieht.
   */
  it('Länge hängt nicht von der Planposition ab (±15 % erlaubt)', () => {
    const tooLong: string[] = [];
    for (const [planName, plan] of Object.entries(GOLDEN_PLANS)) {
      const shifted = lengthOf(shiftedPlan(plan));
      const limit = Math.round(BASELINE_PX[planName]! * SHIFT_TOLERANCE);
      if (shifted > limit) tooLong.push(`${planName}: ${shifted} px > ${limit} px`);
    }
    expect(
      tooLong,
      `Verschobener Plan wird länger — Platzierung verankert wieder am Ursprung:\n${tooLong.join('\n')}`
    ).toEqual([]);
  });
});
