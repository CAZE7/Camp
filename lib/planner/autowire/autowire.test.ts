import { describe, expect, it } from 'vitest';
import type { PlannerNode } from '../domain';
import { analyseNodes } from './analyse';
import { buildTopology } from './topology';
import { planConnections } from './wiringStrategy';
import { sizeConnections } from './sizing';
import { routeConnections } from './routing';
import { AUTO_WIRE_MISSING_BATTERY_MESSAGE, planAutoWiringPipeline } from './index';

const battery: PlannerNode = { id: 'b1', type: 'battery', position: { x: 10, y: 20 }, data: { capacity: 100 } };
const consumer: PlannerNode = { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 24 } };

describe('autowire pipeline (entkoppelt)', () => {
  it('analyse stage categorizes nodes and rejects a missing battery', () => {
    expect(analyseNodes([consumer])).toBeNull();
    const analysis = analyseNodes([battery, consumer])!;
    expect(analysis.battery.id).toBe('b1');
    expect(analysis.consumers.map((n) => n.id)).toEqual(['c1']);
  });

  it('topology stage ensures the structural components', () => {
    const nodes = [battery, consumer];
    const analysis = analyseNodes(nodes)!;
    const topology = buildTopology(analysis, nodes, { idFactory: (() => { let i = 0; return () => `n${i++}`; })() });

    expect(topology.busbar.type).toBe('busbar');
    expect(topology.fuseBox.type).toBe('fuse');
    expect(topology.shunt.type).toBe('shunt');
    expect(nodes.map((n) => n.type).sort()).toEqual(['battery', 'busbar', 'consumer', 'fuse', 'shunt']);
  });

  it('wiring strategy yields the ordering battery→shunt→busbar→fusebox→consumer', () => {
    const nodes = [battery, consumer];
    const analysis = analyseNodes(nodes)!;
    const topology = buildTopology(analysis, nodes, { idFactory: (() => { let i = 0; return () => `n${i++}`; })() });
    const intents = planConnections(analysis, topology);

    expect(intents.map((i) => i.targetId)).toEqual([
      topology.shunt.id,
      topology.busbar.id,
      topology.fuseBox.id,
      'c1',
    ]);
  });

  it('sizing applies calculateWire to every intent', () => {
    const sized = sizeConnections([
      { sourceId: 'a', targetId: 'b', currentA: 30, length: 2 },
    ]);
    expect(sized[0]).toMatchObject({ sourceId: 'a', targetId: 'b', currentA: 30, length: 2 });
    expect(sized[0].crossSection).toBeGreaterThan(0);
    expect(sized[0].fuseSize).toBeGreaterThan(0);
  });

  it('routing creates plus and minus cable edges', () => {
    const edges = routeConnections([
      { sourceId: 'a', targetId: 'b', currentA: 10, length: 2, crossSection: 2.5, fuseSize: 16 },
    ]);
    expect(edges).toHaveLength(2);
    expect(edges[0].sourceHandle).toBe('plus');
    expect(edges[1].sourceHandle).toBe('minus');
    expect(edges[0].data).toMatchObject({ crossSection: 2.5, fuseSize: 16 });
    expect(edges[1].data).toMatchObject({ crossSection: 2.5 });
  });

  it('full pipeline equals the legacy result shape', () => {
    const result = planAutoWiringPipeline([battery, consumer], { idFactory: (() => { let i = 0; return () => `g${i++}`; })() });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nodes.map((n) => n.type).sort()).toEqual(['battery', 'busbar', 'consumer', 'fuse', 'shunt']);
      expect(result.edges.filter((e) => e.sourceHandle === 'plus')).toHaveLength(4);
      expect(result.edges.filter((e) => e.sourceHandle === 'minus')).toHaveLength(4);
    }
  });

  it('reports a domain error when no battery exists', () => {
    const result = planAutoWiringPipeline([consumer]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe(AUTO_WIRE_MISSING_BATTERY_MESSAGE);
    }
  });
});
