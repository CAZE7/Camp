import { describe, expect, it } from 'vitest';
import { GOLDEN_PLANS } from '../goldenmaster/plans';
import { performAutoWiring } from '../../lib/autoWire';
import { routeAllCables } from '../../components/edges/utils/routeAll';
import { nodesToObstacles, stubCapFor } from '../../components/edges/utils/pathfinding';
import { ROUTING_TOKENS } from '../../lib/routing/tokens';
import {
  portCapacity,
  requiredPortCorridor,
  requiredRawCorridor,
} from '../../lib/routing/rules/portCapacity';

/**
 * Korridor-Kapazität an Port-Bündeln (ROUTE-BUG-31/32/37).
 *
 * Ein Port-Bündel staffelt seine Kabel um je ein Lane-Raster
 * (`stubMin + Rang · laneGrid`). Das geht nur, wenn der Korridor in
 * Austrittsrichtung den tiefsten Stub PLUS `cableClearance` hergibt:
 *
 *     nötig (K Kabel) = stubMin + (K−1) · laneGrid       [freier Korridor]
 *     Kapazität(D)    = 1 + ⌊(D − stubMin) / laneGrid⌋   [D = stubCapFor]
 *
 * Der Test prüft beides: die Formel selbst (reine Token-Arithmetik, eine
 * Quelle) und die SECHS Referenzpläne gegen ihre gemessenen Port-Bündel.
 *
 * Warum eine dokumentierte Liste statt „alle Pläne müssen passen": Die
 * Kapazität ist ein **hinreichendes Layout-Kriterium**, keine Invariante.
 * Ist ein Korridor zu eng, kann der Router die Staffelung nicht aufbauen —
 * er degradiert kontrolliert (Rang-Treppe, harte Kappung) und das Gate zählt
 * anschließend die echten Verstöße. Umgekehrt kann ein Bündel auch bei
 * rechnerisch knapper Kapazität sauber laufen, wenn ein Kabel die Seite
 * wechselt. Die Liste hält deshalb den gemessenen Stand fest: Jede NEUE
 * Über-Kapazität fällt als Testfehler auf, und wer eine abbaut, streicht sie
 * hier — dieselbe Richtung wie die übrigen Ratchets (sinken ja, steigen nein).
 */

type Portfolio = { plan: string; group: string; cables: number; free: number; capacity: number };

/** Gemessene Port-Bündel je Plan (Basis-Routing, ohne Trenngang). */
export function measurePortCapacity(planName: string): Portfolio[] {
  const plan = GOLDEN_PLANS[planName]!;
  const wired = performAutoWiring(plan.nodes as never, plan.edges as never)!;
  const routes = routeAllCables(wired.nodes as never, wired.edges as never);
  const out = new Map<string, Portfolio>();
  for (const edge of wired.edges as never as Array<{ id: string; source: string; target: string }>) {
    const result = routes.get(edge.id);
    const wp = result?.waypoints ?? [];
    if (wp.length < 2) continue;
    for (const kind of ['source', 'target'] as const) {
      const point = kind === 'source' ? wp[0]! : wp[wp.length - 1]!;
      const next = kind === 'source' ? wp[1]! : wp[wp.length - 2]!;
      const dx = Math.sign(next.x - point.x);
      const dy = Math.sign(next.y - point.y);
      if (dx === 0 && dy === 0) continue;
      const nodeId = kind === 'source' ? edge.source : edge.target;
      const key = `${nodeId}|${dx},${dy}`;
      const own = new Set<string>([edge.source, edge.target]);
      const free = stubCapFor(point, { x: dx, y: dy }, nodesToObstacles(wired.nodes as never, own));
      const entry = out.get(key) ?? { plan: planName, group: key, cables: 0, free, capacity: 0 };
      entry.cables += 1;
      entry.capacity = portCapacity(entry.free);
      out.set(key, entry);
    }
  }
  return [...out.values()].sort((a, b) => a.group.localeCompare(b.group));
}

/**
 * Gemessene Über-Kapazitäten (2026-10-03) — mit Begründung, warum sie
 * stehen bleiben dürfen:
 *
 * - `camper`, `auto-node:busbar:Minus-Schiene|0,−1`: K = 4, frei = 64,
 *   Kapazität = 3. Die vier Leitungen laufen trotzdem sauber (I3 = 0):
 *   zwei von ihnen teilen sich nach der Rang-Treppe eine Stub-Länge und
 *   trennen sich erst über ihre Lane-Offsets — der Trenngang bestätigt das.
 *   Ein Korridor-Umbau wäre hier eine Layout-Änderung ohne gemessenen
 *   Nutzen; die Liste hält den Fall sichtbar.
 */
const DOCUMENTED_OVER_CAPACITY: ReadonlyArray<{ plan: string; group: string }> = [
  { plan: 'camper', group: 'auto-node:busbar:Minus-Schiene|0,-1' },
];

const isDocumented = (entry: Portfolio): boolean =>
  DOCUMENTED_OVER_CAPACITY.some((doc) => doc.plan === entry.plan && doc.group === entry.group);

describe('portCapacity — Token-Arithmetik', () => {
  it('leitet beide Formeln aus denselben Tokens ab', () => {
    const { stubMin, laneGrid, cableClearance } = ROUTING_TOKENS;
    expect(requiredPortCorridor(1)).toBe(stubMin);
    expect(requiredPortCorridor(2)).toBe(stubMin + laneGrid);
    expect(requiredPortCorridor(4)).toBe(stubMin + 3 * laneGrid);
    expect(requiredRawCorridor(4)).toBe(stubMin + 3 * laneGrid + cableClearance);
    expect(portCapacity(requiredPortCorridor(4))).toBe(4);
    expect(portCapacity(requiredPortCorridor(4) - 1)).toBe(3);
    expect(portCapacity(0)).toBe(1);
    expect(portCapacity(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });

  it('ist monoton: mehr Korridor trägt nie weniger Kabel', () => {
    let last = 0;
    for (let free = 0; free <= 300; free += 4) {
      const capacity = portCapacity(free);
      expect(capacity).toBeGreaterThanOrEqual(last);
      last = capacity;
    }
  });

  it('dokumentiert den gemessenen Anlass: 48 px Korridor trugen keine vier Lanes', () => {
    // Vor der Layout-Korrektur (busbar-plus y = 500) standen dem Minus-Bündel
    // in `complex` 48 px FREIER Korridor zur Verfügung (Kapazität 2), vier
    // Lanes brauchen 72 px — daraus wurden die 4-px-Parallelläufe (I3).
    const free = 48;
    expect(portCapacity(free)).toBe(2);
    expect(requiredPortCorridor(4)).toBeGreaterThan(free);
  });
});

describe('Port-Kapazität der Referenzpläne (gemessen, dokumentiert)', () => {
  it('meldet genau die dokumentierten Über-Kapazitäten — keine neuen', () => {
    const found: Array<{ plan: string; group: string }> = [];
    for (const name of Object.keys(GOLDEN_PLANS)) {
      for (const entry of measurePortCapacity(name)) {
        if (entry.capacity < entry.cables) {
          found.push({ plan: entry.plan, group: entry.group });
          // Kein stiller Durchlauf: jeder Fund muss eine Begründung haben.
          expect(isDocumented(entry)).toBe(true);
        }
      }
    }
    // Und umgekehrt: die Liste darf keine erledigten Einträge mitschleppen.
    for (const doc of DOCUMENTED_OVER_CAPACITY) {
      expect(found).toContainEqual({ plan: doc.plan, group: doc.group });
    }
  });

  it('complex hält die Korridor-Regel seit der Layout-Korrektur ein', () => {
    const groups = measurePortCapacity('complex');
    const minus = groups.find((group) => group.group === 'busbar-minus|0,-1');
    expect(minus, 'Minus-Bündel des Referenzplans complex').toBeDefined();
    expect(minus!.capacity).toBeGreaterThanOrEqual(minus!.cables);
  });
});
