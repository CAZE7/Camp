import { Position } from '@xyflow/react';
import { performAutoWiring } from '../../lib/autoWire';
import { GOLDEN_PLANS } from '../../scripts/goldenmaster/plans';
import { REGRESSION_SCENARIOS } from '../../scripts/regression/scenarios';
import { routeAllCables, type RouteEdgeRef } from '../../components/edges/utils/routeAll';
import type { RoutableNode } from '../../components/edges/utils/nodeGeometry';

export type RoutingFixture = { id: string; nodes: RoutableNode[]; edges: RouteEdgeRef[]; seed?: number };
function synthetic(n: number, seed: number, dense: boolean): RoutingFixture {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const nodes: RoutableNode[] = Array.from({ length: n }, (_, i) => {
    const width = 150 + Math.floor(random() * 60);
    const height = 90 + Math.floor(random() * 60);
    return {
      id: `n${i}`,
      type: i === 0 ? 'battery' : 'consumer',
      data: {},
      width,
      height,
      position: { x: (i % 10) * (dense ? 245 : 400), y: Math.floor(i / 10) * (dense ? 180 : 290) },
      handleBounds: {
        source: [
          { id: 'plus', x: width - 5, y: height / 2 - 5, width: 10, height: 10, position: Position.Right },
        ],
        target: [{ id: 'plus', x: -5, y: height / 2 - 5, width: 10, height: 10, position: Position.Left }],
      },
    } as RoutableNode;
  });
  const edges: RouteEdgeRef[] = Array.from({ length: n - 1 }, (_, i) => ({
    id: `e${String(i).padStart(3, '0')}`,
    source: `n${i}`,
    target: `n${i + 1}`,
    sourceHandle: 'plus',
    targetHandle: 'plus',
  }));
  if (dense)
    for (let i = 0; i < Math.floor(n / 2); i++)
      edges.push({
        id: `span${i}`,
        source: `n${i}`,
        target: `n${n - 1 - i}`,
        sourceHandle: 'plus',
        targetHandle: 'plus',
      });
  return { id: `seed-${seed}-${n}-${dense ? 'dense' : 'sparse'}`, seed, nodes, edges };
}
export function routingFixtures(): RoutingFixture[] {
  const golden = Object.entries(GOLDEN_PLANS).map(([id, plan]) => {
    const wired = performAutoWiring(structuredClone(plan.nodes), structuredClone(plan.edges));
    if (!wired) throw new Error(`AutoWire failed for ${id}`);
    return { id: `golden-${id}`, nodes: wired.nodes as RoutableNode[], edges: wired.edges as RouteEdgeRef[] };
  });
  const base = structuredClone(REGRESSION_SCENARIOS[0]!);
  const initial = routeAllCables(base.nodes, base.edges);
  const locked: RoutingFixture = {
    id: 'manual-locked',
    nodes: base.nodes,
    edges: base.edges.map((edge) => ({
      ...edge,
      data: { ...edge.data, locked: true, lockedWaypoints: initial.get(edge.id)!.waypoints },
    })),
  };
  const moved = structuredClone(locked);
  moved.id = 'manual-locked-moved';
  moved.nodes[1]!.position.x += 100;
  const large = structuredClone(REGRESSION_SCENARIOS[0]!);
  large.nodes[0]!.width = 340;
  large.nodes[0]!.height = 220;
  return [
    ...golden,
    ...REGRESSION_SCENARIOS.map((fixture) => structuredClone(fixture)),
    locked,
    moved,
    { ...large, id: 'asymmetric-large' },
    synthetic(10, 7, false),
    synthetic(25, 42, true),
    synthetic(50, 73, false),
    synthetic(50, 97, true),
  ];
}
