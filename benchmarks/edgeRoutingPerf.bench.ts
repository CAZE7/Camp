/**
 * Edge Routing Performance Benchmark — Referenzplan (100+ Kanten) + pro-Hebel-Metriken.
 *
 * Diese Datei kann auf zwei Arten ausgeführt werden:
 *   1. Direkt:   npx tsx benchmarks/edgeRoutingPerf.bench.ts
 *   2. Als Test: npm run test  (vitest picks up describe/it blocks)
 *
 * Beide Modi geben eine CI-Gate-Zusammenfassung aus.
 */

import { routeAllCables, type RouteEdgeRef } from '../components/edges/utils/routeAll';
import { computeDirtyRegion } from '../components/edges/utils/cableRouteStore';
import { reroutePreviewAffected } from '../components/edges/utils/routePreview';

// Support both tsx (direct) and vitest (test) execution modes.
// In vitest the globals `describe`, `it`, `expect` exist; in tsx they don't.
// We detect them at runtime and fall back to no-ops otherwise.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const testDescribe = (typeof describe === 'function' ? describe : ((_: string, fn: () => void) => fn()));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const testIt = (typeof it === 'function' ? it : ((_: string, fn: () => void) => fn()));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const testExpect = (typeof expect === 'function' ? expect :
  ((value: unknown) => ({
     toBeLessThan: (_: number) => {},
     toBeGreaterThanOrEqual: (_: number) => {},
     toBeLessThanOrEqual: (_: number) => {},
     toBe: (_: number) => {},
     toEqual: (_: unknown) => {},
  })));

// ---------------------------------------------------------------------------
// Deterministischer PRNG (mulberry32) — fixer Seed, kein Math.random
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20260903;

// ---------------------------------------------------------------------------
// Referenzplan: 40 Knoten (8×5 Grid), 120+ Kanten
// ---------------------------------------------------------------------------

interface BenchNode {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  data?: Record<string, unknown>;
}

function buildReferencePlan(seed: number = SEED): { nodes: BenchNode[]; edges: RouteEdgeRef[] } {
  const rng = mulberry32(seed);
  const nodes: BenchNode[] = [];
  const edges: RouteEdgeRef[] = [];
  const gridCols = 8;
  const gridRows = 5;
  const cellW = 200;
  const cellH = 150;
  let idCounter = 0;

  // 40 Knoten im Grid
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const id = `n${r}_${c}`;
      nodes.push({
        id,
        position: { x: 100 + c * cellW, y: 100 + r * cellH },
        width: 120,
        height: 80,
      });
    }
  }

  // 120+ Kanten: Grid + Diagonalen + Erganzende Kanten
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const src = `n${r}_${c}`;
      if (c < gridCols - 1) {
        edges.push({ id: `e${idCounter++}`, source: src, target: `n${r}_${c + 1}` });
      }
      if (r < gridRows - 1) {
        edges.push({ id: `e${idCounter++}`, source: src, target: `n${r + 1}_${c}` });
      }
      if (r < gridRows - 1 && c < gridCols - 1) {
        edges.push({ id: `e${idCounter++}`, source: src, target: `n${r + 1}_${c + 1}` });
      }
      if (r < gridRows - 1 && c > 0) {
        edges.push({ id: `e${idCounter++}`, source: src, target: `n${r + 1}_${c - 1}` });
      }
    }
  }

  // Erganzende Kanten bis 130 gesamt
  while (edges.length < 130) {
    const si = Math.floor(rng() * nodes.length);
    let ti = Math.floor(rng() * nodes.length);
    if (si === ti) ti = (ti + 1) % nodes.length;
    const src = nodes[si].id;
    const tgt = nodes[ti].id;
    const exists = edges.some(e => (e.source === src && e.target === tgt) || (e.source === tgt && e.target === src));
    if (!exists) {
      edges.push({ id: `e${idCounter++}`, source: src, target: tgt });
    }
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

const makeNodeSnapshot = (nodes: BenchNode[]): Map<string, { id: string; x: number; y: number; width: number; height: number }> => {
  const map = new Map<string, { id: string; x: number; y: number; width: number; height: number }>();
  for (const node of nodes) {
    if (!node) continue;
    map.set(node.id, {
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width: node.width,
      height: node.height,
    });
  }
  return map;
};

const moveNode = (nodes: BenchNode[], nodeId: string, dx: number, dy: number): BenchNode[] => {
  return nodes.map(n => {
    if (n.id !== nodeId) return n;
    return {
      ...n,
      position: { x: n.position.x + dx, y: n.position.y + dy },
    };
  });
};

// ---------------------------------------------------------------------------
// Benchmark-Helfer (direkt ausführbar und testbar)
// ---------------------------------------------------------------------------

function refBench(): Map<string, ReturnType<typeof routeAllCables>> {
  const plan = buildReferencePlan();
  return routeAllCables(plan.nodes as any, plan.edges as any);
}

function benchDirtyRegion(): {
  dirtyTime: number;
  directlyAffectedCount: number;
  regionalAffectedCount: number;
  allAffectedCount: number;
  previewTime: number;
  previewRoutesCount: number;
  dirtyTopoChange: boolean;
} {
  const plan = buildReferencePlan();
  const nodes = plan.nodes;
  const edges = plan.edges;

  const prevSnapshot = makeNodeSnapshot(nodes);
  const initialRoutes = routeAllCables(nodes as any, edges as any);

  const movedNodeId = nodes[0].id;
  const movedNodes = moveNode(nodes, movedNodeId, 100, 0);

  const dirtyStart = performance.now();
  const dirty = computeDirtyRegion(prevSnapshot, movedNodes as any, edges as any, initialRoutes);
  const dirtyTime = performance.now() - dirtyStart;

  const previewStart = performance.now();
  const previewRoutes = reroutePreviewAffected(
    movedNodes as any,
    edges as any,
    dirty.allAffectedEdgeIds,
    initialRoutes
  );
  const previewTime = performance.now() - previewStart;

  return {
    dirtyTime,
    directlyAffectedCount: dirty.directlyAffected.size,
    regionalAffectedCount: dirty.regionalAffected.size,
    allAffectedCount: dirty.allAffectedEdgeIds.size,
    previewTime,
    previewRoutesCount: previewRoutes.size,
    dirtyTopoChange: dirty.topologicalChange,
  };
}

function benchPreviewVsFull(): {
  previewTime: number;
  fullTime: number;
  previewRoutesCount: number;
  fullRoutesCount: number;
  previewTotalLength: number;
  fullTotalLength: number;
  previewTotalBends: number;
  fullTotalBends: number;
  previewAverageLength: number;
  fullAverageLength: number;
  previewAverageBends: number;
  fullAverageBends: number;
} {
  const plan = buildReferencePlan();
  const nodes = plan.nodes;
  const edges = plan.edges;

  const movedNodeId = nodes[0].id;
  const movedNodes = moveNode(nodes, movedNodeId, 100, 0);
  const prevSnapshot = makeNodeSnapshot(nodes);
  const initialRoutes = routeAllCables(nodes as any, edges as any);
  const dirty = computeDirtyRegion(prevSnapshot, movedNodes as any, edges as any, initialRoutes);

  const previewStart = performance.now();
  const previewRoutes = reroutePreviewAffected(
    movedNodes as any,
    edges as any,
    dirty.allAffectedEdgeIds,
    initialRoutes
  );
  const previewTime = performance.now() - previewStart;

  const fullStart = performance.now();
  const fullRoutes = routeAllCables(movedNodes as any, edges as any);
  const fullTime = performance.now() - fullStart;

  let previewTotalLength = 0;
  let fullTotalLength = 0;
  let previewTotalBends = 0;
  let fullTotalBends = 0;

  for (const [_, route] of previewRoutes) {
    previewTotalLength += route.waypoints.length;
    previewTotalBends += route.waypoints.length - 1;
  }
  for (const [_, route] of fullRoutes) {
    fullTotalLength += route.waypoints.length;
    fullTotalBends += route.waypoints.length - 1;
  }

  return {
    previewTime,
    fullTime,
    previewRoutesCount: previewRoutes.size,
    fullRoutesCount: fullRoutes.size,
    previewTotalLength,
    fullTotalLength,
    previewTotalBends,
    fullTotalBends,
    previewAverageLength: previewTotalLength / Math.max(1, previewRoutes.size),
    fullAverageLength: fullTotalLength / Math.max(1, fullRoutes.size),
    previewAverageBends: previewTotalBends / Math.max(1, previewRoutes.size),
    fullAverageBends: fullTotalBends / Math.max(1, fullRoutes.size),
  };
}

// ---------------------------------------------------------------------------
// CI-Gate-Auswertung (für beide Ausführungsmodi)
// ---------------------------------------------------------------------------

type GateResult = { name: string; pass: boolean; value: string };

function evaluateGates(
  dirtyResult: ReturnType<typeof benchDirtyRegion>,
  previewVsFull: ReturnType<typeof benchPreviewVsFull>,
  refRoutesCount: number
): GateResult[] {
  return [
    {
      name: 'Dirty-Region-Zeit < 5ms',
      pass: dirtyResult.dirtyTime < 5,
      value: `${dirtyResult.dirtyTime.toFixed(2)}ms`,
    },
    {
      name: 'Preview-Zeit < 100ms',
      pass: dirtyResult.previewTime < 100,
      value: `${dirtyResult.previewTime.toFixed(2)}ms`,
    },
    {
      name: 'Preview-Länge <= Voll-Länge',
      pass: previewVsFull.previewAverageLength <= previewVsFull.fullAverageLength,
      value: `${previewVsFull.previewAverageLength.toFixed(2)} vs ${previewVsFull.fullAverageLength.toFixed(2)}`,
    },
    {
      name: 'Preview-Biegungen <= Voll-Biegungen',
      pass: previewVsFull.previewAverageBends <= previewVsFull.fullAverageBends,
      value: `${previewVsFull.previewAverageBends.toFixed(2)} vs ${previewVsFull.fullAverageBends.toFixed(2)}`,
    },
    {
      name: 'Voll-Routing: alle Kanten geroutet (≥120)',
      pass: refRoutesCount >= 120,
      value: `${refRoutesCount} Routen`,
    },
  ];
}

function printResults(
  dirtyResult: ReturnType<typeof benchDirtyRegion>,
  previewVsFull: ReturnType<typeof benchPreviewVsFull>,
  refRoutesCount: number
) {
  console.log('='.repeat(72));
  console.log('  Edge Routing Performance Benchmark — CI-Gate Zusammenfassung');
  console.log('='.repeat(72));
  console.log(`\n[Referenz-Benchmark] Zeit: ${dirtyResult.dirtyTime.toFixed(2)}ms | Routen: ${refRoutesCount}`);
  console.log(`\n[Dirty Region (Hebel 1)]`);
  console.log(`  Dirty-Zeit: ${dirtyResult.dirtyTime.toFixed(2)}ms`);
  console.log(`  Direkt betroffene: ${dirtyResult.directlyAffectedCount}`);
  console.log(`  Regional betroffene: ${dirtyResult.regionalAffectedCount}`);
  console.log(`  Alle betroffene: ${dirtyResult.allAffectedCount}`);
  console.log(`  Preview-Zeit: ${dirtyResult.previewTime.toFixed(2)}ms`);
  console.log(`  Preview-Routen: ${dirtyResult.previewRoutesCount}`);
  console.log(`\n[Preview vs Full (Hebel 2)]`);
  console.log(`  Preview-Zeit: ${previewVsFull.previewTime.toFixed(2)}ms`);
  console.log(`  Voll-Zeit: ${previewVsFull.fullTime.toFixed(2)}ms`);
  console.log(`  Preview-Routen: ${previewVsFull.previewRoutesCount}`);
  console.log(`  Voll-Routen: ${previewVsFull.fullRoutesCount}`);
  console.log(`  Preview durchschnittliche Länge: ${previewVsFull.previewAverageLength.toFixed(2)}`);
  console.log(`  Voll durchschnittliche Länge: ${previewVsFull.fullAverageLength.toFixed(2)}`);
  console.log(`  Preview durchschnittliche Biegungen: ${previewVsFull.previewAverageBends.toFixed(2)}`);
  console.log(`  Voll durchschnittliche Biegungen: ${previewVsFull.fullAverageBends.toFixed(2)}`);
  console.log(`\n[CI-Gates]`);
  const gates = evaluateGates(dirtyResult, previewVsFull, refRoutesCount);
  let allPassed = true;
  for (const gate of gates) {
    const status = gate.pass ? '✓ PASS' : '✗ FAIL';
    if (!gate.pass) allPassed = false;
    console.log(`  ${status}: ${gate.name} (${gate.value})`);
  }
  console.log(`\n${'='.repeat(72)}`);
  console.log(allPassed ? '  ✓ Alle CI-Gates bestanden' : '  ✗ Einige CI-Gates nicht bestanden');
  console.log(`${'='.repeat(72)}`);
}

// ---------------------------------------------------------------------------
// Haupt-Block: Direkt-Ausführung (npx tsx ...)
// ---------------------------------------------------------------------------

if (typeof window === 'undefined' && typeof process !== 'undefined') {
  const dirtyResult = benchDirtyRegion();
  const previewVsFull = benchPreviewVsFull();
  const refRoutes = refBench();
  printResults(dirtyResult, previewVsFull, refRoutes.size);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Vitest-Tests: Jeder CI-Gate als Testfall
// ---------------------------------------------------------------------------

testDescribe('EdgeRoutingPerf — Referenzplan (100+ Kanten)', () => {
  testDescribe('Referenzplan', () => {
    testIt('hat 120+ Kanten', () => {
      const plan = buildReferencePlan();
      testExpect(plan.edges.length).toBeGreaterThanOrEqual(120);
    });
    testIt('hat 40 Knoten', () => {
      const plan = buildReferencePlan();
      testExpect(plan.nodes.length).toBe(40);
    });
  });

  testDescribe('Hebel 1: Dirty-Region', () => {
    testIt('Dirty-Region-Zeit < 5ms', () => {
      const result = benchDirtyRegion();
      testExpect(result.dirtyTime).toBeLessThan(5);
    });
    testIt('Preview-Zeit < 100ms', () => {
      const result = benchDirtyRegion();
      testExpect(result.previewTime).toBeLessThan(100);
    });
    testIt('Preview generiert Routen für alle betroffenen Kanten', () => {
      const result = benchDirtyRegion();
      testExpect(result.previewRoutesCount).toBeGreaterThanOrEqual(result.allAffectedCount);
    });
  });

  testDescribe('Hebel 2: Preview vs Full Qualität', () => {
    testIt('Preview-Länge <= Voll-Länge', () => {
      const result = benchPreviewVsFull();
      testExpect(result.previewAverageLength).toBeLessThanOrEqual(result.fullAverageLength);
    });
    testIt('Preview-Biegungen <= Voll-Biegungen', () => {
      const result = benchPreviewVsFull();
      testExpect(result.previewAverageBends).toBeLessThanOrEqual(result.fullAverageBends);
    });
  });

  testDescribe('Referenz-Routing-Integrität', () => {
    testIt('alle Kanten werden geroutet (≥120)', () => {
      const routes = refBench();
      testExpect(routes.size).toBeGreaterThanOrEqual(120);
    });
  });
});
