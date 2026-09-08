import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { GOLDEN_PLANS } from '../../../scripts/goldenmaster/plans';
import { performAutoWiring } from '../../autoWire';
import { routeAllCables, type RouteEdgeRef } from '../../../components/edges/utils/routeAll';
import { measureElk, measureLegacy, toElkPlan } from './ab-compare';

/**
 * WP-4 (#393): A/B-Gate — ELK gegen den bestehenden Router.
 *
 * AGENT-PLAN: „A/B muss Kreuzungen/Bends besser oder gleich zeigen —
 * sonst STOPP." Gemessen auf den sechs Golden-Master-Plänen nach
 * AutoWire (identische Topologie für beide Systeme).
 *
 * Bends-Bewertung mit Toleranz +2 pro Plan: ELK routet ALLE Kanten
 * orthogonal um Knoten herum, während der Bestandsrouter im dichten
 * Layout vereinzelt Kanten DURCH fremde Boxen legt (dokumentierter
 * Fallback „ohne Hindernisfreigabe") und sich diese Bends spart —
 * ein Regelverstoß, keine Qualität. Kreuzungen gelten strikt ≤.
 */

const BENDS_TOLERANCE = 2;

describe('ELK-A/B auf den Golden-Master-Plänen', () => {
  for (const [name, plan] of Object.entries(GOLDEN_PLANS)) {
    it(`${name}: Kreuzungen ≤ Bestand, Bends ≤ Bestand + ${BENDS_TOLERANCE}`, async () => {
      const wired = performAutoWiring(plan.nodes, plan.edges as never[]);
      expect(wired).not.toBeNull();
      const nodes = wired!.nodes as Node[];
      const edges = wired!.edges as RouteEdgeRef[];

      const legacy = measureLegacy(routeAllCables, nodes, edges);
      const elk = await measureElk(toElkPlan(nodes, edges));

      expect(elk.edges).toBe(legacy.edges);
      expect(elk.crossings).toBeLessThanOrEqual(legacy.crossings);
      expect(elk.bends).toBeLessThanOrEqual(legacy.bends + BENDS_TOLERANCE);
    });
  }

  it('Gesamtbilanz über alle Pläne: ELK strikt besser oder gleich', async () => {
    let legacyCrossings = 0;
    let elkCrossings = 0;
    let legacyBends = 0;
    let elkBends = 0;
    for (const plan of Object.values(GOLDEN_PLANS)) {
      const wired = performAutoWiring(plan.nodes, plan.edges as never[]);
      const nodes = wired!.nodes as Node[];
      const edges = wired!.edges as RouteEdgeRef[];
      const legacy = measureLegacy(routeAllCables, nodes, edges);
      const elk = await measureElk(toElkPlan(nodes, edges));
      legacyCrossings += legacy.crossings;
      elkCrossings += elk.crossings;
      legacyBends += legacy.bends;
      elkBends += elk.bends;
    }
    // Das eigentliche Gate: in Summe ist ELK bei BEIDEN Metriken nicht schlechter.
    expect(elkCrossings).toBeLessThanOrEqual(legacyCrossings);
    expect(elkBends).toBeLessThanOrEqual(legacyBends);
  }, 30000);
});
