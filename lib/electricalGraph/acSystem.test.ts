import { describe, expect, it } from 'vitest';
import { acEndpointRole, buildAcSystem, resolveAcSourceForLoad } from './acSystem';
import type { Edge, Node } from '../domain/graph';
import {
  AC_BATTERY_CHARGER_AC_TARGET_HANDLES,
  INVERTER_AC_SOURCE_HANDLES,
  INVERTER_AC_TARGET_HANDLES,
} from '../domain/handleDomains';

const node = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label: id, ...data },
});

const acEdge = (id: string, source: string, target: string, handles?: Partial<Edge>): Edge => ({
  id,
  source,
  target,
  sourceHandle: 'plus',
  targetHandle: 'plus',
  data: { edgeDomain: 'AC_230V' },
  ...handles,
});

describe('V2-AC — mehrere Quellen, Kreise und Verbraucher', () => {
  describe('acEndpointRole — Rollen kommen aus der Handle-Tabelle', () => {
    it('Landstrom speist immer ein, 230-V-Verbraucher verbrauchen immer', () => {
      expect(acEndpointRole('shorePower', 'plus', 'source')).toBe('emit');
      expect(acEndpointRole('consumer230v', 'plus', 'target')).toBe('consume');
    });

    it('der Wechselrichter ist an seinem Eingang Verbraucher und am Ausgang Quelle', () => {
      for (const handle of INVERTER_AC_TARGET_HANDLES) {
        expect(acEndpointRole('inverter', handle, 'target')).toBe('consume');
      }
      for (const handle of INVERTER_AC_SOURCE_HANDLES) {
        expect(acEndpointRole('inverter', handle, 'source')).toBe('emit');
      }
      expect(acEndpointRole('inverter', 'minus', 'source')).toBe('pass');
    });

    it('AC-Ladegerät verbraucht nur an seinem AC-Eingang', () => {
      for (const handle of AC_BATTERY_CHARGER_AC_TARGET_HANDLES) {
        expect(acEndpointRole('acBatteryCharger', handle, 'target')).toBe('consume');
      }
      expect(acEndpointRole('acBatteryCharger', 'plus', 'source')).toBe('pass');
    });

    it('alles andere leitet nur durch', () => {
      expect(acEndpointRole('busbar', 'plus', 'source')).toBe('pass');
      expect(acEndpointRole(undefined, null, 'source')).toBe('pass');
    });
  });

  it('erkennt Quellen und Lasten eines Plans', () => {
    const model = buildAcSystem(
      [
        node('shore', 'shorePower'),
        node('inv', 'inverter'),
        node('tv', 'consumer230v'),
        node('lader', 'acBatteryCharger'),
        node('batt', 'battery'),
      ],
      []
    );
    expect(model.sources.map((source) => source.id)).toEqual(['inv', 'shore']);
    expect(model.sources.find((source) => source.id === 'inv')?.kind).toBe('inverter');
    expect(model.loads.map((load) => load.id)).toEqual(['inv', 'lader', 'tv']);
  });

  // Der Kern des Befundes: Landstrom → Wechselrichter → Steckdose ist NICHT
  // ein Kreis mit zwei Quellen, sondern zwei Kreise.
  it('trennt Eingangs- und Ausgangskreis des Wechselrichters', () => {
    const model = buildAcSystem(
      [node('shore', 'shorePower'), node('inv', 'inverter'), node('tv', 'consumer230v')],
      [
        acEdge('e1', 'shore', 'inv', { targetHandle: 'ac_in' }),
        acEdge('e2', 'inv', 'tv', { sourceHandle: 'plus' }),
      ]
    );
    expect(model.circuits.map((circuit) => circuit.id)).toEqual(['ac:inv', 'ac:shore']);
    expect(model.circuits.find((c) => c.id === 'ac:shore')?.loadIds).toEqual(['inv']);
    expect(model.circuits.find((c) => c.id === 'ac:inv')?.loadIds).toEqual(['tv']);
    expect(model.sourceOfLoad.get('tv')).toBe('inv');
    expect(model.sourceOfLoad.get('inv')).toBe('shore');
    expect(model.conflicts).toEqual([]);
  });

  it('zwei Quellen auf einem Verbraucher sind ein Konflikt, keine Zuordnung', () => {
    const model = buildAcSystem(
      [node('shore', 'shorePower'), node('inv', 'inverter'), node('tv', 'consumer230v')],
      [acEdge('e1', 'shore', 'tv'), acEdge('e2', 'inv', 'tv')]
    );
    expect(model.sourceOfLoad.get('tv')).toBeNull();
    const conflict = model.conflicts.find((entry) => entry.loadId === 'tv');
    expect(conflict?.kind).toBe('multiple-sources');
    expect(conflict?.sourceIds).toEqual(['inv', 'shore']);
    expect(resolveAcSourceForLoad('tv', model)).toBeUndefined();
  });

  it('ausdrückliche Zuordnung (acSourceId) löst den Konflikt auf', () => {
    const model = buildAcSystem(
      [
        node('shore', 'shorePower'),
        node('inv', 'inverter'),
        node('tv', 'consumer230v', { acSourceId: 'inv' }),
      ],
      [acEdge('e1', 'shore', 'tv'), acEdge('e2', 'inv', 'tv')]
    );
    expect(model.sourceOfLoad.get('tv')).toBe('inv');
    expect(resolveAcSourceForLoad('tv', model)).toBe('inv');
    expect(model.conflicts.some((entry) => entry.loadId === 'tv')).toBe(false);
  });

  it('eine Zuordnung auf eine nicht existierende Quelle wird gemeldet, nicht ignoriert', () => {
    const model = buildAcSystem(
      [node('shore', 'shorePower'), node('tv', 'consumer230v', { acSourceId: 'gibt-es-nicht' })],
      [acEdge('e1', 'shore', 'tv')]
    );
    expect(model.conflicts[0]?.kind).toBe('unknown-source-reference');
    expect(model.sourceOfLoad.get('tv')).toBeNull();
    // Ein falscher Verweis wird NICHT durch die einzige Quelle „repariert".
    expect(resolveAcSourceForLoad('tv', model)).toBeUndefined();
  });

  it('ein unverbundener 230-V-Verbraucher ist ein Befund', () => {
    const model = buildAcSystem([node('shore', 'shorePower'), node('tv', 'consumer230v')], []);
    expect(model.conflicts.find((entry) => entry.loadId === 'tv')?.kind).toBe('no-source');
    // „Noch nicht verdrahtet" ist kein Zuordnungskonflikt: Bei genau EINER
    // Quelle im Plan ist die Zuordnung eindeutig — AutoWire darf verbinden.
    expect(resolveAcSourceForLoad('tv', model)).toBe('shore');
  });

  it('ein Wechselrichter ohne Landstrom ist der Normalfall, kein Konflikt', () => {
    const model = buildAcSystem(
      [node('inv', 'inverter'), node('tv', 'consumer230v')],
      [acEdge('e1', 'inv', 'tv')]
    );
    expect(model.conflicts).toEqual([]);
    expect(model.sourceOfLoad.get('tv')).toBe('inv');
  });

  it('Verteiler (FI, Sicherung) gehören zum Kreis, nicht zu den Lasten', () => {
    const model = buildAcSystem(
      [node('shore', 'shorePower'), node('fi', 'fuse'), node('tv', 'consumer230v')],
      [acEdge('e1', 'shore', 'fi'), acEdge('e2', 'fi', 'tv')]
    );
    const circuit = model.circuits[0]!;
    expect(circuit.distributionIds).toEqual(['fi']);
    expect(circuit.loadIds).toEqual(['tv']);
  });

  it('DC-Kanten gehören nicht ins AC-Modell', () => {
    const model = buildAcSystem(
      [node('inv', 'inverter'), node('busbar', 'busbar'), node('tv', 'consumer230v')],
      [{ ...acEdge('e1', 'busbar', 'inv'), data: { edgeDomain: 'DC_12V' } }]
    );
    expect(model.circuits.find((c) => c.id === 'ac:inv')?.loadIds).toEqual([]);
  });

  it('erkennt AC-Kanten ohne gespeicherte Domäne an den Handles', () => {
    const model = buildAcSystem(
      [node('shore', 'shorePower'), node('tv', 'consumer230v')],
      [{ id: 'e1', source: 'shore', target: 'tv', sourceHandle: 'plus', targetHandle: 'plus' }]
    );
    expect(model.sourceOfLoad.get('tv')).toBe('shore');
  });

  it('resolveAcSourceForLoad entscheidet nur, wenn es eindeutig ist', () => {
    const single = buildAcSystem([node('inv', 'inverter'), node('neu', 'consumer230v')], []);
    // Genau eine Quelle im Plan ⇒ eindeutig, auch ohne Verdrahtung.
    expect(resolveAcSourceForLoad('neu', single)).toBe('inv');

    const many = buildAcSystem(
      [node('inv', 'inverter'), node('shore', 'shorePower'), node('neu', 'consumer230v')],
      []
    );
    expect(resolveAcSourceForLoad('neu', many)).toBeUndefined();
  });

  it('ist reihenfolgeunabhängig (Determinismus)', () => {
    const nodes = [node('shore', 'shorePower'), node('inv', 'inverter'), node('tv', 'consumer230v')];
    const edges = [acEdge('e1', 'shore', 'inv', { targetHandle: 'ac_in' }), acEdge('e2', 'inv', 'tv')];
    const forward = buildAcSystem(nodes, edges);
    const backward = buildAcSystem([...nodes].reverse(), [...edges].reverse());
    expect(JSON.stringify(backward.circuits)).toBe(JSON.stringify(forward.circuits));
    expect(JSON.stringify(backward.sources)).toBe(JSON.stringify(forward.sources));
    expect([...backward.sourceOfLoad.entries()].sort()).toEqual([...forward.sourceOfLoad.entries()].sort());
  });
});
