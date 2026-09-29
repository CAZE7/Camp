import { describe, expect, it } from 'vitest';

import { verificationOptions, type PassContext } from './context';
import { buildConductionGraph, neighborsOf } from './graph';
import type { ConductionGraph } from './types';
import {
  effectiveOvercurrentDevice,
  isSourceNode,
  protectionsOnCable,
  sortedCables,
  sortedPorts,
  upstreamChain,
} from './pathSearch';
import { fixtureEdge, fixtureNode, healthyDcPlan, islandPlan, type FixturePlan } from './planFixtures';
import { buildPortGraph } from './topology';

function contextOf(plan: FixturePlan): PassContext {
  return {
    nodes: plan.nodes,
    edges: plan.edges,
    graph: buildConductionGraph(plan.nodes, plan.edges),
    options: verificationOptions(),
  };
}

const cableOf = (graph: ConductionGraph, edgeId: string) => {
  const cable = graph.cableById.get(edgeId);
  if (!cable) throw new Error(`Kabel ${edgeId} fehlt im Modell`);
  return cable;
};

/** Zwei parallele Plus-Leitungen zwischen Batterie und Sicherungskasten. */
function parallelFeedPlan(): FixturePlan {
  const plan = healthyDcPlan();
  return {
    nodes: [...plan.nodes],
    edges: [
      ...plan.edges,
      fixtureEdge('e-bat-fuse-b', 'bat1', 'plus', 'fuse1', 'plus', {
        crossSection: 16,
        length: 1,
        fuseSize: 20,
        fuseType: 'ato',
      }),
    ],
  };
}

describe('lib/verify/pathSearch — Aufwärtssuche auf dem Port-Graphen', () => {
  it('findet Quelle, Schutzorgan und Weglänge der betrachteten Leitung', () => {
    const context = contextOf(healthyDcPlan());
    const chain = upstreamChain(
      context.graph,
      buildPortGraph(context.graph),
      cableOf(context.graph, 'e-fuse-load')
    );

    expect(chain.sourceNodeIds).toEqual(['bat1']);
    expect(chain.lengthUnknown).toBe(false);
    expect(chain.lengthToSourceM).toBeCloseTo(1, 6); // Batterie → Sicherungskasten
    expect(chain.reachedPorts.length).toBeGreaterThan(0);

    // Reihenfolge = Nähe zur betrachteten Leitung: erst das Knotenorgan im
    // Sicherungskasten (0 m), dann das Organ auf der Zuleitung (1 m).
    expect(chain.devices.map((entry) => entry.hostId)).toEqual(['fuse1', 'e-bat-fuse']);
    expect(chain.devices.map((entry) => entry.placement.host)).toEqual(['node', 'edge-data']);
    const upstream = chain.devices[1];
    expect(upstream?.label).toBe('Aufbaubatterie → Sicherungskasten');
    expect(upstream?.distanceFromStartM).toBeCloseTo(1, 6);
    expect(chain.devices[0]?.distanceFromStartM).toBeCloseTo(0, 6);
  });

  it('meldet eine unbekannte Weglänge als solche statt als 0 m', () => {
    const plan = healthyDcPlan();
    const patched: FixturePlan = {
      nodes: plan.nodes,
      edges: plan.edges.map((edge) =>
        edge.id === 'e-bat-fuse' ? { ...edge, data: { ...edge.data, length: undefined } } : edge
      ),
    };
    const context = contextOf(patched);
    const chain = upstreamChain(
      context.graph,
      buildPortGraph(context.graph),
      cableOf(context.graph, 'e-fuse-load')
    );

    expect(chain.lengthUnknown).toBe(true);
    expect(chain.lengthToSourceM).toBeNull();
    // Das Organ auf der unbekannt langen Leitung hat keinen Abstand — die
    // 0 m der Nachbarleitung bleibt davon unberührt.
    expect(chain.devices.find((entry) => entry.hostId === 'e-bat-fuse')?.distanceFromStartM).toBeNull();
    expect(chain.devices.find((entry) => entry.hostId === 'fuse1')?.distanceFromStartM).toBeCloseTo(0, 6);
  });

  it('zählt eine Parallelleitung nur einmal und sortiert bei Gleichstand stabil', () => {
    const context = contextOf(parallelFeedPlan());
    const chain = upstreamChain(
      context.graph,
      buildPortGraph(context.graph),
      cableOf(context.graph, 'e-fuse-load')
    );
    const hosts = chain.devices.map((entry) => entry.hostId);
    expect(hosts.slice().sort()).toEqual(['e-bat-fuse', 'e-bat-fuse-b', 'fuse1']);
    expect(hosts[0]).toBe('fuse1');
    // Der Knoten sitzt an der Leitung (0 m); die beiden Parallelleitungen
    // kommen bei gleichem Abstand über den ID-Tiebreaker in stabiler Ordnung.
    expect(chain.devices.map((entry) => entry.distanceFromStartM)).toEqual([0, 1, 1]);
  });

  it('führt Schutzorgane der Kette mit der Leitung selbst zusammen (nicht doppelt)', () => {
    const context = contextOf(healthyDcPlan());
    const cable = cableOf(context.graph, 'e-fuse-load');
    const chain = upstreamChain(context.graph, buildPortGraph(context.graph), cable);
    const together = protectionsOnCable(cable, chain);
    const ratings = together.map((placement) => placement.device.ratedCurrentA);
    expect(ratings).toEqual([10, 20, 20]); // nach Nennstrom sortiert: eigene 10 A zuerst
    expect(new Set(together.map((placement) => placement.hostId)).size).toBe(3);
  });

  it('wählt das eigene Organ vor dem vorgelagerten Knotenorgan', () => {
    const context = contextOf(parallelFeedPlan());
    const portGraph = buildPortGraph(context.graph);
    const cable = cableOf(context.graph, 'e-fuse-load');
    const chain = upstreamChain(context.graph, portGraph, cable);
    const device = effectiveOvercurrentDevice(cable, chain);
    expect(device?.hostId).toBe('e-fuse-load');
    expect(device?.device.ratedCurrentA).toBe(10);
  });

  it('fällt auf das nächstgelegene Knotenorgan zurück, wenn die Leitung selbst keines trägt', () => {
    const plan: FixturePlan = {
      nodes: [
        fixtureNode('bat1', 'battery', {
          label: 'Batterie',
          role: 'house',
          capacity: 200,
          chemistry: 'LiFePO4',
        }),
        fixtureNode('f1', 'fuse', { label: 'Hauptsicherung', rating: 40, fuseType: 'ato' }),
        fixtureNode('load1', 'consumer', { label: 'Kühlbox', watts: 100, hours: 4 }),
      ],
      edges: [
        fixtureEdge('e1', 'bat1', 'plus', 'f1', 'plus', { crossSection: 16, length: 0.2 }),
        fixtureEdge('e2', 'f1', 'plus', 'load1', 'plus', { crossSection: 4, length: 2 }),
      ],
    };
    const context = contextOf(plan);
    const cable = cableOf(context.graph, 'e2');
    const chain = upstreamChain(context.graph, buildPortGraph(context.graph), cable);
    expect(cable.protections).toEqual([]);
    const device = effectiveOvercurrentDevice(cable, chain);
    expect(device?.host).toBe('node');
    expect(device?.hostId).toBe('f1');
    expect(device?.device.ratedCurrentA).toBe(40);
  });

  it('nimmt das Knotenorgan hinter einer Quelle als Schutz der Folgeleitung', () => {
    const context = contextOf(healthyDcPlan());
    const stringLoaded: FixturePlan = {
      nodes: context.nodes.map((node) =>
        node.id === 'load1'
          ? fixtureNode('load1', 'consumer', { label: 'Kühlbox', watts: 100, hours: 4 })
          : node
      ),
      edges: context.edges.map((edge) =>
        edge.id === 'e-fuse-load'
          ? { ...edge, data: { ...edge.data, fuseSize: undefined, fuseType: undefined } }
          : edge
      ),
    };
    const patched = contextOf(stringLoaded);
    const cable = cableOf(patched.graph, 'e-fuse-load');
    const chain = upstreamChain(patched.graph, buildPortGraph(patched.graph), cable);
    const device = effectiveOvercurrentDevice(cable, chain);
    expect(device?.host).toBe('node');
    expect(device?.hostId).toBe('fuse1');
    expect(device?.device.ratedCurrentA).toBe(20);
  });

  it('nimmt ein vorgelagertes Kantenorgan NICHT als Schutz der nachgelagerten Leitung', () => {
    // Hinter einer Sammelschiene (passiv) liegt nur das Kantenorgan der
    // Zuleitung: Es schützt seinen eigenen Abschnitt, die Folgeleitung bleibt
    // ohne wirksames Organ — der Befund kommt aus AMP-001.
    const plan: FixturePlan = {
      nodes: [
        fixtureNode('bat1', 'battery', {
          label: 'Batterie',
          role: 'house',
          capacity: 200,
          chemistry: 'LiFePO4',
        }),
        fixtureNode('b1', 'busbar', { label: 'Schiene' }),
        fixtureNode('load1', 'consumer', { label: 'Kühlbox', watts: 100, hours: 4 }),
      ],
      edges: [
        fixtureEdge('e1', 'bat1', 'plus', 'b1', 'plus', {
          crossSection: 16,
          length: 1,
          fuseSize: 20,
          fuseType: 'ato',
        }),
        fixtureEdge('e2', 'b1', 'plus', 'load1', 'plus', { crossSection: 4, length: 2 }),
      ],
    };
    const context = contextOf(plan);
    const cable = cableOf(context.graph, 'e2');
    const chain = upstreamChain(context.graph, buildPortGraph(context.graph), cable);
    expect(chain.devices.map((entry) => entry.placement.host)).toEqual(['edge-data']);
    expect(chain.devices.map((entry) => entry.hostId)).toEqual(['e1']);
    expect(effectiveOvercurrentDevice(cable, chain)).toBeNull();
    expect(effectiveOvercurrentDevice(cable)).toBeNull();
  });

  it('erkennt Quellen am Knoten und hält die Kantenliste deterministisch', () => {
    const context = contextOf(healthyDcPlan());
    expect(isSourceNode(context.graph, 'bat1')).toBe(true);
    expect(isSourceNode(context.graph, 'load1')).toBe(false);
    expect(isSourceNode(context.graph, 'gibt-es-nicht')).toBe(false);

    const ids = sortedCables(context.graph).map((cable) => cable.edgeId);
    expect(ids).toEqual([...ids].sort());
    expect(ids).toContain('e-bond');
    expect(sortedPorts(new Set([{ key: 'b::x' }, { key: 'a::y' }, { key: 'a::x' }]))).toEqual([
      'a::x',
      'a::y',
      'b::x',
    ]);
  });

  it('überquert den Wechselrichter-Ausgang nicht — dort endet die DC-Suche', () => {
    const context = contextOf(islandPlan());
    const cable = cableOf(context.graph, 'e-inv-load-a');
    const chain = upstreamChain(context.graph, buildPortGraph(context.graph), cable);
    // Die Wechselrichter-Ausgänge sind kein DC-Zweig: keine Quelle erreichbar,
    // also bleibt das eigene Organ der Leitung das wirksame.
    expect(chain.sourceNodeIds).toEqual([]);
    expect(chain.devices).toEqual([]);
    expect(chain.lengthToSourceM).toBe(0);
    expect(effectiveOvercurrentDevice(cable, chain)?.hostId).toBe('e-inv-load-a');
  });

  it('bleibt am Massezweig ohne Organ stehen und liefert die Knotennachbarn', () => {
    const context = contextOf(healthyDcPlan());
    const chain = upstreamChain(
      context.graph,
      buildPortGraph(context.graph),
      cableOf(context.graph, 'e-bond')
    );
    expect(chain.sourceNodeIds).toEqual(['bat1']);
    expect(chain.devices).toEqual([]);
    expect(effectiveOvercurrentDevice(cableOf(context.graph, 'e-bond'), chain)).toBeNull();
    expect(neighborsOf(context.graph, 'shunt1').sort()).toEqual(['bat1', 'load1']);
  });
});
