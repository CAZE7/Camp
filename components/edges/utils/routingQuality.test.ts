import { describe, expect, it } from 'vitest';
import { Position } from 'reactflow';
import {
  buildOrthogonalPath,
  MAX_ACCEPTABLE_CROSSINGS,
  OBSTACLE_MARGIN,
  segmentCrossesRect,
  waypointsToSegments,
  orthogonalWaypoints,
} from './orthogonalRouting';
import { PARALLEL_LANE_SPREAD } from './pathUtils';
import { ROUTING_SCENARIOS } from './routingScenarios';

describe('M10-1 Routing-Qualität', () => {
  it('Clearance ≥ 12 px, Lanes 16 px, Kreuzungen ≤ 2', () => {
    expect(OBSTACLE_MARGIN).toBeGreaterThanOrEqual(12);
    expect(PARALLEL_LANE_SPREAD).toBe(16);
    expect(MAX_ACCEPTABLE_CROSSINGS).toBe(2);
  });

  it('kein Segment durch fremde Knoten (außer dokumentierter Ausnahme)', () => {
    for (const scenario of ROUTING_SCENARIOS) {
      const { waypoints } = orthogonalWaypoints(scenario.input);
      const obstacles = scenario.input.obstacles ?? [];
      const crossings = waypointsToSegments(waypoints).filter(([a, b]) =>
        obstacles.some((obstacle) => segmentCrossesRect(a, b, obstacle))
      );
      if (scenario.obstacleFree) {
        expect(crossings, scenario.id).toHaveLength(0);
      }
    }
  });

  it('≤ 2 Kreuzungen pro Kante außer dokumentierter Stress-/Gitter-Szenen', () => {
    const pathological = new Set(['15-crossing-dense-grid', '22-stress-scene']);
    for (const scenario of ROUTING_SCENARIOS) {
      const { crossings } = orthogonalWaypoints(scenario.input);
      if (pathological.has(scenario.id)) {
        expect(crossings, scenario.id).toBeGreaterThan(MAX_ACCEPTABLE_CROSSINGS);
        continue;
      }
      expect(crossings, scenario.id).toBeLessThanOrEqual(MAX_ACCEPTABLE_CROSSINGS);
    }
  });

  it('deterministisch: gleicher Plan → identisches Routing', () => {
    const input = {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 400,
      targetY: 80,
      targetPosition: Position.Left,
      offset: 16,
      obstacles: [{ x: 120, y: -40, width: 192, height: 120 }],
    };
    expect(buildOrthogonalPath(input)).toEqual(buildOrthogonalPath({ ...input }));
  });

  it('Referenzplan ≤ 16 ms', () => {
    const input = ROUTING_SCENARIOS.find((scenario) => scenario.id === '22-stress-scene')!.input;
    buildOrthogonalPath(input);
    const start = performance.now();
    for (let i = 0; i < 40; i++) buildOrthogonalPath(input);
    const avg = (performance.now() - start) / 40;
    expect(avg).toBeLessThanOrEqual(16);
  });
});
