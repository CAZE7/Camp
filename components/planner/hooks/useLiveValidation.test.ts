import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useLiveValidation } from './useLiveValidation';
import { type Node, type Edge } from '@xyflow/react';
import { type CableEdgeData } from '../../edges/CableEdge';

describe('useLiveValidation', () => {
  it('should return empty warnings for empty nodes and edges', () => {
    const { result } = renderHook(() => useLiveValidation([], []));
    expect(result.current).toEqual([]);
  });

  it('should return empty warnings if nodes or edges are undefined', () => {
    // @ts-expect-error bewusst undefined für Robustheitstest übergeben
    const { result } = renderHook(() => useLiveValidation(undefined, undefined));
    expect(result.current).toEqual([]);
  });

  describe('Rule A5: Parallelschaltung inkompatibler Batterie-Chemien (AUTO-003)', () => {
    const battery = (id: string, chemistry: string): Node => ({
      id,
      type: 'battery',
      data: { label: `Batterie ${id}`, chemistry, capacity: 100 },
      position: { x: 0, y: 0 },
    });

    it('warnt kritisch bei AGM ‖ Gel auf einer Plus-Parallel-Kante', () => {
      const nodes = [battery('1', 'AGM'), battery('2', 'Gel')];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'plus', targetHandle: 'plus' },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      const warning = result.current.find((w) => w.id === 'battery-parallel-chemistry-e1-2');
      expect(warning).toEqual(
        expect.objectContaining({
          category: 'safety',
          type: 'critical',
          ruleId: 'AUTO-003-parallel-chemistry',
          measuredValue: 'AGM ‖ Gel',
        })
      );
    });

    it('LiFePO4 ‖ LiFePO4 bleibt zulässig (keine Chemie-Warnung)', () => {
      const nodes = [battery('1', 'LiFePO4'), battery('2', 'LiFePO4')];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'plus', targetHandle: 'plus' },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes as Node[], edges as never));
      expect(result.current.some((w) => w.id.startsWith('battery-parallel-chemistry'))).toBe(false);
    });

    it('Serien-Kante (plus↔minus) löst NICHT die Chemie-Regel aus (dafür A3)', () => {
      const nodes = [battery('1', 'AGM'), battery('2', 'Gel')];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'plus', targetHandle: 'minus' },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.some((w) => w.id === 'battery-parallel-chemistry-e1-2')).toBe(false);
    });
  });

  describe('Rule A6: MPPT-Voc-Fenster bei Kälte (ELE-007)', () => {
    const panel = (id: string, data: Record<string, unknown>): Node => ({
      id,
      type: 'solar',
      data,
      position: { x: 0, y: 0 },
    });

    it('warnt kritisch, wenn Kalt-Voc des Strings das Regler-Fenster überschreitet', () => {
      // 2 × 22 V STC in Serie; TK −0,35 %/K, T_min −20 °C → 2 · 22 · 1,1575 ≈ 50,9 V.
      const nodes = [
        panel('p1', { label: 'Panel 1', watts: 100, voc: 22 }),
        panel('p2', { label: 'Panel 2', watts: 100, voc: 22 }),
        {
          id: 'm',
          type: 'mpptController',
          data: { label: 'MPPT', amps: 20, maxPvVoltage: 50 },
          position: { x: 0, y: 0 },
        },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 's-p1-p2', source: 'p1', target: 'p2' }, // Serie
        { id: 's-p2-m', source: 'p2', target: 'm' },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      const warning = result.current.find((w) => w.id === 'solar-voc-window-m');
      expect(warning).toEqual(
        expect.objectContaining({
          category: 'safety',
          type: 'critical',
          ruleId: 'ELE-007-voc-window',
          measuredValue: expect.stringContaining('51 V'),
        })
      );
    });

    it('bleibt still, wenn Kalt-Voc im Fenster liegt', () => {
      const nodes = [
        panel('p1', { label: 'Panel 1', watts: 100, voc: 22 }),
        {
          id: 'm',
          type: 'mpptController',
          data: { label: 'MPPT', amps: 20, maxPvVoltage: 60 },
          position: { x: 0, y: 0 },
        },
      ];
      const edges: Edge<CableEdgeData>[] = [{ id: 's-p1-m', source: 'p1', target: 'm' }];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.some((w) => w.id === 'solar-voc-window-m')).toBe(false);
    });

    it('fordert fehlende Voc-Datenblattwerte als Hinweis an (nicht still schätzen)', () => {
      const nodes = [
        panel('p1', { label: 'Panel 1', watts: 100 }), // ohne voc
        {
          id: 'm',
          type: 'mpptController',
          data: { label: 'MPPT', amps: 20, maxPvVoltage: 50 },
          position: { x: 0, y: 0 },
        },
      ];
      const edges: Edge<CableEdgeData>[] = [{ id: 's-p1-m', source: 'p1', target: 'm' }];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      const warning = result.current.find((w) => w.id === 'solar-voc-missing-m');
      expect(warning).toEqual(
        expect.objectContaining({
          type: 'info',
          ruleId: 'ELE-007-voc-missing-data',
        })
      );
    });

    it('ohne maxPvVoltage am Regler findet keine Fensterprüfung statt', () => {
      const nodes = [
        panel('p1', { label: 'Panel 1', watts: 100, voc: 40 }),
        { id: 'm', type: 'mpptController', data: { label: 'MPPT', amps: 20 }, position: { x: 0, y: 0 } },
      ];
      const edges: Edge<CableEdgeData>[] = [{ id: 's-p1-m', source: 'p1', target: 'm' }];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.some((w) => w.id.startsWith('solar-voc-'))).toBe(false);
    });
  });

  describe('Rule A: Missing Fuse on High Power Component', () => {
    it('should generate critical warning if fuse is missing on positive line from high power source', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { label: 'Battery' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: { label: 'Consumer' }, position: { x: 100, y: 0 } },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'plus-out', data: { fuseSize: undefined } },
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, edges));

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(
        expect.objectContaining({
          id: 'missing-fuse-e1-2',
          category: 'safety',
          type: 'critical',
          message: expect.stringContaining('Quellschutz fehlt'),
        })
      );
    });

    it('should generate critical warning if target is a busbar without fuse on edge', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { label: 'Battery' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'busbar', data: { label: 'Busbar' }, position: { x: 100, y: 0 } },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'plus-out', data: { fuseSize: undefined } },
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current).toHaveLength(1);
      expect(result.current[0]!.id).toBe('missing-fuse-e1-2');
    });

    it('should not generate warning if fuse size is set', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { label: 'Battery' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: { label: 'Consumer' }, position: { x: 100, y: 0 } },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'plus-out', data: { fuseSize: 100 } },
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current).toEqual([]);
    });

    it('should not generate warning if target is a fuse', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { label: 'Battery' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'fuse', data: { label: 'Fuse' }, position: { x: 100, y: 0 } },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'plus-out', data: { fuseSize: undefined } },
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current).toEqual([]);
    });

    it('should not generate warning if edgeDomain is AC_230V', () => {
      const nodes: Node[] = [
        { id: '1', type: 'inverter', data: { label: 'Inverter' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: { label: 'Consumer' }, position: { x: 100, y: 0 } },
      ];
      const edges: Edge<CableEdgeData>[] = [
        {
          id: 'e1-2',
          source: '1',
          target: '2',
          sourceHandle: 'plus-out',
          data: { edgeDomain: 'AC_230V', fuseSize: undefined },
        },
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.filter((w) => w.id.includes('missing-fuse'))).toEqual([]);
    });

    it('should not generate warning if source handle is not positive', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { label: 'Battery' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: { label: 'Consumer' }, position: { x: 100, y: 0 } },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'minus-out', data: { fuseSize: 10 } },
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current).toEqual([]);
    });
  });

  describe('Rule B: Overloaded Solar Regulator', () => {
    it('should generate warning if total solar watts exceeds MPPT capacity', () => {
      const nodes: Node[] = [
        { id: '1', type: 'solar', data: { watts: 400 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'solar', data: { watts: 400 }, position: { x: 0, y: 0 } },
        { id: '3', type: 'mpptController', data: { amps: 30 }, position: { x: 100, y: 0 } }, // MPPT capacity = 30 * 12 / 0.85 = ~423.5W
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, []));

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(
        expect.objectContaining({
          id: 'solar-overload',
          category: 'estimation',
          type: 'warning',
          message: expect.stringContaining('Solarregler unterdimensioniert'),
        })
      );
    });

    it('should not generate warning if total solar watts is within MPPT capacity', () => {
      const nodes: Node[] = [
        { id: '1', type: 'solar', data: { watts: 100 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'solar', data: { watts: 100 }, position: { x: 0, y: 0 } },
        { id: '3', type: 'mpptController', data: { amps: 30 }, position: { x: 100, y: 0 } }, // MPPT capacity = 30 * 12 / 0.85 = ~423.5W
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, []));
      expect(result.current).toEqual([]);
    });
  });

  describe('Rule C: Battery Capacity Alert', () => {
    it('should generate info warning if daily consumed Ah > total battery Ah', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { capacity: 100 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: { watts: 300, hours: 5 }, position: { x: 100, y: 0 } }, // 300W * 5h / 12V = 125Ah
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, []));

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(
        expect.objectContaining({
          id: 'battery-capacity',
          category: 'estimation',
          type: 'info',
          message: expect.stringContaining('Deine Batterie könnte knapp werden'),
        })
      );
    });

    it('should not generate warning if daily consumed Ah <= total battery Ah', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { capacity: 150 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: { watts: 300, hours: 5 }, position: { x: 100, y: 0 } }, // 300W * 5h / 12V = 125Ah
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, []));
      expect(result.current).toEqual([]);
    });

    it('should default to 4 hours if hours not specified', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { capacity: 50 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: { watts: 300 }, position: { x: 100, y: 0 } }, // 300W * 4h / 12V = 100Ah
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, []));

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(
        expect.objectContaining({
          id: 'battery-capacity',
          category: 'estimation',
          type: 'info',
          message: expect.stringContaining('Deine Batterie könnte knapp werden'),
        })
      );
    });
  });

  describe('Rule E: DC-DC Charger Connection', () => {
    it('should warn if dcdcCharger is missing input or output', () => {
      const nodes: Node[] = [
        { id: '1', type: 'dcdcCharger', data: { label: 'Booster' }, position: { x: 0, y: 0 } },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, []));
      expect(result.current).toHaveLength(1);
      expect(result.current[0]!.id).toBe('dcdc-unconnected-1');
    });

    it('should not warn if dcdcCharger has input and output', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: {}, position: { x: 0, y: 0 } },
        { id: '2', type: 'dcdcCharger', data: {}, position: { x: 0, y: 0 } },
        { id: '3', type: 'battery', data: {}, position: { x: 0, y: 0 } },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1', source: '1', target: '2', data: {} },
        { id: 'e2', source: '2', target: '3', data: {} },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.filter((w) => w.id.includes('dcdc-unconnected'))).toHaveLength(0);
    });
  });

  describe('Rule F: Smart Shunt Bypass', () => {
    it('should warn if a non-shunt is connected directly to battery minus when a shunt exists', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: {}, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: {}, position: { x: 0, y: 0 } },
        { id: '3', type: 'shunt', data: {}, position: { x: 0, y: 0 } },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1', source: '2', target: '1', targetHandle: 'minus-in', data: {} },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.filter((w) => w.id.includes('shunt-bypass'))).toHaveLength(1);
    });

    it('does not flag starter-battery minus to DC-DC when the shunt sits on the house battery', () => {
      const nodes: Node[] = [
        { id: 'house', type: 'battery', data: { label: 'Aufbau' }, position: { x: 0, y: 0 } },
        { id: 'starter', type: 'battery', data: { label: 'Startbatterie' }, position: { x: 0, y: 0 } },
        { id: 'shunt', type: 'shunt', data: {}, position: { x: 0, y: 0 } },
        { id: 'booster', type: 'dcdcCharger', data: { label: 'Booster' }, position: { x: 0, y: 0 } },
      ];
      const edges: Edge<CableEdgeData>[] = [
        {
          id: 'e-house-shunt',
          source: 'house',
          target: 'shunt',
          sourceHandle: 'minus',
          targetHandle: 'minus',
          data: {},
        },
        {
          id: 'e-starter-plus',
          source: 'starter',
          target: 'booster',
          sourceHandle: 'plus',
          targetHandle: 'plus',
          data: { fuseSize: 40 },
        },
        {
          id: 'e-starter-minus',
          source: 'starter',
          target: 'booster',
          sourceHandle: 'minus',
          targetHandle: 'minus',
          data: {},
        },
        {
          id: 'e-booster-out',
          source: 'booster',
          target: 'house',
          sourceHandle: 'plus',
          targetHandle: 'plus',
          data: { fuseSize: 40 },
        },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.filter((w) => w.id.includes('shunt-bypass'))).toHaveLength(0);
    });
  });

  describe('Rule G: Inverter Protection', () => {
    it('should warn if inverter has no fuse on positive edge and source is not fuse', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: {}, position: { x: 0, y: 0 } },
        { id: '2', type: 'inverter', data: {}, position: { x: 0, y: 0 } },
      ];
      // Note: testing both unprotected and missing minus
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1', source: '1', target: '2', targetHandle: 'plus-in', data: { fuseSize: undefined } },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.filter((w) => w.id.includes('inverter-unprotected'))).toHaveLength(1);
      expect(result.current.find((w) => w.id.includes('inverter-unprotected'))?.category).toBe('safety');
      expect(result.current.filter((w) => w.id.includes('inverter-no-minus'))).toHaveLength(1);
      expect(result.current.find((w) => w.id.includes('inverter-no-minus'))?.category).toBe('topology');
    });

    it('should not warn if inverter has fuse on edge and has minus', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: {}, position: { x: 0, y: 0 } },
        { id: '2', type: 'inverter', data: {}, position: { x: 0, y: 0 } },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1', source: '1', target: '2', targetHandle: 'plus-in', data: { fuseSize: 200 } },
        { id: 'e2', source: '1', target: '2', targetHandle: 'minus-in', data: {} },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.filter((w) => w.id.includes('inverter-unprotected'))).toHaveLength(0);
      expect(result.current.filter((w) => w.id.includes('inverter-no-minus'))).toHaveLength(0);
    });
  });

  describe('RCD / FI-Schutz (DIN VDE 0100-721)', () => {
    it('warnt kritisch, wenn ein Landstromanschluss keinen RCD hat', () => {
      const nodes: Node[] = [
        {
          id: '1',
          type: 'shorePower',
          data: { label: 'Landstrom', hasRcd: false },
          position: { x: 0, y: 0 },
        },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, []));
      const rcd = result.current.find((w) => w.id === 'missing-rcd-1');
      expect(rcd).toBeDefined();
      expect(rcd?.type).toBe('critical');
      expect(rcd?.message).toContain('FI-Schutzschalter');
    });

    it('warnt nicht, wenn der Landstromanschluss einen RCD hat', () => {
      const nodes: Node[] = [
        { id: '1', type: 'shorePower', data: { label: 'Landstrom', hasRcd: true }, position: { x: 0, y: 0 } },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, []));
      expect(result.current.find((w) => w.id === 'missing-rcd-1')).toBeUndefined();
    });
  });

  describe('AUDIT ELE-002/003/005/009', () => {
    it('warnt kritisch bei direkter Solar→Batterie-Verbindung (ELE-009)', () => {
      const nodes: Node[] = [
        { id: 'p1', type: 'solar', data: { label: 'Panel', watts: 200 }, position: { x: 0, y: 0 } },
        { id: 'b1', type: 'battery', data: { label: 'Batterie', capacity: 100 }, position: { x: 0, y: 0 } },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'direct', source: 'p1', target: 'b1', sourceHandle: 'plus', targetHandle: 'plus', data: {} },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      const warning = result.current.find((w) => w.id === 'solar-direct-direct');
      expect(warning).toBeDefined();
      expect(warning?.ruleId).toBe('ELE-009-solar-direct');
    });

    it('warnt kritisch, wenn eine Solarzuleitung keine Sicherung hat', () => {
      const nodes: Node[] = [
        { id: 'p1', type: 'solar', data: { label: 'Panel', watts: 200, isc: 14 }, position: { x: 0, y: 0 } },
        { id: 'm1', type: 'mpptController', data: { label: 'MPPT', amps: 30 }, position: { x: 0, y: 0 } },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'pv', source: 'p1', target: 'm1', sourceHandle: 'plus', targetHandle: 'plus', data: {} },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.some((w) => w.id === 'missing-fuse-pv')).toBe(true);
    });

    it('warnt bei BMS-Dauerstromüberschreitung', () => {
      const nodes: Node[] = [
        {
          id: 'b1',
          type: 'battery',
          data: { label: 'Batterie', capacity: 100, bmsContinuousDischarge: 50, nominalVoltage: 12.8 },
          position: { x: 0, y: 0 },
        },
        {
          id: 'i1',
          type: 'inverter',
          data: { label: 'Inverter', continuousPower: 1500 },
          position: { x: 0, y: 0 },
        },
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'inv', source: 'b1', target: 'i1', sourceHandle: 'plus', targetHandle: 'plus', data: {} },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.some((w) => w.id.startsWith('bms-discharge-b1'))).toBe(true);
    });

    it('warnt bei ungültigen negativen Watt-Werten', () => {
      const nodes: Node[] = [
        { id: 'c1', type: 'consumer', data: { label: 'Gerät', watts: -60 }, position: { x: 0, y: 0 } },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, []));
      expect(result.current.some((w) => w.id === 'invalid-load-c1-watts')).toBe(true);
    });
  });

  describe('Missing coverage: verpolte Batterie, Mischspannung, Inverter-RCD', () => {
    const node = (id: string, type: string, data: Record<string, unknown>): Node =>
      ({ id, type, position: { x: 0, y: 0 }, data }) as Node;

    it('warnt bei verpolter Batterie (ELE-003)', () => {
      const nodes = [node('b1', 'battery', {}), node('b2', 'battery', {})];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1', source: 'b1', target: 'b2', sourceHandle: 'plus', targetHandle: 'minus' },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      const warning = result.current.find((w) => w.ruleId === 'ELE-003-reversed-polarity');
      expect(warning).toBeDefined();
      expect(warning!.measuredValue).toBe('plus → minus');
    });

    it('warnt bei Mischspannungsplan (ELE-008)', () => {
      const nodes = [node('b1', 'battery', { voltage: 12 }), node('b2', 'battery', { voltage: 24 })];
      const { result } = renderHook(() => useLiveValidation(nodes, []));
      const warning = result.current.find((w) => w.ruleId === 'ELE-008-mixed-voltage');
      expect(warning).toBeDefined();
      expect(warning!.measuredValue).toMatch(/12 V/);
      expect(warning!.measuredValue).toMatch(/24 V/);
    });

    it('warnt bei Inverter ohne RCD (AC-001)', () => {
      const nodes = [node('inv', 'inverter', { hasRcd: false }), node('c1', 'consumer230v', {})];
      const edges: Edge<CableEdgeData>[] = [
        {
          id: 'e1',
          source: 'inv',
          target: 'c1',
          sourceHandle: 'acOut',
          targetHandle: 'acIn',
          data: { edgeDomain: 'AC_230V' },
        },
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      const warning = result.current.find((w) => w.ruleId === 'AC-001-inverter-rcd');
      expect(warning).toBeDefined();
      expect(warning!.measuredValue).toBe('1 × 230-V-Verbraucher ohne FI');
    });
  });
});

describe('Rule A7: Kurzschlussstrom vs. Abschaltvermögen (AUDIT DOM-002)', () => {
  const battery = (id: string, data: Record<string, unknown> = {}): Node => ({
    id,
    type: 'battery',
    data: { label: 'Batterie', capacity: 100, chemistry: 'LiFePO4', ...data },
    position: { x: 0, y: 0 },
  });
  const fused = (edgeData: Record<string, unknown>): Edge<CableEdgeData>[] => [
    { id: 'e1', source: 'b1', target: 'bus1', sourceHandle: 'plus', targetHandle: 'plus', data: edgeData },
  ];

  it('meldet kritisch, wenn die Bauform den Bank-Ik nicht trennt (ATO 1 kA < ≈ 4,27 kA)', () => {
    const nodes = [battery('b1'), { id: 'bus1', type: 'busbar', data: {}, position: { x: 0, y: 0 } } as Node];
    const { result } = renderHook(() => useLiveValidation(nodes, fused({ fuseSize: 100, fuseType: 'ato' })));
    const warning = result.current.find((w) => w.ruleId === 'DOM-002-breaking-capacity');
    expect(warning).toBeDefined();
    expect(warning!.type).toBe('critical');
    expect(warning!.category).toBe('safety');
    expect(warning!.expectedValue).toBe('≤ 1000 A');
    // Ik ≈ 12,8 V / 3 mΩ = 4267 A (gerundet)
    expect(warning!.measuredValue).toBe('≈ 4267 A');
    expect(warning!.focusId).toBe('e1');
  });

  it('gibt bei ausreichendem Abschaltvermögen (Class T 20 kA) Ruhe', () => {
    const nodes = [battery('b1'), { id: 'bus1', type: 'busbar', data: {}, position: { x: 0, y: 0 } } as Node];
    const { result } = renderHook(() =>
      useLiveValidation(nodes, fused({ fuseSize: 100, fuseType: 'classT' }))
    );
    expect(result.current.filter((w) => w.ruleId === 'DOM-002-breaking-capacity')).toEqual([]);
  });

  it('weist ohne Bauform einmal auf den offenen Abschaltvermögens-Check hin', () => {
    const nodes = [battery('b1'), { id: 'bus1', type: 'busbar', data: {}, position: { x: 0, y: 0 } } as Node];
    const edges = [
      ...fused({ fuseSize: 100 }),
      {
        id: 'e2',
        source: 'b1',
        target: 'bus1',
        sourceHandle: 'plus',
        targetHandle: 'plus',
        data: { fuseSize: 50 },
      },
    ];
    const { result } = renderHook(() => useLiveValidation(nodes, edges));
    const notes = result.current.filter((w) => w.ruleId === 'DOM-002-fuse-type-unknown');
    expect(notes.length).toBe(1); // ein Hinweis pro Plan, nicht pro Kante
    expect(notes[0]!.type).toBe('warning');
    expect(notes[0]!.category).toBe('estimation');
    expect(result.current.filter((w) => w.ruleId === 'DOM-002-breaking-capacity')).toEqual([]);
  });

  it('bewertet mit explizitem Datenblatt-Abschaltvermögen statt Bauform', () => {
    const nodes = [
      battery('b1', { internalResistance: 1 }),
      { id: 'bus1', type: 'busbar', data: {}, position: { x: 0, y: 0 } } as Node,
    ];
    // Ri = 1 mΩ → Ik = 12 800 A; MRBF 3000 A reicht nicht, 15 000 A explizit reicht.
    const low = renderHook(() => useLiveValidation(nodes, fused({ fuseSize: 150, fuseType: 'mrbf' })));
    expect(low.result.current.some((w) => w.ruleId === 'DOM-002-breaking-capacity')).toBe(true);
    const ok = renderHook(() =>
      useLiveValidation(nodes, fused({ fuseSize: 150, fuseType: 'mrbf', fuseBreakingCapacity: 15000 }))
    );
    expect(ok.result.current.some((w) => w.ruleId === 'DOM-002-breaking-capacity')).toBe(false);
    expect(ok.result.current.some((w) => w.ruleId === 'DOM-002-fuse-type-unknown')).toBe(false);
  });

  it('schweigt ohne schätzbare Bank (keine Kapazität) und ohne Sicherung', () => {
    const nodes = [
      battery('b1', { capacity: undefined, chemistry: undefined }),
      { id: 'bus1', type: 'busbar', data: {}, position: { x: 0, y: 0 } } as Node,
    ];
    const { result } = renderHook(() => useLiveValidation(nodes, fused({ fuseSize: 100, fuseType: 'ato' })));
    expect(result.current.filter((w) => w.ruleId?.startsWith('DOM-002'))).toEqual([]);
  });

  it('berücksichtigt die Kabeldämpfung Pol → Sicherung über fuseOffset/Querschnitt', () => {
    const nodes = [battery('b1'), { id: 'bus1', type: 'busbar', data: {}, position: { x: 0, y: 0 } } as Node];
    // Sicherung 10 m entfernt auf 95 mm²: R_loop = 2·10/(58·95) = 3,629 mΩ
    // → Ik = 12,8 / (3 + 3,629) mΩ ≈ 1932 A — MRBF 3000 A würde reichen…
    const far = renderHook(() =>
      useLiveValidation(nodes, fused({ fuseSize: 100, fuseType: 'mrbf', fuseOffset: 10, crossSection: 95 }))
    );
    expect(far.result.current.some((w) => w.ruleId === 'DOM-002-breaking-capacity')).toBe(false);
    // … direkt am Pol dagegen: Ik = 4267 A > ATO 1000 A (Gegenprobe am offensichtlichen Fall).
    const near = renderHook(() =>
      useLiveValidation(nodes, fused({ fuseSize: 100, fuseType: 'ato', fuseOffset: 0.15, crossSection: 95 }))
    );
    expect(near.result.current.some((w) => w.ruleId === 'DOM-002-breaking-capacity')).toBe(true);
  });
});
