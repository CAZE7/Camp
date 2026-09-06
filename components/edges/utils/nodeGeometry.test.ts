import { describe, it, expect } from 'vitest';
import { Position } from '@xyflow/react';
import {
  measuredHeight,
  measuredWidth,
  nodeHandleBounds,
  nodeHeight,
  nodeOrigin,
  nodeOriginX,
  nodeOriginY,
  nodeWidth,
  type GeometryNode,
} from './nodeGeometry';

/**
 * S-1 (React Flow 12): Der Adapter ist die einzige Stelle, die weiß, wo die
 * gemessene Geometrie eines Knotens steht. Diese Tests halten beide Formen
 * fest — die v12-Form (`measured` / `internals`) und die flache Form, in der
 * Fixtures, `knownPlans/` und gespeicherte Pläne Knoten beschreiben.
 */
describe('nodeGeometry (React-Flow-Adapter)', () => {
  const flat: GeometryNode = {
    position: { x: 10, y: 20 },
    width: 100,
    height: 50,
    handleBounds: {
      source: [{ id: 'out', x: 100, y: 25, width: 8, height: 8, position: Position.Right }],
    },
  };

  const v12: GeometryNode = {
    position: { x: 1, y: 2 },
    measured: { width: 200, height: 120 },
    internals: {
      positionAbsolute: { x: 300, y: 400 },
      handleBounds: {
        source: [{ id: 'out', x: 200, y: 60, width: 8, height: 8, position: Position.Right }],
        target: null,
      },
    },
  };

  it('liest die absolute Position aus internals (v12)', () => {
    expect(nodeOrigin(v12)).toEqual({ x: 300, y: 400 });
    expect(nodeOriginX(v12)).toBe(300);
    expect(nodeOriginY(v12)).toBe(400);
  });

  it('fällt ohne internals auf positionAbsolute und dann auf position zurück', () => {
    expect(nodeOrigin({ ...flat, positionAbsolute: { x: 7, y: 9 } })).toEqual({ x: 7, y: 9 });
    expect(nodeOrigin(flat)).toEqual({ x: 10, y: 20 });
    expect(nodeOriginX(flat)).toBe(10);
    expect(nodeOriginY(flat)).toBe(20);
  });

  it('bevorzugt die gemessene Größe vor der gesetzten Größe', () => {
    expect(nodeWidth({ ...v12, width: 999 }, 192)).toBe(200);
    expect(nodeHeight({ ...v12, height: 999 }, 120)).toBe(120);
  });

  it('nutzt die flache Größe, solange nichts gemessen wurde', () => {
    expect(nodeWidth(flat, 192)).toBe(100);
    expect(nodeHeight(flat, 120)).toBe(50);
  });

  it('nutzt den Ersatzwert für ungemessene Knoten', () => {
    const bare: GeometryNode = { position: { x: 0, y: 0 } };
    expect(nodeWidth(bare, 192)).toBe(192);
    expect(nodeHeight(bare, 120)).toBe(120);
    // Maß 0 ist kein gültiges Node-Maß und darf nicht den Ersatzwert aushebeln.
    expect(nodeWidth({ ...bare, measured: { width: 0 } }, 192)).toBe(192);
  });

  it('meldet ungemessene Knoten in den Rohwerten als undefined (Signatur R-9)', () => {
    expect(measuredWidth(v12)).toBe(200);
    expect(measuredHeight(v12)).toBe(120);
    expect(measuredWidth({ position: { x: 0, y: 0 } })).toBeUndefined();
    expect(measuredHeight({ position: { x: 0, y: 0 } })).toBeUndefined();
  });

  it('liest Handle-Rechtecke aus beiden Quellen', () => {
    expect(nodeHandleBounds(v12)?.source?.[0]?.x).toBe(200);
    expect(nodeHandleBounds(flat)?.source?.[0]?.x).toBe(100);
    expect(nodeHandleBounds({ position: { x: 0, y: 0 } })).toBeUndefined();
  });
});
