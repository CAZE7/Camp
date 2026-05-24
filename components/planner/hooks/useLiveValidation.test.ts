import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useLiveValidation } from './useLiveValidation';
import { Node, Edge } from 'reactflow';
import { CableEdgeData } from '../../edges/CableEdge';

describe('useLiveValidation', () => {
  it('should return empty warnings for empty nodes and edges', () => {
    const { result } = renderHook(() => useLiveValidation([], []));
    expect(result.current).toEqual([]);
  });

  it('should return empty warnings if nodes or edges are undefined', () => {
    // @ts-ignore testing undefined inputs
    const { result } = renderHook(() => useLiveValidation(undefined, undefined));
    expect(result.current).toEqual([]);
  });

  describe('Rule A: Missing Fuse on High Power Component', () => {
    it('should generate critical warning if fuse is missing on positive line from high power source', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { label: 'Battery' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: { label: 'Consumer' }, position: { x: 100, y: 0 } }
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'plus-out', data: { fuseSize: undefined } }
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, edges));

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(expect.objectContaining({
        id: 'missing-fuse-e1-2',
        category: 'safety',
        type: 'critical',
        message: expect.stringContaining('Quellschutz fehlt')
      }));
    });

    it('should generate critical warning if target is a busbar without fuse on edge', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { label: 'Battery' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'busbar', data: { label: 'Busbar' }, position: { x: 100, y: 0 } }
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'plus-out', data: { fuseSize: undefined } }
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current).toHaveLength(1);
      expect(result.current[0].id).toBe('missing-fuse-e1-2');
    });

    it('should not generate warning if fuse size is set', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { label: 'Battery' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: { label: 'Consumer' }, position: { x: 100, y: 0 } }
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'plus-out', data: { fuseSize: '100A' } }
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current).toEqual([]);
    });

    it('should not generate warning if target is a fuse', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { label: 'Battery' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'fuse', data: { label: 'Fuse' }, position: { x: 100, y: 0 } }
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'plus-out', data: { fuseSize: undefined } }
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current).toEqual([]);
    });

    it('should not generate warning if edgeDomain is AC_230V', () => {
      const nodes: Node[] = [
        { id: '1', type: 'inverter', data: { label: 'Inverter' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: { label: 'Consumer' }, position: { x: 100, y: 0 } }
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'plus-out', data: { edgeDomain: 'AC_230V', fuseSize: undefined } }
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.filter(w => w.id.includes('missing-fuse'))).toEqual([]);
    });

    it('should not generate warning if source handle is not positive', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { label: 'Battery' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: { label: 'Consumer' }, position: { x: 100, y: 0 } }
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1-2', source: '1', target: '2', sourceHandle: 'minus-out', data: { fuseSize: '10A' } }
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
        { id: '3', type: 'mpptController', data: { amps: 30 }, position: { x: 100, y: 0 } } // MPPT capacity = 30 * 12 / 0.85 = ~423.5W
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, []));

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(expect.objectContaining({
        id: 'solar-overload',
        category: 'estimation',
        type: 'warning',
        message: expect.stringContaining('Solarregler unterdimensioniert')
      }));
    });

    it('should not generate warning if total solar watts is within MPPT capacity', () => {
      const nodes: Node[] = [
        { id: '1', type: 'solar', data: { watts: 100 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'solar', data: { watts: 100 }, position: { x: 0, y: 0 } },
        { id: '3', type: 'mpptController', data: { amps: 30 }, position: { x: 100, y: 0 } } // MPPT capacity = 30 * 12 / 0.85 = ~423.5W
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, []));
      expect(result.current).toEqual([]);
    });
  });

  describe('Rule C: Battery Capacity Alert', () => {
    it('should generate info warning if daily consumed Ah > total battery Ah', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { capacity: 100 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: { watts: 300, hours: 5 }, position: { x: 100, y: 0 } } // 300W * 5h / 12V = 125Ah
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, []));

      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual(expect.objectContaining({
        id: 'battery-capacity',
        category: 'estimation',
        type: 'info',
        message: expect.stringContaining('Deine Batterie könnte knapp werden')
      }));
    });

    it('should not generate warning if daily consumed Ah <= total battery Ah', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: { capacity: 150 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: { watts: 300, hours: 5 }, position: { x: 100, y: 0 } } // 300W * 5h / 12V = 125Ah
      ];

      const { result } = renderHook(() => useLiveValidation(nodes, []));
      expect(result.current).toEqual([]);
    });

    it('should default to 4 hours if hours not specified', () => {
        const nodes: Node[] = [
            { id: '1', type: 'battery', data: { capacity: 50 }, position: { x: 0, y: 0 } },
            { id: '2', type: 'consumer', data: { watts: 300 }, position: { x: 100, y: 0 } } // 300W * 4h / 12V = 100Ah
          ];

          const { result } = renderHook(() => useLiveValidation(nodes, []));

          expect(result.current).toHaveLength(1);
          expect(result.current[0]).toEqual(expect.objectContaining({
            id: 'battery-capacity',
            category: 'estimation',
            type: 'info',
            message: expect.stringContaining('Deine Batterie könnte knapp werden')
          }));
    });
  });

  describe('Rule E: DC-DC Charger Connection', () => {
    it('should warn if dcdcCharger is missing input or output', () => {
      const nodes: Node[] = [
        { id: '1', type: 'dcdcCharger', data: { label: 'Booster' }, position: { x: 0, y: 0 } }
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, []));
      expect(result.current).toHaveLength(1);
      expect(result.current[0].id).toBe('dcdc-unconnected-1');
    });

    it('should not warn if dcdcCharger has input and output', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: {}, position: { x: 0, y: 0 } },
        { id: '2', type: 'dcdcCharger', data: {}, position: { x: 0, y: 0 } },
        { id: '3', type: 'battery', data: {}, position: { x: 0, y: 0 } }
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1', source: '1', target: '2', data: {} },
        { id: 'e2', source: '2', target: '3', data: {} }
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.filter(w => w.id.includes('dcdc-unconnected'))).toHaveLength(0);
    });
  });

  describe('Rule F: Smart Shunt Bypass', () => {
    it('should warn if a non-shunt is connected directly to battery minus when a shunt exists', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: {}, position: { x: 0, y: 0 } },
        { id: '2', type: 'consumer', data: {}, position: { x: 0, y: 0 } },
        { id: '3', type: 'shunt', data: {}, position: { x: 0, y: 0 } }
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1', source: '2', target: '1', targetHandle: 'minus-in', data: {} }
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.filter(w => w.id.includes('shunt-bypass'))).toHaveLength(1);
    });
  });

  describe('Rule G: Inverter Protection', () => {
    it('should warn if inverter has no fuse on positive edge and source is not fuse', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: {}, position: { x: 0, y: 0 } },
        { id: '2', type: 'inverter', data: {}, position: { x: 0, y: 0 } }
      ];
      // Note: testing both unprotected and missing minus
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1', source: '1', target: '2', targetHandle: 'plus-in', data: { fuseSize: undefined } }
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.filter(w => w.id.includes('inverter-unprotected'))).toHaveLength(1);
      expect(result.current.find(w => w.id.includes('inverter-unprotected'))?.category).toBe('safety');
      expect(result.current.filter(w => w.id.includes('inverter-no-minus'))).toHaveLength(1);
      expect(result.current.find(w => w.id.includes('inverter-no-minus'))?.category).toBe('topology');
    });

    it('should not warn if inverter has fuse on edge and has minus', () => {
      const nodes: Node[] = [
        { id: '1', type: 'battery', data: {}, position: { x: 0, y: 0 } },
        { id: '2', type: 'inverter', data: {}, position: { x: 0, y: 0 } }
      ];
      const edges: Edge<CableEdgeData>[] = [
        { id: 'e1', source: '1', target: '2', targetHandle: 'plus-in', data: { fuseSize: 200 } },
        { id: 'e2', source: '1', target: '2', targetHandle: 'minus-in', data: {} }
      ];
      const { result } = renderHook(() => useLiveValidation(nodes, edges));
      expect(result.current.filter(w => w.id.includes('inverter-unprotected'))).toHaveLength(0);
      expect(result.current.filter(w => w.id.includes('inverter-no-minus'))).toHaveLength(0);
    });
  });
});
