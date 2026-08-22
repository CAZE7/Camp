/**
 * Additional tests for usePlannerStore covering unique functions
 * that are NOT covered by store/usePlannerStore.test.ts:
 *   - onLayout
 *   - handleChangeLength / handleChangeFuseSize
 *   - setWaterNodes / setWaterEdges (array + function updater)
 *   - onWaterNodesChange / onWaterEdgesChange
 *   - setWaterWarning
 *   - getDerivedSystemState (direct export, smoke tests)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { usePlannerStore, getDerivedSystemState } from './usePlannerStore';
import { TEMPLATE_MINIMALIST } from '../components/planner/templates';
import * as layoutUtils from '../components/planner/utils/layout';
import type { Node, Edge } from 'reactflow';
import { CableEdgeData } from '../components/edges/CableEdge';

vi.mock('../components/planner/utils/layout', () => ({
  getLayoutedElements: vi.fn((nodes, edges) => ({
    nodes: nodes.map((n: Node) => ({ ...n, position: { x: n.position.x + 10, y: n.position.y + 20 } })),
    edges,
  })),
}));

describe('usePlannerStore - extended coverage', () => {
  let originalRandomUUID: typeof crypto.randomUUID;
  let idCounter: number;

  beforeEach(() => {
    usePlannerStore.setState({
      viewMode: 'electric',
      nodes: TEMPLATE_MINIMALIST.nodes,
      edges: TEMPLATE_MINIMALIST.edges,
      waterNodes: [],
      waterEdges: [],
      season: 'summer',
      waterWarning: null,
      firstTappedHandle: null,
      selectedNodes: [],
      selectedEdges: [],
    });

    originalRandomUUID = crypto.randomUUID;
    idCounter = 0;
    crypto.randomUUID = vi.fn(() => `uuid-${idCounter++}`) as typeof crypto.randomUUID;

    vi.clearAllMocks();
  });

  afterEach(() => {
    crypto.randomUUID = originalRandomUUID;
    vi.restoreAllMocks();
  });

  describe('onLayout', () => {
    it('should call getLayoutedElements with current nodes/edges and update positions', () => {
      const node: Node = { id: 'n1', type: 'battery', position: { x: 0, y: 0 }, data: {} };
      usePlannerStore.setState({ nodes: [node], edges: [] });

      act(() => {
        usePlannerStore.getState().onLayout();
      });

      expect(layoutUtils.getLayoutedElements).toHaveBeenCalled();
      const args = vi.mocked(layoutUtils.getLayoutedElements).mock.calls[0];
      expect(Array.isArray(args[0])).toBe(true);
      expect(Array.isArray(args[1])).toBe(true);
      expect(usePlannerStore.getState().nodes[0].position).toEqual({ x: 10, y: 20 });
    });

    it('layouts water nodes when viewMode is water', () => {
      const node: Node = { id: 'w1', type: 'freshWaterTank', position: { x: 0, y: 0 }, data: {} };
      usePlannerStore.setState({ viewMode: 'water', waterNodes: [node], waterEdges: [], nodes: [], edges: [] });

      act(() => {
        usePlannerStore.getState().onLayout();
      });

      expect(layoutUtils.getLayoutedElements).toHaveBeenCalled();
      const args = vi.mocked(layoutUtils.getLayoutedElements).mock.calls[0];
      expect(args[0]).toEqual([node]);
      expect(usePlannerStore.getState().waterNodes[0].position).toEqual({ x: 10, y: 20 });
      expect(usePlannerStore.getState().nodes).toEqual([]);
    });

    it('should dispatch planner-fit-view via requestAnimationFrame', () => {
      const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0);
        return 0;
      });
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      act(() => {
        usePlannerStore.getState().onLayout();
      });

      expect(raf).toHaveBeenCalled();
      const fitEvents = dispatchSpy.mock.calls
        .map(c => c[0] as Event)
        .filter(e => e.type === 'planner-fit-view');
      expect(fitEvents.length).toBeGreaterThanOrEqual(1);

      raf.mockRestore();
      dispatchSpy.mockRestore();
    });
  });

  describe('handleChangeLength', () => {
    it('should update the length field on the matching edge and preserve other data', () => {
      const edge: Edge<CableEdgeData> = {
        id: 'e1',
        source: 'a',
        target: 'b',
        data: { length: 3, crossSection: 2.5 },
      };
      usePlannerStore.setState({ edges: [edge] });

      usePlannerStore.getState().handleChangeLength('e1', 7.5);

      const updated = usePlannerStore.getState().edges[0];
      expect(updated.id).toBe('e1');
      expect(updated.data?.length).toBe(7.5);
      expect(updated.data?.crossSection).toBe(2.5);
    });

    it('should not change other edges when updating one', () => {
      const e1: Edge<CableEdgeData> = { id: 'e1', source: 'a', target: 'b', data: { length: 3, crossSection: 2.5 } };
      const e2: Edge<CableEdgeData> = { id: 'e2', source: 'c', target: 'd', data: { length: 5, crossSection: 4 } };
      usePlannerStore.setState({ edges: [e1, e2] });

      usePlannerStore.getState().handleChangeLength('e1', 9);

      const state = usePlannerStore.getState();
      expect(state.edges.find(e => e.id === 'e1')?.data?.length).toBe(9);
      expect(state.edges.find(e => e.id === 'e2')?.data?.length).toBe(5);
    });
  });

  describe('handleChangeFuseSize', () => {
    it('should update the fuseSize field on the matching edge', () => {
      const edge: Edge<CableEdgeData> = {
        id: 'e1',
        source: 'a',
        target: 'b',
        data: { length: 3, crossSection: 2.5, fuseSize: 16 },
      };
      usePlannerStore.setState({ edges: [edge] });

      usePlannerStore.getState().handleChangeFuseSize('e1', 25);

      expect(usePlannerStore.getState().edges[0].data?.fuseSize).toBe(25);
      expect(usePlannerStore.getState().edges[0].data?.length).toBe(3);
      expect(usePlannerStore.getState().edges[0].data?.crossSection).toBe(2.5);
    });

    it('should not touch other edges when updating one', () => {
      const e1: Edge<CableEdgeData> = { id: 'e1', source: 'a', target: 'b', data: { length: 3, crossSection: 2.5 } };
      const e2: Edge<CableEdgeData> = { id: 'e2', source: 'c', target: 'd', data: { length: 5, crossSection: 4, fuseSize: 30 } };
      usePlannerStore.setState({ edges: [e1, e2] });

      usePlannerStore.getState().handleChangeFuseSize('e2', 20);

      const state = usePlannerStore.getState();
      expect(state.edges.find(e => e.id === 'e1')?.data?.fuseSize).toBeUndefined();
      expect(state.edges.find(e => e.id === 'e2')?.data?.fuseSize).toBe(20);
    });

    it('should be a no-op if no edge matches the id', () => {
      const edge: Edge<CableEdgeData> = { id: 'e1', source: 'a', target: 'b', data: { length: 3, crossSection: 2.5, fuseSize: 16 } };
      usePlannerStore.setState({ edges: [edge] });

      usePlannerStore.getState().handleChangeFuseSize('nonexistent', 40);

      expect(usePlannerStore.getState().edges[0].data?.fuseSize).toBe(16);
    });
  });

  describe('water helpers', () => {
    it('setWaterNodes should replace waterNodes via a direct array', () => {
      const node: Node = { id: 'w1', type: 'pump', position: { x: 0, y: 0 }, data: {} };
      act(() => {
        usePlannerStore.getState().setWaterNodes([node]);
      });
      expect(usePlannerStore.getState().waterNodes).toEqual([node]);
    });

    it('setWaterNodes should support a function updater', () => {
      const n1: Node = { id: 'w1', type: 'pump', position: { x: 0, y: 0 }, data: {} };
      const n2: Node = { id: 'w2', type: 'sink', position: { x: 1, y: 1 }, data: {} };
      usePlannerStore.setState({ waterNodes: [n1] });

      act(() => {
        usePlannerStore.getState().setWaterNodes((prev) => [...prev, n2]);
      });

      expect(usePlannerStore.getState().waterNodes).toEqual([n1, n2]);
    });

    it('setWaterEdges should replace waterEdges via a direct array', () => {
      const edge: Edge = { id: 'we1', source: 'w1', target: 'w2', type: 'waterPipe' };
      act(() => {
        usePlannerStore.getState().setWaterEdges([edge]);
      });
      expect(usePlannerStore.getState().waterEdges).toEqual([edge]);
    });

    it('setWaterEdges should support a function updater', () => {
      const e1: Edge = { id: 'we1', source: 'w1', target: 'w2', type: 'waterPipe' };
      const e2: Edge = { id: 'we2', source: 'w2', target: 'w3', type: 'waterPipe' };
      usePlannerStore.setState({ waterEdges: [e1] });

      act(() => {
        usePlannerStore.getState().setWaterEdges((prev) => [...prev, e2]);
      });

      expect(usePlannerStore.getState().waterEdges).toEqual([e1, e2]);
    });

    it('setWaterWarning should set and clear the warning', () => {
      act(() => {
        usePlannerStore.getState().setWaterWarning('Achtung');
      });
      expect(usePlannerStore.getState().waterWarning).toBe('Achtung');

      act(() => {
        usePlannerStore.getState().setWaterWarning(null);
      });
      expect(usePlannerStore.getState().waterWarning).toBeNull();
    });

    it('onWaterNodesChange should apply changes to waterNodes', () => {
      const n1: Node = { id: 'w1', type: 'pump', position: { x: 0, y: 0 }, data: {} };
      usePlannerStore.setState({ waterNodes: [n1] });

      act(() => {
        usePlannerStore.getState().onWaterNodesChange([
          { type: 'remove', id: 'w1' },
        ]);
      });

      expect(usePlannerStore.getState().waterNodes).toEqual([]);
    });

    it('onWaterEdgesChange should apply changes to waterEdges', () => {
      const e1: Edge = { id: 'we1', source: 'w1', target: 'w2', type: 'waterPipe' };
      usePlannerStore.setState({ waterEdges: [e1] });

      act(() => {
        usePlannerStore.getState().onWaterEdgesChange([
          { type: 'remove', id: 'we1' },
        ]);
      });

      expect(usePlannerStore.getState().waterEdges).toEqual([]);
    });
  });

  describe('getDerivedSystemState', () => {
    it('returns nodesMap, waterNodesMap and totalWatts for a mixed graph', () => {
      const nodes: Node[] = [
        { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { capacity: 100 } },
        { id: 'c1', type: 'consumer', position: { x: 1, y: 0 }, data: { watts: 60 } },
        { id: 'i1', type: 'inverter', position: { x: 2, y: 0 }, data: { watts: 300 } },
        { id: 'a1', type: 'consumer230v', position: { x: 3, y: 0 }, data: { watts: 40 } },
      ];
      const waterNodes: Node[] = [
        { id: 'w1', type: 'pump', position: { x: 0, y: 0 }, data: {} },
      ];

      const derived = getDerivedSystemState(nodes, waterNodes);

      expect(derived.nodesMap.get('b1')?.type).toBe('battery');
      expect(derived.nodesMap.get('c1')?.data.watts).toBe(60);
      expect(derived.waterNodesMap.get('w1')?.type).toBe('pump');
      expect(derived.totalWatts).toBe(400);
    });

    it('caches maps/watts for the same array reference (WeakMap smoke test)', () => {
      const nodes: Node[] = [
        { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 12 } },
      ];
      const water: Node[] = [];

      const first = getDerivedSystemState(nodes, water);
      const second = getDerivedSystemState(nodes, water);

      expect(first.nodesMap).toBe(second.nodesMap);
      expect(first.waterNodesMap).toBe(second.waterNodesMap);
      expect(first.totalWatts).toBe(second.totalWatts);
      expect(first.totalWatts).toBe(12);
    });

    it('recomputes when a new nodes array is passed', () => {
      const nodesA: Node[] = [
        { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 10 } },
      ];
      const nodesB: Node[] = [
        { id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 10 } },
        { id: 'c2', type: 'consumer', position: { x: 1, y: 0 }, data: { watts: 25 } },
      ];

      const a = getDerivedSystemState(nodesA, []);
      const b = getDerivedSystemState(nodesB, []);

      expect(a.totalWatts).toBe(10);
      expect(b.totalWatts).toBe(35);
      expect(a.nodesMap).not.toBe(b.nodesMap);
    });
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * Auto-Wire Regression-Szenarien
 *
 * Ziel: Nach `autoWireSystem()` gilt für jede plausible Komponenten-Kombination
 * „null Warnungen" — geprüft mit den exakt gleichen Regeln, die die App nutzt:
 *   1. useLiveValidation (6 Regeln: Quellschutz, MPPT, Batterie, Inverter,
 *      DC-DC-Vollständigkeit, Shunt-Bypass)
 *   2. collectEdgeErrors — die echte Kanten-Logik aus CableEdge.tsx
 *      (Sicherung zu klein/zu groß/fehlt, Gesamt-Drop, 20-cm-Hauptsicherung)
 * ──────────────────────────────────────────────────────────────────────────── */
import { renderHook } from '@testing-library/react';
import { useLiveValidation } from '../components/planner/hooks/useLiveValidation';
import { calculateEdgeCurrent, getSystemVoltage } from '../lib/vde-standards';
import { FUSE_MAP, STANDARD_FUSE_SIZES, calculateCrossSection, calculateMaxFuse } from '../lib/electrical';
import { collectEdgeErrors } from '../components/edges/CableEdge';
import { TEMPLATE_ALLROUNDER, TEMPLATE_AUTARK } from '../components/planner/templates';

function makeNode(id: string, type: string, data: Record<string, unknown> = {}): Node {
  return { id, type, position: { x: 0, y: 0 }, data };
}

function runAutoWire(nodes: Node[], extra?: Partial<{ season: 'summer' | 'winter'; userEdges: Edge[] }>) {
  usePlannerStore.setState({
    viewMode: 'electric',
    nodes,
    edges: extra?.userEdges || [],
    waterNodes: [],
    waterEdges: [],
    season: extra?.season || 'summer',
    waterWarning: null,
    firstTappedHandle: null,
    selectedNodes: [],
    selectedEdges: [],
  });
  act(() => {
    usePlannerStore.getState().autoWireSystem();
  });
  const state = usePlannerStore.getState();
  return { nodes: state.nodes, edges: state.edges as Edge<CableEdgeData>[], season: state.season };
}

/**
 * Spiegelt die Kanten-Prüfung aus CableEdge.tsx mit denselben Bibliotheks-
 * Funktionen — so testen die Szenarien exakt das, was der Nutzer sieht.
 */
function getEdgeErrors(nodes: Node[], edges: Edge<CableEdgeData>[], edge: Edge<CableEdgeData>): string[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const sourceNode = nodeMap.get(edge.source);
  const targetNode = nodeMap.get(edge.target);
  const sysVoltage = getSystemVoltage(nodes);

  // AC-Kanten werden von CableEdge komplett übersprungen
  if (edge.data?.edgeDomain === 'AC_230V') return [];

  const I = calculateEdgeCurrent(sourceNode, targetNode, nodes, sysVoltage);
  const length = edge.data?.length ?? 1;
  const cs = calculateCrossSection(I, length, edge.data?.crossSection, 'DC_12V');
  const maxFuse = calculateMaxFuse(cs);
  const ownDrop = (I * (length * 2)) / (58 * cs);
  const pathDrop = usePlannerStore.getState().calculatePathVoltageDrop(edge.source, nodes, edges);
  const totalDropPercentage = ((ownDrop + pathDrop) / sysVoltage) * 100;

  return collectEdgeErrors({
    edgeDomain: (edge.data?.edgeDomain as string) === 'AC_230V' ? 'AC_230V' : 'DC_12V',
    data: edge.data,
    I,
    maxFuse,
    isPlus: !!edge.sourceHandle?.includes('plus'),
    sourceNodeType: sourceNode?.type,
    length,
    totalDropPercentage,
  });
}

function assertZeroWarnings(nodes: Node[], edges: Edge<CableEdgeData>[]) {
  // 1. Live-Validierung (useLiveValidation-Regeln)
  const { result } = renderHook(() => useLiveValidation(nodes, edges));
  expect(result.current).toEqual([]);

  // 2. Kanten-Logik der Anzeige (CableEdge-Errors)
  const edgeErrors: string[] = [];
  for (const edge of edges) {
    edgeErrors.push(...getEdgeErrors(nodes, edges, edge));
}
  expect(edgeErrors).toEqual([]);
}

function assertFusesMatchVde(edges: Edge<CableEdgeData>[]) {
  for (const edge of edges) {
    if (edge.data?.edgeDomain === 'AC_230V') continue;
    if (!edge.sourceHandle?.includes('plus')) continue; // Minus ohne Sicherung (fachgerecht)
    const fuseSize = edge.data?.fuseSize;
    const cs = edge.data?.crossSection ?? 1.5;
    expect(fuseSize, `Sicherung fehlt auf ${edge.id}`).toBeDefined();
    expect(fuseSize!, `Sicherung ${fuseSize} außerhalb Normgrößen (${edge.id})`).toBeGreaterThan(0);
    expect(STANDARD_FUSE_SIZES).toContain(fuseSize);
    expect(fuseSize!, `Sicherung ${fuseSize}A > FUSE_MAP[${cs}] (${edge.id})`).toBeLessThanOrEqual(FUSE_MAP[cs] ?? 0);
  }
}

function connectionKeys(edges: Edge[]): Set<string> {
  return new Set(edges.map((e) => `${e.source}|${e.target}|${e.sourceHandle || ''}|${e.targetHandle || ''}`));
}

describe('Auto-Wire: keine Warnungen nach performAutoWiring', () => {
  it('Szenario 1 — Minimal: nur Batterie + 1 Verbraucher', () => {
    const nodes = [
      makeNode('b1', 'battery', { label: 'Batterie', capacity: 100, chemistry: 'LiFePO4' }),
      makeNode('c1', 'consumer', { label: 'LED', watts: 20, hours: 2 }),
    ];
    const { nodes: n, edges: e } = runAutoWire(nodes);

    expect(n.some((x) => x.type === 'busbar')).toBe(true);
    expect(n.some((x) => x.type === 'shunt')).toBe(true);
    expect(n.some((x) => x.type === 'fuse')).toBe(true);

    assertZeroWarnings(n, e);
    assertFusesMatchVde(e);
  });

  it('Szenario 2 — Solar-Setup: 2 Panels + MPPT', () => {
    const nodes = [
      makeNode('b1', 'battery', { label: 'Batterie', capacity: 200, chemistry: 'LiFePO4' }),
      makeNode('s1', 'solar', { label: 'Panel 1', watts: 100 }),
      makeNode('s2', 'solar', { label: 'Panel 2', watts: 100 }),
      makeNode('m1', 'mpptController', { label: 'MPPT', amps: 30 }),
      makeNode('c1', 'consumer', { label: 'Kühlbox', watts: 60, hours: 4 }),
    ];
    const { nodes: n, edges: e } = runAutoWire(nodes);

    const mppt = n.find((x) => x.id === 'm1');
    expect(mppt?.data.amps).toBe(30); // vorhandener Regler reicht (200W ≤ 30A·12,8V)

    assertZeroWarnings(n, e);
    assertFusesMatchVde(e);
  });

  it('Szenario 3 — Landstrom + Wechselrichter (AC/DC strikt getrennt)', () => {
    const nodes = [
      makeNode('b1', 'battery', { label: 'Batterie', capacity: 200, chemistry: 'LiFePO4' }),
      makeNode('i1', 'inverter', { label: 'Inverter', watts: 1000 }),
      makeNode('a1', 'consumer230v', { label: 'Steckdose', watts: 300, hours: 1 }),
      makeNode('p1', 'shorePower', { label: 'Landstrom', hasRcd: true }),
      makeNode('c1', 'consumer', { label: 'Pumpe', watts: 40, hours: 2 }),
    ];
    const { nodes: n, edges: e } = runAutoWire(nodes);

    // Landstrom muss vorschriftsgemäß einen RCD (FI ≤30 mA) haben — das ist
    // eine Eigenschaft des Bauteils und wird von Auto-Wire nicht mehr
    // pauschal gesetzt (sonst würde ein fehlender FI verschleiert).
    const shore = n.find((x) => x.id === 'p1');
    expect(shore?.data.hasRcd).toBe(true);

    // Keine DC-Kante zwischen Landstrom/230V-Verbraucher und DC-Welt
    const acEdges = e.filter((x) => x.data?.edgeDomain === 'AC_230V');
    expect(acEdges.length).toBeGreaterThan(0);
    for (const ac of acEdges) {
      const src = n.find((x) => x.id === ac.source)?.type;
      const tgt = n.find((x) => x.id === ac.target)?.type;
      expect(['shorePower', 'inverter', 'consumer230v']).toContain(src);
      expect(['shorePower', 'inverter', 'consumer230v']).toContain(tgt);
    }

    assertZeroWarnings(n, e);
    assertFusesMatchVde(e);
  });

  it('Szenario 4 — Volle Hütte: alle Ladequellen + DC/AC-Verbraucher', () => {
    const nodes = [
      makeNode('b1', 'battery', { label: 'Batterie', capacity: 200, chemistry: 'LiFePO4' }),
      makeNode('s1', 'solar', { label: 'Panel 1', watts: 200 }),
      makeNode('s2', 'solar', { label: 'Panel 2', watts: 200 }),
      makeNode('m1', 'mpptController', { label: 'MPPT', amps: 10 }),
      makeNode('d1', 'dcdcCharger', { label: 'Ladebooster', amps: 30 }),
      makeNode('ch1', 'charger', { label: 'Ladequelle', amps: 20 }),
      makeNode('ac1', 'acBatteryCharger', { label: '230V Ladegerät', amps: 25 }),
      makeNode('p1', 'shorePower', { label: 'Landstrom', hasRcd: true }),
      makeNode('i1', 'inverter', { label: 'Inverter', watts: 1000 }),
      makeNode('c1', 'consumer', { label: 'Kühlschrank', watts: 60, hours: 4 }),
      makeNode('c2', 'consumer', { label: 'Pumpe', watts: 40, hours: 3 }),
      makeNode('c3', 'consumer', { label: 'LED', watts: 40, hours: 2 }),
      makeNode('a1', 'consumer230v', { label: 'Steckdose', watts: 300, hours: 1 }),
      makeNode('g1', 'ground', { label: 'Massepunkt' }),
    ];
    const { nodes: n, edges: e } = runAutoWire(nodes);

    // MPPT wird hochdimensioniert, damit 400W Solar nicht überlasten (Regel B)
    const mppt = n.find((x) => x.id === 'm1');
    expect(Number(mppt?.data.amps)).toBeGreaterThanOrEqual(Math.ceil(400 / 12.8));

    // DC-DC-Ladebooster braucht Eingang (Starterseite) + Ausgang
    const dcdcInput = e.some((x) => x.target === 'd1');
    const dcdcOutput = e.some((x) => x.source === 'd1');
    expect(dcdcInput).toBe(true);
    expect(dcdcOutput).toBe(true);
    // Starterbatterie wird automatisch ergänzt
    expect(n.some((x) => x.type === 'battery' && x.data.label === 'Starterbatterie')).toBe(true);

    assertZeroWarnings(n, e);
    assertFusesMatchVde(e);
  });

  it('Szenario 5 — Winter-Saison: hohe Lasten', () => {
    const nodes = [
      makeNode('b1', 'battery', { label: 'Batterie', capacity: 300, chemistry: 'LiFePO4' }),
      makeNode('i1', 'inverter', { label: 'Inverter', watts: 800 }),
      makeNode('a1', 'consumer230v', { label: 'Heizlüfter', watts: 500, hours: 1 }),
      makeNode('c1', 'consumer', { label: 'Standheizung', watts: 80, hours: 4 }),
      makeNode('s1', 'solar', { label: 'Panel', watts: 200 }),
      makeNode('m1', 'mpptController', { label: 'MPPT', amps: 30 }),
    ];
    const { nodes: n, edges: e, season } = runAutoWire(nodes, { season: 'winter' });

    expect(season).toBe('winter');

    assertZeroWarnings(n, e);
    assertFusesMatchVde(e);
  });

  it('Idempotenz: zweimaliges Auto-Wire erzeugt keine Duplikate und keine neuen Warnungen', () => {
    const nodes = [
      makeNode('b1', 'battery', { label: 'Batterie', capacity: 200, chemistry: 'LiFePO4' }),
      makeNode('s1', 'solar', { label: 'Panel', watts: 200 }),
      makeNode('c1', 'consumer', { label: 'Kühlbox', watts: 60, hours: 4 }),
      makeNode('i1', 'inverter', { label: 'Inverter', watts: 1000 }),
      makeNode('a1', 'consumer230v', { label: 'Steckdose', watts: 300, hours: 1 }),
    ];

    const first = runAutoWire(nodes);
    assertZeroWarnings(first.nodes, first.edges);
    const firstKeys = connectionKeys(first.edges);

    const second = runAutoWire(first.nodes, { userEdges: first.edges });
    assertZeroWarnings(second.nodes, second.edges);

    expect(second.nodes.length).toBe(first.nodes.length); // keine neuen Nodes
    expect(connectionKeys(second.edges).size).toBe(firstKeys.size); // keine Duplikate
    expect(connectionKeys(second.edges)).toEqual(firstKeys);
  });

  it('Nutzer-Kanten bleiben erhalten; Direktverbindung Batterie→Verbraucher wird über den Sicherungskasten geführt', () => {
    const nodes = [
      makeNode('b1', 'battery', { label: 'Batterie', capacity: 100, chemistry: 'LiFePO4' }),
      makeNode('c1', 'consumer', { label: 'LED', watts: 20, hours: 2 }),
    ];
    const userEdge: Edge<CableEdgeData> = {
      id: 'user-edge-1',
      source: 'b1',
      target: 'c1',
      sourceHandle: 'plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 2, crossSection: 2.5 },
    };

    const { edges } = runAutoWire(nodes, { userEdges: [userEdge] });

    expect(edges.some((e) => e.id === 'user-edge-1')).toBe(true); // bleibt erhalten
    const healed = edges.find((e) => e.id === 'user-edge-1');
    expect(healed?.target).toBe('c1');
    expect(healed?.source).not.toBe('b1'); // nicht mehr direkt an der Batterie

    // Keine doppelte Plus-Zuleitung zum Verbraucher
    const dupes = edges.filter(
      (e) => e.target === 'c1' && e.sourceHandle === 'plus' && e.targetHandle === 'plus'
    );
    expect(dupes.length).toBe(1);
  });

  it('Startzustand (Standard-Template): nach Auto-Wire null Warnungen', () => {
    const { nodes: n, edges: e } = runAutoWire(TEMPLATE_MINIMALIST.nodes, { userEdges: TEMPLATE_MINIMALIST.edges });

    // Template-Kanten bleiben erhalten, Auto-Kanten kommen hinzu
    for (const ie of TEMPLATE_MINIMALIST.edges) {
      expect(e.some((x) => x.id === ie.id)).toBe(true);
    }
    // keine doppelten Verbindungen
    expect(connectionKeys(e).size).toBe(e.length);

    assertZeroWarnings(n, e);
    assertFusesMatchVde(e);
  });
});

function assertNoSafetyWarnings(nodes: Node[], edges: Edge<CableEdgeData>[]) {
  const { result } = renderHook(() => useLiveValidation(nodes, edges));
  expect(result.current.filter((w) => w.category !== 'estimation')).toEqual([]);

  const edgeErrors: string[] = [];
  for (const edge of edges) {
    edgeErrors.push(...getEdgeErrors(nodes, edges, edge));
  }
  expect(edgeErrors).toEqual([]);
}

describe('Auto-Wire: Topologie-Heilung & reale Templates', () => {
  it('Szenario Minimalist-Template: Shunt-Bypass wird geheilt, Masse über Shunt', () => {
    const { nodes: n, edges: e } = runAutoWire(TEMPLATE_MINIMALIST.nodes, {
      userEdges: TEMPLATE_MINIMALIST.edges,
    });

    // Plus- und Minus-Schiene müssen getrennte Knoten sein (sonst Kurzschluss).
    const busbars = n.filter((x) => x.type === 'busbar');
    const plus = busbars.find((x) => x.data?.role === 'positive');
    const minus = busbars.find((x) => x.data?.role === 'negative');
    expect(busbars.length).toBeGreaterThanOrEqual(2);
    expect(plus).toBeDefined();
    expect(minus).toBeDefined();
    expect(plus!.id).not.toBe(minus!.id);
    expect(n.some((x) => x.type === 'shunt')).toBe(true);

    const house = n.find((x) => x.id === 'battery-1');
    const shunt = n.find((x) => x.type === 'shunt');
    expect(house).toBeDefined();
    expect(shunt).toBeDefined();

    const batteryMinusBypass = e.filter(
      (x) =>
        x.source === 'battery-1' &&
        x.sourceHandle === 'minus' &&
        x.target !== shunt!.id
    );
    expect(batteryMinusBypass).toEqual([]);

    const groundFeed = e.find((x) => x.target === 'ground-1' && x.targetHandle === 'minus');
    expect(groundFeed?.source).toBe(shunt!.id);

    assertNoSafetyWarnings(n, e);
    assertFusesMatchVde(e);
  });

  it('Szenario Allrounder-Template: Plus/Minus-Busbars werden wiederverwendet (keine dritte Schiene)', () => {
    const { nodes: n, edges: e } = runAutoWire(TEMPLATE_ALLROUNDER.nodes, {
      userEdges: TEMPLATE_ALLROUNDER.edges,
    });

    expect(n.filter((x) => x.type === 'busbar').length).toBe(2);
    expect(n.some((x) => x.data.label === 'Main Busbar')).toBe(false);

    const dcdcMinus = e.some(
      (x) => x.source === 'starter-1' && x.target === 'charger-2' && x.sourceHandle === 'minus'
    );
    const dcdcPlus = e.some(
      (x) => x.source === 'starter-1' && x.target === 'charger-2' && x.sourceHandle === 'plus'
    );
    expect(dcdcPlus).toBe(true);
    expect(dcdcMinus).toBe(true);

    assertNoSafetyWarnings(n, e);
    assertFusesMatchVde(e);
  });

  it('Szenario Autark-Template: Landstrom-RCD, Busbars wiederverwendet, kein Shunt-Bypass', () => {
    const { nodes: n, edges: e } = runAutoWire(TEMPLATE_AUTARK.nodes, {
      userEdges: TEMPLATE_AUTARK.edges,
    });

    const shore = n.find((x) => x.id === 'shore-1');
    expect(shore?.data.hasRcd).toBe(true);
    expect(n.filter((x) => x.type === 'busbar').length).toBe(2);
    expect(n.some((x) => x.data.label === 'Main Busbar')).toBe(false);

    // Mission 4: Das Template nutzt einen 1500-W-Wechselrichter, damit sich
    // der Strom mit der Normreihe fehlerfrei absichern lässt. Deshalb gilt
    // hier die volle Prüfung — ohne die frühere Sonderbehandlung für 2000 W.
    assertNoSafetyWarnings(n, e);
    assertFusesMatchVde(e);
  });

  it('Legacy-Laderegler (type charger) wird als MPPT wiederverwendet', () => {
    const nodes = [
      makeNode('b1', 'battery', { label: 'Batterie', capacity: 200, chemistry: 'LiFePO4' }),
      makeNode('s1', 'solar', { label: 'Panel', watts: 200 }),
      makeNode('ch1', 'charger', { label: 'PWM-Regler', amps: 30 }),
    ];
    const { nodes: n, edges: e } = runAutoWire(nodes);

    expect(n.filter((x) => x.type === 'mpptController')).toHaveLength(0);
    expect(n.filter((x) => x.type === 'charger')).toHaveLength(1);
    expect(e.some((x) => x.source === 's1' && x.target === 'ch1')).toBe(true);

    assertZeroWarnings(n, e);
    assertFusesMatchVde(e);
  });

  it('Zweite Aufbaubatterie wird parallel auf Schiene und Shunt gelegt, nicht als Starter missbraucht', () => {
    const nodes = [
      makeNode('b1', 'battery', { label: 'Batterie 1', capacity: 100, chemistry: 'LiFePO4' }),
      makeNode('b2', 'battery', { label: 'Batterie 2', capacity: 100, chemistry: 'LiFePO4' }),
      makeNode('c1', 'consumer', { label: 'LED', watts: 20, hours: 2 }),
    ];
    const { nodes: n, edges: e } = runAutoWire(nodes);

    expect(n.some((x) => x.data.label === 'Starterbatterie')).toBe(false);
    const shunt = n.find((x) => x.type === 'shunt');
    const busbar = n.find((x) => x.type === 'busbar');
    expect(shunt).toBeDefined();
    expect(busbar).toBeDefined();

    expect(e.some((x) => x.source === 'b2' && x.target === busbar!.id && x.sourceHandle === 'plus')).toBe(true);
    expect(e.some((x) => x.source === 'b2' && x.target === shunt!.id && x.sourceHandle === 'minus')).toBe(true);

    assertZeroWarnings(n, e);
    assertFusesMatchVde(e);
  });

  it('erkennt Startbatterie (ohne „er“) und legt keine zweite Starterbatterie an', () => {
    const nodes = [
      makeNode('b1', 'battery', { label: 'Aufbau', capacity: 200, chemistry: 'LiFePO4' }),
      makeNode('b2', 'battery', { label: 'Startbatterie', capacity: 90, chemistry: 'AGM' }),
      makeNode('d1', 'dcdcCharger', { label: 'Booster', amps: 30 }),
    ];
    const { nodes: n, edges: e } = runAutoWire(nodes);

    expect(n.filter((x) => x.type === 'battery')).toHaveLength(2);
    expect(n.some((x) => x.data.label === 'Starterbatterie')).toBe(false);
    expect(e.some((x) => x.source === 'b2' && x.target === 'd1' && x.sourceHandle === 'plus')).toBe(true);
    expect(e.some((x) => x.source === 'b2' && x.target === 'd1' && x.sourceHandle === 'minus')).toBe(true);

    assertZeroWarnings(n, e);
  });

  it('nutzt vorhandene AGM als Starter, wenn ein Ladebooster da ist', () => {
    const nodes = [
      makeNode('b1', 'battery', { label: 'Lithium', capacity: 200, chemistry: 'LiFePO4' }),
      makeNode('b2', 'battery', { label: 'Bord AGM', capacity: 80, chemistry: 'AGM' }),
      makeNode('d1', 'dcdcCharger', { label: 'Booster', amps: 30 }),
    ];
    const { nodes: n, edges: e } = runAutoWire(nodes);

    expect(n.filter((x) => x.type === 'battery')).toHaveLength(2);
    expect(e.some((x) => x.source === 'b2' && x.target === 'd1')).toBe(true);
    const shunt = n.find((x) => x.type === 'shunt');
    expect(e.some((x) => x.source === 'b2' && x.target === shunt?.id)).toBe(false);

    assertZeroWarnings(n, e);
  });

  it('legt gleichartige AGM-Batterien parallel, aber unterschiedliche Chemien nicht', () => {
    const nodes = [
      makeNode('b1', 'battery', { label: 'Lithium', capacity: 200, chemistry: 'LiFePO4' }),
      makeNode('b2', 'battery', { label: 'AGM Reserve', capacity: 80, chemistry: 'AGM' }),
      makeNode('c1', 'consumer', { label: 'LED', watts: 20, hours: 2 }),
    ];
    const { nodes: n, edges: e } = runAutoWire(nodes);

    expect(n.some((x) => x.data.label === 'Starterbatterie')).toBe(false);
    // LiFePO4 + AGM am selben Bus ist fachlich unzulässig (andere Ladespannung).
    // Die AGM-Remote-Batterie wird deshalb NICHT auf die 12-V-Sammelschiene
    // gelegt, statt eine gefährliche Mischchemie-Parallelschaltung zu bauen.
    const shunt = n.find((x) => x.type === 'shunt');
    const busbar = n.find((x) => x.type === 'busbar');
    expect(e.some((x) => x.source === 'b2' && x.target === busbar!.id && x.sourceHandle === 'plus')).toBe(false);
    expect(e.some((x) => x.source === 'b2' && x.target === shunt!.id && x.sourceHandle === 'minus')).toBe(false);
  });

  it('erzeugt bei nur Startbatterie + Booster eine Aufbaubatterie (keine zweite Starterbatterie)', () => {
    const nodes = [
      makeNode('b1', 'battery', { label: 'Startbatterie', capacity: 80, chemistry: 'AGM' }),
      makeNode('d1', 'dcdcCharger', { label: 'Booster', amps: 30 }),
    ];
    const { nodes: n } = runAutoWire(nodes);
    const batteries = n.filter((x) => x.type === 'battery');
    // Ein Booster braucht eine getrennte Aufbaubatterie; er darf nicht auf
    // dieselbe Schiene wie die einzige Starterbatterie verdrahtet werden.
    expect(batteries).toHaveLength(2);
    expect(batteries.some((x) => String(x.data?.label ?? '').match(/start/i))).toBe(true);
    expect(batteries.some((x) => !String(x.data?.label ?? '').match(/start/i))).toBe(true);
  });

  it('Unterdimensionierte Nutzer-Sicherung wird angehoben', () => {
    const nodes = [
      makeNode('b1', 'battery', { label: 'Batterie', capacity: 200, chemistry: 'LiFePO4' }),
      makeNode('c1', 'consumer', { label: 'Kühlbox', watts: 60, hours: 4 }),
    ];
    const userEdge: Edge<CableEdgeData> = {
      id: 'tiny-fuse',
      source: 'b1',
      target: 'c1',
      sourceHandle: 'plus',
      targetHandle: 'plus',
      type: 'cableEdge',
      data: { length: 3, crossSection: 1.5, fuseSize: 1 },
    };
    const { edges } = runAutoWire(nodes, { userEdges: [userEdge] });
    const healed = edges.find((x) => x.id === 'tiny-fuse');
    expect(healed?.data?.fuseSize).toBeGreaterThan(1);
    expect(healed?.data?.fuseSize).toBeGreaterThanOrEqual(60 / 12.8);
  });

  it('lange abgesicherte Batterie-Leitung erzeugt keine 20cm-Warnung', () => {
    const errors = collectEdgeErrors({
      edgeDomain: 'DC_12V',
      data: { length: 5, fuseSize: 60, crossSection: 16 },
      I: 30,
      maxFuse: 63,
      isPlus: true,
      sourceNodeType: 'battery',
      length: 5,
      totalDropPercentage: 1,
    });
    expect(errors.filter((err) => err.includes('20cm'))).toEqual([]);
  });

  it('unabgesicherte lange Batterie-Leitung warnt weiterhin (20cm-Regel)', () => {
    const errors = collectEdgeErrors({
      edgeDomain: 'DC_12V',
      data: { length: 5, crossSection: 16 },
      I: 30,
      maxFuse: 63,
      isPlus: true,
      sourceNodeType: 'battery',
      length: 5,
      totalDropPercentage: 1,
    });
    expect(errors.some((err) => err.includes('20cm'))).toBe(true);
  });
});
