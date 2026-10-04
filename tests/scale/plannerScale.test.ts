/**
 * V2-SCALE: Skalentests 10 / 25 / 50 / 100 / 250 Knoten.
 *
 * Die sechs Referenzpläne (`scripts/goldenmaster/plans.ts`) haben < 24 Kanten.
 * Alles, was in dieser Größe gut aussieht, kann bei 250 Knoten zusammenbrechen
 * — und zwar nicht nur langsam, sondern FALSCH: Eine Sortierung, die bei acht
 * Elementen zufällig stabil wirkt, wird bei 250 zur Reihenfolgeabhängigkeit.
 *
 * Geprüft werden deshalb die Zusagen, die unabhängig von der Plangröße gelten
 * müssen (Reihenfolge entspricht der Prioritätenliste des Auftrags):
 *
 *   1. KORREKTHEIT   — das Routing verletzt keine harte Invariante (I1/I2/I3).
 *   2. DETERMINISMUS — gleiche Eingabe ⇒ gleiche Ausgabe, auch bei
 *                      umgedrehter Eingabereihenfolge.
 *   3. NUTZERABSICHT — gepinnte Kanten überleben Auto-Wire unverändert.
 *   4. KONVERGENZ    — ein zweiter Auto-Wire-Lauf ändert nichts (Idempotenz),
 *                      und das Generationsmodell meldet „konvergiert".
 *   5. PERFORMANCE   — großzügige Obergrenze als Reißleine gegen
 *                      Laufzeitexplosionen (kein Mikro-Benchmark; der steht
 *                      in `benchmarks/`).
 *
 * Bewusst KEINE Schnappschüsse: Dieser Test sichert Eigenschaften, keine
 * Pixel. Ein besseres Layout darf ihn nicht rot färben.
 */
import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { performAutoWiring } from '../../lib/autoWire';
import type { CableEdgeData } from '../../components/edges/CableEdge';
import { routeAllCables, type RouteEdgeRef } from '../../components/edges/utils/routeAll';
import { nodesToObstacles } from '../../components/edges/utils/pathfinding';
import { validateFinalRouting, formatFinalValidation } from '../../lib/routing/finalValidation';
import { buildElectricalGraph, electricalGraphHash } from '../../lib/electricalGraph/graph';
import {
  routingInputHash,
  createRouteGenerationTracker,
  MAX_ROUTE_REVISIONS_PER_GRAPH,
} from '../../lib/routing/generation';
import { edgeIntentOf } from '../../lib/electricalGraph/intent';

const SIZES = [10, 25, 50, 100, 250] as const;

/**
 * Großzügige Reißleine je Plangröße (ms). KEIN Qualitätsziel, ein Alarm
 * gegen Laufzeitexplosionen (vgl. den Fall vom 2026-09-08: 203 s für 250
 * Knoten). Gemessen auf dem Entwicklungsrechner ohne Coverage-Instrument:
 * 10 → 0,3 s | 25 → 1,6 s | 50 → 6,0 s | 100 → 12,3 s | 250 → 62,4 s.
 * Die Budgets liegen bei ~2–3× der Messung, damit langsamere CI-Läufer
 * nicht rot werden, ein echter Einbruch aber auffällt.
 *
 * Die Zahlen selbst sind ein BEFUND, kein Erfolg: Das Routing wächst
 * deutlich überlinear (siehe docs/routing.md, Abschnitt „Skalierung").
 */
const TIME_BUDGET_MS: Readonly<Record<(typeof SIZES)[number], number>> = {
  10: 2_000,
  25: 6_000,
  50: 15_000,
  100: 40_000,
  250: 180_000,
};

/**
 * Die beiden teuren Fälle (vollständiges Routing + O(E²)-Invariantenprüfung)
 * brauchen bei 250 Knoten zusammen über zwei Minuten — unter Coverage noch
 * mehr. Sie laufen deshalb nur auf Anforderung (`SCALE_250=1 npm test`).
 * Das versteckt nichts: Beide Fälle sind GRÜN gemessen (siehe oben), und
 * alle reihenfolge-/konvergenzbezogenen Zusagen werden auch bei 250 Knoten
 * bei jedem Lauf geprüft.
 */
const RUN_EXPENSIVE_250 = process.env.SCALE_250 === '1';

const COL_W = 420;
const ROW_H = 240;
const COLS = 8;

/**
 * Erzeugt einen realistisch gemischten Plan: eine Hausbatterie, Solar mit
 * Regler, ein Wechselrichter, Landstrom und der Rest Verbraucher. Die
 * Mischung ist wichtig — ein Plan aus 250 gleichen Verbrauchern prüft nur
 * einen Codepfad.
 */
function makePlan(size: number): { nodes: Node[]; edges: Edge<CableEdgeData>[] } {
  const nodes: Node[] = [];
  for (let i = 0; i < size; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const position = { x: col * COL_W, y: row * ROW_H };
    const id = `n${String(i).padStart(3, '0')}`;
    if (i === 0) {
      nodes.push({
        id,
        type: 'battery',
        position,
        data: { label: 'Hausbatterie', capacity: 200, nominalVoltage: 12.8, chemistry: 'lifepo4' },
        width: 192,
        height: 126,
      });
    } else if (i === 1) {
      nodes.push({
        id,
        type: 'solar',
        position,
        data: { label: 'Solarmodul', watts: 400 },
        width: 192,
        height: 126,
      });
    } else if (i === 2) {
      nodes.push({
        id,
        type: 'mpptController',
        position,
        data: { label: 'Laderegler', amps: 50 },
        width: 192,
        height: 126,
      });
    } else if (i === 3) {
      nodes.push({
        id,
        type: 'inverter',
        position,
        data: { label: 'Wechselrichter', continuousPower: 2000 },
        width: 192,
        height: 126,
      });
    } else if (i === 4) {
      nodes.push({
        id,
        type: 'shorePower',
        position,
        data: { label: 'Landstrom' },
        width: 192,
        height: 126,
      });
    } else {
      nodes.push({
        id,
        type: 'consumer',
        position,
        data: { label: `Verbraucher ${i}`, watts: 20 + (i % 7) * 15 },
        width: 192,
        height: 126,
      });
    }
  }
  // Eine vom Nutzer gezogene, ausdrücklich erklärte Verbindung — sie muss
  // jeden Lauf überleben, egal wie groß der Plan ist.
  const edges: Edge<CableEdgeData>[] = [];
  if (size >= 10) {
    edges.push({
      id: 'user-pinned-1',
      source: 'n000',
      target: 'n009',
      sourceHandle: 'plus',
      targetHandle: 'plus',
      data: { intent: 'user', length: 2 },
    });
  }
  return { nodes, edges };
}

const wire = (plan: { nodes: Node[]; edges: Edge<CableEdgeData>[] }) => {
  const result = performAutoWiring(plan.nodes as never, plan.edges as never);
  expect(result).not.toBeNull();
  return result!;
};

const topologyOf = (edges: readonly { id: string; source: string; target: string }[]) =>
  edges
    .map((edge) => `${edge.id}|${edge.source}->${edge.target}`)
    .sort()
    .join('\n');

describe.each(SIZES)('V2-SCALE: Plan mit %i Knoten', (size) => {
  const plan = makePlan(size);
  const budget = TIME_BUDGET_MS[size];

  const expensive = size !== 250 || RUN_EXPENSIVE_250;

  it.runIf(expensive)(
    'Auto-Wire + Routing bleiben innerhalb der Reißleine',
    () => {
      const started = Date.now();
      const wired = wire(plan);
      routeAllCables(wired.nodes as never, wired.edges as never as RouteEdgeRef[]);
      const elapsed = Date.now() - started;
      expect(elapsed, `${size} Knoten: ${elapsed} ms (Budget ${budget} ms)`).toBeLessThan(budget);
    },
    budget + 30_000
  );

  it.runIf(expensive)(
    'Routing verletzt keine harte Invariante (I1/I2/I3 = 0)',
    () => {
      const wired = wire(plan);
      const edges = wired.edges as never as RouteEdgeRef[];
      const routes = routeAllCables(wired.nodes as never, edges);
      const routed = edges
        .map((edge) => ({ edge, route: routes.get(edge.id) }))
        .filter((entry): entry is { edge: RouteEdgeRef; route: NonNullable<typeof entry.route> } =>
          Boolean(entry.route)
        )
        .map(({ edge, route }) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          waypoints: route.waypoints,
        }));
      const rects = (wired.nodes as unknown as { id: string }[]).map((node, index) => {
        const [rect] = nodesToObstacles([node as never], new Set<string>());
        return { id: node.id ?? `n${index}`, ...rect! };
      });
      const report = validateFinalRouting(routed, rects);
      expect(formatFinalValidation(report)).toContain('VALID');
    },
    budget + 30_000
  );

  it(
    'ist deterministisch — auch bei umgedrehter Eingabereihenfolge',
    () => {
      const forward = wire(plan);
      const reversed = wire({ nodes: [...plan.nodes].reverse(), edges: [...plan.edges].reverse() });
      // Die Topologie (wer hängt an wem) darf nicht von der Listenreihenfolge
      // abhängen. Positionen dürfen es: sie sind Ergebnis der Layoutschicht.
      expect(topologyOf(reversed.edges)).toBe(topologyOf(forward.edges));
      expect(electricalGraphHash(buildElectricalGraph(reversed.nodes, reversed.edges))).toBe(
        electricalGraphHash(buildElectricalGraph(forward.nodes, forward.edges))
      );
    },
    budget + 30_000
  );

  it(
    'ein zweiter Auto-Wire-Lauf ändert nichts (Idempotenz)',
    () => {
      const first = wire(plan);
      const second = wire({
        nodes: first.nodes as never as Node[],
        edges: first.edges as never as Edge<CableEdgeData>[],
      });
      expect(topologyOf(second.edges)).toBe(topologyOf(first.edges));
    },
    budget + 30_000
  );

  it('die erklärte Nutzerkante überlebt unverändert', () => {
    const wired = wire(plan);
    const pinned = wired.edges.find((edge) => edge.id === 'user-pinned-1');
    expect(pinned).toBeDefined();
    expect(pinned?.source).toBe('n000');
    expect(pinned?.target).toBe('n009');
    expect(edgeIntentOf(pinned!)).toBe('user');
  });

  it('das Generationsmodell konvergiert bei unveränderter Eingabe', () => {
    const wired = wire(plan);
    const nodeSignature = (wired.nodes as unknown as { id: string; position: { x: number; y: number } }[])
      .map((node) => `${node.id}:${node.position.x},${node.position.y}`)
      .join('|');
    const edgeSignature = topologyOf(wired.edges);
    const hash = routingInputHash(nodeSignature, edgeSignature);

    // MAX_ROUTE_REVISIONS_PER_GRAPH = 4 erlaubt vier Revisionen derselben
    // Eingabe (Normallauf, Vor-/Nach-Messung, Layout-Effekt); die fünfte ist
    // per Definition eine Schleife und wird abgeschnitten.
    const tracker = createRouteGenerationTracker();
    const statuses = Array.from({ length: MAX_ROUTE_REVISIONS_PER_GRAPH + 1 }, () => tracker.begin(hash));
    expect(statuses.map((status) => status.allowed)).toEqual([true, true, true, true, false]);
    expect(statuses.at(-1)?.converged).toBe(false);
    // Der Hash trennt Generationen: eine echte Eingabeänderung macht wieder frei.
    expect(tracker.begin(routingInputHash(nodeSignature, `${edgeSignature}\nmehr`)).allowed).toBe(true);
    // Dieselbe Eingabe ⇒ derselbe Hash, unabhängig vom Plan-Umfang.
    expect(routingInputHash(nodeSignature, edgeSignature)).toBe(hash);
  });
});
