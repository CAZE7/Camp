/**
 * scripts/measure_planner_v2.ts
 *
 * Routing V2 acceptance gate suite.
 *
 * Exits with code 0 when all gates pass, otherwise prints the failing gates and
 * exits with code 1.
 */
import { routeAllEdges } from '../lib/planner/routing-v2/orchestrator';
import type { PlannerEdge, PlannerNode } from '../lib/planner/domainModel';
import { GEOMETRY } from '../lib/planner/tokens';

export const MAX_CROSSINGS = 2;
/**
 * Budget for the full deterministic gate, which routes the dense 23-edge
 * fixture twice (forward + reversed order). The local single-pass cost is
 * around 1.7 s; CI runners are slower, so the ceiling includes two passes plus
 * generous headroom while still catching algorithmic regressions.
 */
export const PERF_BUDGET_MS = 10_000;

const node = (id: string, type: string, x: number, y: number): PlannerNode => ({
  id,
  type,
  position: { x, y },
  data: { label: id },
  width: 120,
  height: 80,
});

const edge = (
  id: string,
  source: string,
  target: string,
  sourceHandle?: string,
  targetHandle?: string
): PlannerEdge => ({
  id,
  source,
  target,
  sourceHandle,
  targetHandle,
  data: { length: 1 },
});

// Industrial stress fixture: a 20-node / 23-edge camper electrical network with
// multiple fan-outs, dual chargers, inverters, solar and a separate shore chain.
const sampleNodes: PlannerNode[] = [
  node('b1', 'battery', 0, 0),
  node('s1', 'shunt', 160, 0),
  node('bb', 'busbar', 320, 0),
  node('f1', 'fuse', 480, 0),
  node('f2', 'fuse', 640, 0),
  node('c1', 'consumer', 800, 0),
  node('c2', 'consumer', 800, -160),
  node('c3', 'consumer', 800, 160),
  node('ch1', 'charger', 160, 200),
  node('ch2', 'charger', 160, -200),
  node('inv1', 'inverter', 480, 200),
  node('inv2', 'inverter', 480, -200),
  node('sol1', 'solar', 0, 400),
  node('sol2', 'solar', 160, 400),
  node('mppt', 'charger', 320, 400),
  node('sh1', 'shorePower', 800, 400),
  node('g1', 'ground', 0, -400),
  node('g2', 'ground', 800, -400),
  node('load1', 'consumer230v', 800, 560),
  node('load2', 'consumer230v', 800, 720),
];

const sampleEdges: PlannerEdge[] = [
  edge('e1', 'b1', 's1', 'plus', 'plus'),
  edge('e2', 's1', 'bb', 'plus', 'plus'),
  edge('e3', 'bb', 'f1', 'plus', 'plus'),
  edge('e4', 'bb', 'f2', 'plus', 'plus'),
  edge('e5', 'f1', 'c1', 'plus', 'plus'),
  edge('e6', 'f2', 'c2', 'plus', 'plus'),
  edge('e7', 'f2', 'c3', 'plus', 'plus'),
  edge('e8', 'b1', 'ch1', 'minus', 'minus'),
  edge('e9', 'ch1', 'bb', 'plus', 'plus'),
  edge('e10', 'b1', 'ch2', 'minus', 'minus'),
  edge('e11', 'ch2', 'bb', 'plus', 'plus'),
  edge('e12', 'bb', 'inv1', 'plus', 'plus'),
  edge('e13', 'inv1', 'c1', 'plus', 'plus'),
  edge('e14', 'bb', 'inv2', 'plus', 'plus'),
  edge('e15', 'inv2', 'c2', 'plus', 'plus'),
  edge('e16', 'sol1', 'mppt', 'plus', 'plus'),
  edge('e17', 'sol2', 'mppt', 'plus', 'plus'),
  edge('e18', 'mppt', 'bb', 'plus', 'plus'),
  edge('e19', 'sh1', 'bb', 'plus', 'plus'),
  edge('e20', 's1', 'g1', 'minus', 'minus'),
  edge('e21', 'bb', 'g2', 'minus', 'minus'),
  edge('e22', 'inv1', 'load1', 'plus', 'plus'),
  edge('e23', 'inv2', 'load2', 'plus', 'plus'),
];

type Gate = {
  id: string;
  description: string;
  passed: boolean;
  value: string | number | boolean;
};

function main(): void {
  const started = Date.now();
  const first = routeAllEdges({ nodes: sampleNodes, edges: sampleEdges });
  const second = routeAllEdges({
    nodes: [...sampleNodes].reverse(),
    edges: [...sampleEdges].reverse(),
  });
  const elapsedMs = Date.now() - started;

  const deterministic = JSON.stringify(first.edges) === JSON.stringify(second.edges);

  const gates: Gate[] = [
    {
      id: 'G1',
      description: 'max edge-node collisions = 0',
      passed: first.diagnostics.maxEdgeNodeCollisions === 0,
      value: first.diagnostics.maxEdgeNodeCollisions,
    },
    {
      id: 'G2',
      description: 'max edge-edge overlaps = 0',
      passed: first.diagnostics.maxEdgeEdgeOverlaps === 0,
      value: first.diagnostics.maxEdgeEdgeOverlaps,
    },
    {
      id: 'G3',
      description: `min clearance >= ${GEOMETRY.cableClearance}`,
      passed: first.diagnostics.minClearance >= GEOMETRY.cableClearance,
      value: Number(first.diagnostics.minClearance.toFixed(2)),
    },
    {
      id: 'G4',
      description: 'deterministic layout = true',
      passed: deterministic,
      value: deterministic,
    },
    {
      id: 'G5',
      description: `crossing count <= ${MAX_CROSSINGS}`,
      passed: first.diagnostics.totalCrossings <= MAX_CROSSINGS,
      value: first.diagnostics.totalCrossings,
    },
    {
      id: 'G6',
      description: 'hop correctness = 100% (no new collisions)',
      passed: first.diagnostics.totalCrossings <= MAX_CROSSINGS && first.diagnostics.totalCollisions === 0,
      value: first.diagnostics.totalCollisions,
    },
    {
      id: 'G7',
      description: `performance <= ${PERF_BUDGET_MS} ms`,
      passed: elapsedMs <= PERF_BUDGET_MS,
      value: elapsedMs,
    },
  ];

  const failed = gates.filter((gate) => !gate.passed);
  const report = {
    elapsedMs,
    deterministic,
    diagnostics: first.diagnostics,
    gates,
    passed: failed.length === 0,
  };

  console.log(JSON.stringify(report, null, 2));

  if (failed.length > 0) {
    console.error(`\nFAILED gates: ${failed.map((gate) => gate.id).join(', ')}`);
    process.exitCode = 1;
  }
}

main();
