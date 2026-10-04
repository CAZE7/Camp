import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  buildElectricalGraph,
  computeCurrentBudget,
  deriveBatteryBanks,
  edgeIntentOf,
  electricalGraphHash,
  mayOverride,
  resolveComponentConstraints,
  systemVoltageOf,
  type EdgeIntent,
} from './index';
import type { Edge, Node } from '../domain/graph';
import { amps, volts } from '../units';

/**
 * lib/electricalGraph/properties.test.ts — GESETZE der elektrischen Ebene.
 *
 * Beispieltests zeigen Punkte, Property-Tests zeigen Regeln. Die hier
 * geprüften Gesetze sind genau die Zusagen aus `docs/electrical-graph.md`:
 *
 *  E1  Geometrie-Unabhängigkeit: Verschieben ändert den elektrischen Hash nie.
 *  E2  Reihenfolge-Unabhängigkeit: Knoten-/Kantenreihenfolge ändert nichts.
 *  E3  Determinismus: zweimal bauen ⇒ identisches Ergebnis.
 *  E4  Kein Raten: ohne erklärte Bank wird nie summiert.
 *  E5  Budget-Monotonie: eine zusätzliche Grenze kann das Budget nur senken.
 *  E6  Absicht: `mayOverride` ist strikt und azyklisch.
 *
 * Seed und Laufzahl sind fest — ein Gegenbeispiel ist reproduzierbar
 * (gleiche Konvention wie `lib/vde-properties.test.ts`).
 */

const RUNS = 300;
const SEED = 20261004;
const config = { numRuns: RUNS, seed: SEED, verbose: false } as const;

const NODE_TYPES = [
  'battery',
  'busbar',
  'shunt',
  'fuse',
  'consumer',
  'consumer230v',
  'inverter',
  'shorePower',
  'solar',
  'mpptController',
  'acBatteryCharger',
  'ground',
] as const;

const INTENTS: readonly EdgeIntent[] = ['locked', 'user', 'required', 'auto', 'suggested'];

const arbNode = fc
  .record({
    index: fc.integer({ min: 0, max: 40 }),
    type: fc.constantFrom(...NODE_TYPES),
    x: fc.integer({ min: -2000, max: 2000 }),
    y: fc.integer({ min: -2000, max: 2000 }),
    capacity: fc.integer({ min: 0, max: 400 }),
    nominalVoltage: fc.constantFrom(12, 12.8, 24, 25.6, 48, 51.2),
    chemistry: fc.constantFrom('LiFePO4', 'AGM', 'Gel'),
    bms: fc.option(fc.integer({ min: 1, max: 300 }), { nil: undefined }),
  })
  .map(({ index, type, x, y, capacity, nominalVoltage, chemistry, bms }): Node => ({
    id: `n${index}`,
    type,
    position: { x, y },
    data: {
      label: `${type}-${index}`,
      capacity,
      nominalVoltage,
      chemistry,
      ...(bms === undefined ? {} : { bmsContinuousDischarge: bms }),
    },
  }));

const arbPlan = fc
  .array(arbNode, { minLength: 1, maxLength: 12 })
  .map((nodes) => {
    // IDs eindeutig machen, ohne die Generatorstruktur zu verlieren.
    const unique = new Map<string, Node>();
    nodes.forEach((node, index) => unique.set(`${node.id}-${index}`, { ...node, id: `${node.id}-${index}` }));
    return [...unique.values()];
  })
  .chain((nodes) =>
    fc
      .array(
        fc.record({
          from: fc.integer({ min: 0, max: nodes.length - 1 }),
          to: fc.integer({ min: 0, max: nodes.length - 1 }),
          handle: fc.constantFrom('plus', 'minus'),
          intent: fc.option(fc.constantFrom(...INTENTS), { nil: undefined }),
        }),
        { maxLength: 16 }
      )
      .map((links) => {
        const edges: Edge[] = links
          .filter((link) => link.from !== link.to)
          .map((link, index) => ({
            id: `e${index}`,
            source: nodes[link.from]!.id,
            target: nodes[link.to]!.id,
            sourceHandle: link.handle,
            targetHandle: link.handle,
            data: link.intent === undefined ? {} : { intent: link.intent },
          }));
        return { nodes, edges };
      })
  );

describe('V2-PROPERTIES — Gesetze der elektrischen Ebene', () => {
  it('E1 — Verschieben von Bauteilen ändert den elektrischen Hash NIE', () => {
    fc.assert(
      fc.property(arbPlan, fc.integer({ min: -5000, max: 5000 }), ({ nodes, edges }, shift) => {
        const before = electricalGraphHash(buildElectricalGraph(nodes, edges));
        const moved = nodes.map((node) => ({
          ...node,
          position: { x: node.position.x + shift, y: node.position.y - shift },
          width: 240,
          height: 120,
          measured: { width: 240, height: 120 },
        }));
        expect(electricalGraphHash(buildElectricalGraph(moved, edges))).toBe(before);
      }),
      config
    );
  });

  it('E2 — die Reihenfolge von Knoten und Kanten ändert nichts', () => {
    fc.assert(
      fc.property(arbPlan, ({ nodes, edges }) => {
        const forward = buildElectricalGraph(nodes, edges);
        const backward = buildElectricalGraph([...nodes].reverse(), [...edges].reverse());
        expect(electricalGraphHash(backward)).toBe(electricalGraphHash(forward));
        expect(backward.nodes.map((n) => n.id)).toEqual(forward.nodes.map((n) => n.id));
        expect(backward.circuits.map((c) => c.id)).toEqual(forward.circuits.map((c) => c.id));
        expect(backward.questions.map((q) => q.id)).toEqual(forward.questions.map((q) => q.id));
      }),
      config
    );
  });

  it('E3 — zweimal bauen ergibt denselben Graphen (Determinismus)', () => {
    fc.assert(
      fc.property(arbPlan, ({ nodes, edges }) => {
        const first = buildElectricalGraph(nodes, edges);
        const second = buildElectricalGraph(nodes, edges);
        expect(JSON.stringify(second.circuits)).toBe(JSON.stringify(first.circuits));
        expect(JSON.stringify(second.batteryBanks)).toBe(JSON.stringify(first.batteryBanks));
        expect(systemVoltageOf(second)).toBe(systemVoltageOf(first));
      }),
      config
    );
  });

  it('E4 — ohne erklärte Bank wird NIE summiert', () => {
    fc.assert(
      fc.property(arbPlan, ({ nodes }) => {
        const model = deriveBatteryBanks(nodes, volts(12.8));
        for (const bank of model.banks) {
          if (bank.declared) continue;
          // Nicht erklärt ⇒ höchstens eine Batterie trägt die Kennwerte.
          const capacities = bank.batteryIds
            .map((id) => nodes.find((node) => node.id === id))
            .map((node) => Number((node?.data as { capacity?: unknown })?.capacity) || 0);
          const maxSingle = capacities.length > 0 ? Math.max(...capacities) : 0;
          expect(bank.capacityAh).toBeLessThanOrEqual(maxSingle);
        }
      }),
      config
    );
  });

  it('E4b — jede Batterie liegt in genau einer Bank', () => {
    fc.assert(
      fc.property(arbPlan, ({ nodes }) => {
        const batteries = nodes.filter((node) => node.type === 'battery').map((node) => node.id);
        const model = deriveBatteryBanks(nodes, volts(12.8));
        const assigned = model.banks.flatMap((bank) => bank.batteryIds);
        expect([...assigned].sort()).toEqual([...batteries].sort());
        expect(new Set(assigned).size).toBe(assigned.length);
      }),
      config
    );
  });

  it('E5 — eine zusätzliche Grenze kann das Budget nur senken, nie heben', () => {
    const arbLimit = fc.option(fc.integer({ min: 1, max: 600 }), { nil: undefined });
    fc.assert(
      fc.property(
        arbLimit,
        arbLimit,
        arbLimit,
        fc.integer({ min: 1, max: 600 }),
        (bms, fuse, cable, extra) => {
          const base = computeCurrentBudget({
            ...(bms === undefined ? {} : { bms: amps(bms) }),
            ...(fuse === undefined ? {} : { fuse: amps(fuse) }),
            ...(cable === undefined ? {} : { cable: amps(cable) }),
          });
          const tightened = computeCurrentBudget({
            ...(bms === undefined ? {} : { bms: amps(bms) }),
            ...(fuse === undefined ? {} : { fuse: amps(fuse) }),
            ...(cable === undefined ? {} : { cable: amps(cable) }),
            component: amps(extra),
          });
          expect(tightened.allowedCurrent).toBeDefined();
          if (base.allowedCurrent !== undefined) {
            expect(tightened.allowedCurrent!).toBeLessThanOrEqual(base.allowedCurrent);
          }
        }
      ),
      config
    );
  });

  it('E6 — mayOverride ist strikt (nie reflexiv, nie beidseitig)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...INTENTS), fc.constantFrom(...INTENTS), (left, right) => {
        expect(mayOverride(left, left)).toBe(false);
        expect(mayOverride(left, right) && mayOverride(right, left)).toBe(false);
      }),
      config
    );
  });

  it('E7 — jede Verbindung trägt genau eine gültige Absicht', () => {
    fc.assert(
      fc.property(arbPlan, ({ nodes, edges }) => {
        const graph = buildElectricalGraph(nodes, edges);
        for (const connection of graph.connections) {
          expect(INTENTS).toContain(connection.intent);
          const source = edges.find((edge) => edge.id === connection.id)!;
          expect(connection.intent).toBe(
            edgeIntentOf(source as { id: string; data?: Record<string, unknown> })
          );
        }
      }),
      config
    );
  });

  it('E8 — Bauteilgrenzen sind rein: gleiche Daten, gleiches Ergebnis', () => {
    fc.assert(
      fc.property(arbNode, (node) => {
        const once = resolveComponentConstraints({ type: node.type, data: node.data });
        const twice = resolveComponentConstraints({ type: node.type, data: node.data });
        expect(twice).toEqual(once);
        for (const value of Object.values(once)) {
          if (typeof value === 'number') expect(value).toBeGreaterThan(0);
        }
      }),
      config
    );
  });
});
