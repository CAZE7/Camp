import { describe, it, expect } from 'vitest';
import type { Node, Edge } from 'reactflow';
import type { CableEdgeData } from '../CableEdge';
import { hasVoltageDropError, edgeDropInputs } from './voltageDrop';

describe('hasVoltageDropError', () => {
  it('flaggt eine lange, hoch belastete AC-Leitung (3 % von 230 V = 6,9 V)', () => {
    // ownDrop = 10 * (50*2) / (58*1.5) ≈ 11,49 V → 5,0 % bei 230 V
    const result = hasVoltageDropError({
      isAC: true,
      I: 10,
      length: 50,
      crossSection: 1.5,
      sysVoltage: 230,
      cumulativeDropVolts: 0,
    });
    expect(result.hasDropError).toBe(true);
    expect(result.totalDropPercentage).toBeGreaterThan(3);
  });

  it('meldet keine Fehler für eine unbelastete AC-Leitung', () => {
    const result = hasVoltageDropError({
      isAC: true,
      I: 0,
      length: 50,
      crossSection: 1.5,
      sysVoltage: 230,
      cumulativeDropVolts: 0,
    });
    expect(result).toEqual({ totalDropPercentage: 0, hasDropError: false });
  });

  it('flags a DC edge with a total drop above 3%', () => {
    // ownDrop = 10 * (5*2) / (58*1.5) ≈ 1.149 V → 9.6% bei 12V
    const result = hasVoltageDropError({
      isAC: false,
      I: 10,
      length: 5,
      crossSection: 1.5,
      sysVoltage: 12,
      cumulativeDropVolts: 0,
    });
    expect(result.hasDropError).toBe(true);
    expect(result.totalDropPercentage).toBeGreaterThan(3);
  });

  it('does not flag a DC edge with negligible drop', () => {
    const result = hasVoltageDropError({
      isAC: false,
      I: 1,
      length: 0.2,
      crossSection: 10,
      sysVoltage: 12,
      cumulativeDropVolts: 0,
    });
    expect(result.hasDropError).toBe(false);
  });
});

describe('edgeDropInputs', () => {
  it('detects AC edges from data', () => {
    const inputs = edgeDropInputs(
      { id: 'e1', source: 'a', target: 'b', data: { length: 2, edgeDomain: 'AC_230V' } },
      undefined,
      undefined,
      []
    );
    expect(inputs.isAC).toBe(true);
  });

  it('derives DC inputs from length and cross-section', () => {
    const inputs = edgeDropInputs(
      { id: 'e1', source: 'a', target: 'b', data: { length: 3, crossSection: 4 } },
      { id: 'a', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 12 } },
      { id: 'b', type: 'battery', position: { x: 100, y: 0 }, data: {} },
      []
    );
    expect(inputs.isAC).toBe(false);
    expect(inputs.length).toBe(3);
  });

  it('berechnet für AC-Kanten Nennstrom und Querschnitt aus der 230-V-Last', () => {
    const nodes = [
      { id: 'sp', type: 'shorePower', position: { x: 0, y: 0 }, data: {} },
      { id: 'c1', type: 'consumer230v', position: { x: 100, y: 0 }, data: { watts: 2300 } },
    ] as Node[];
    const edges = [
      { id: 'e1', source: 'sp', target: 'c1', sourceHandle: 'plus', targetHandle: 'plus', data: { edgeDomain: 'AC_230V' } },
    ] as Edge<CableEdgeData>[];
    const inputs = edgeDropInputs(edges[0], nodes[0], nodes[1], nodes, edges);
    // I = 2300 W / 230 V = 10 A; Länge 1 m (Pixelabstand 100 px → 1 m ohne Clamp)
    expect(inputs.isAC).toBe(true);
    expect(inputs.I).toBeCloseTo(10, 10);
    expect(inputs.crossSection).toBeGreaterThanOrEqual(1.5);
  });

  it('übernimmt length 0 aus den Daten (?? statt ||)', () => {
    const inputs = edgeDropInputs(
      { id: 'e1', source: 'a', target: 'b', data: { length: 0, crossSection: 4 } },
      { id: 'a', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 12 } },
      { id: 'b', type: 'battery', position: { x: 30, y: 0 }, data: {} },
      []
    );
    expect(inputs.length).toBe(0);
  });

  it('schätzt kurze Leitungen ohne 1-m-Mindestclamp aus dem Pixelabstand', () => {
    const inputs = edgeDropInputs(
      { id: 'e1', source: 'a', target: 'b', data: { crossSection: 4 } },
      { id: 'a', type: 'consumer', position: { x: 0, y: 0 }, data: { watts: 12 } },
      { id: 'b', type: 'battery', position: { x: 30, y: 0 }, data: {} },
      []
    );
    // 30 px → 0,3 m (früher: Math.max(1, …) → 1,0 m)
    expect(inputs.length).toBe(0.3);
  });
});
