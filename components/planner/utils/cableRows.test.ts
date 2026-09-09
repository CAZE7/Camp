import { describe, expect, it } from 'vitest';
import { type Node, type Edge } from '@xyflow/react';
import { type CableEdgeData } from '../../edges/CableEdge';
import {
  buildCableRows,
  nodeDisplayName,
  polarityOfEdge,
  rowCrossSectionLabel,
  rowFuseLabel,
  rowLengthMeters,
  rowStatus,
  type RowStatus,
} from './cableRows';

function node(id: string, label: string): Node {
  return { id, type: 'consumer', position: { x: 0, y: 0 }, data: { label } };
}

function edge(partial: {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  edgeDomain?: 'DC_12V' | 'AC_230V' | 'Solar';
  crossSection?: number;
  length?: number;
  fuseSize?: number;
  fuseType?: string;
  acProtection?: { kind: 'mcb' | 'rcbo'; characteristic?: 'B' | 'C' };
}): Edge<CableEdgeData> {
  const { id, source, target, sourceHandle, targetHandle, ...data } = partial;
  return { id, source, target, sourceHandle, targetHandle, type: 'cableEdge', data: data as CableEdgeData };
}

describe('cableRows – Paar-Bündelung', () => {
  it('bündelt Plus- und Minusleitung derselben Strecke zu einer Zeile (Adern 2)', () => {
    const nodes = [node('battery-1', 'Batterie'), node('consumer-1', 'Kühlbox')];
    const plus = edge({
      id: 'e-plus',
      source: 'battery-1',
      target: 'consumer-1',
      sourceHandle: 'plus',
      targetHandle: 'plus',
    });
    const minus = edge({
      id: 'e-minus',
      source: 'consumer-1',
      target: 'battery-1',
      sourceHandle: 'minus',
      targetHandle: 'minus',
    });
    const rows = buildCableRows(nodes, [plus, minus]);

    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row).toMatchObject({
      cores: 2,
      polarity: 'pair',
      fromId: 'battery-1',
      toId: 'consumer-1',
      fromLabel: 'Batterie',
      toLabel: 'Kühlbox',
      representativeEdgeId: 'e-plus',
    });
    expect(row.edgeIds).toEqual(['e-plus', 'e-minus']);
  });

  it('lässt Leitungen verschiedener Strecken als eigene Zeilen', () => {
    const nodes = [node('a', 'A'), node('b', 'B'), node('c', 'C')];
    const rows = buildCableRows(nodes, [
      edge({ id: 'ab', source: 'a', target: 'b' }),
      edge({ id: 'ac', source: 'a', target: 'c' }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.key).sort()).toEqual(['ab', 'ac']);
  });

  it('behandelt eine einzelne Minus-Rückleitung ohne Gegenleitung als eigene Zeile (Adern 1)', () => {
    const nodes = [node('battery-1', 'Batterie'), node('ground-1', 'Massepunkt')];
    const rows = buildCableRows(nodes, [
      edge({
        id: 'e-gnd',
        source: 'battery-1',
        target: 'ground-1',
        sourceHandle: 'minus',
        targetHandle: 'minus',
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ cores: 1, polarity: 'minus' });
  });

  it('führt 230-V-Leitungen einzeln als Mantelleitung (Adern 3), auch bei gleichen Endpunkten', () => {
    const nodes = [node('shore-1', 'Landstrom'), node('inverter-1', 'Wechselrichter')];
    const rows = buildCableRows(nodes, [
      edge({ id: 'e-ac', source: 'shore-1', target: 'inverter-1', edgeDomain: 'AC_230V' }),
      edge({ id: 'e-ac-2', source: 'shore-1', target: 'inverter-1', edgeDomain: 'AC_230V' }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.cores === 3 && row.domain === 'AC_230V')).toBe(true);
  });

  it('sortiert die Zeilen deterministisch nach Von-/Nach-Label', () => {
    const nodes = [node('a', 'Batterie'), node('b', 'Kühlbox'), node('c', 'Massepunkt')];
    const rows = buildCableRows(nodes, [
      edge({ id: 'to-c', source: 'a', target: 'c' }),
      edge({ id: 'to-b', source: 'a', target: 'b' }),
    ]);
    expect(rows.map((row) => row.toLabel)).toEqual(['Kühlbox', 'Massepunkt']);
  });
});

describe('cableRows – Spaltenwerte', () => {
  const nodes = [node('battery-1', 'Batterie'), node('consumer-1', 'Kühlbox')];

  it('rowLengthMeters nimmt die maximale Länge der Zeile', () => {
    const row = buildCableRows(nodes, [
      edge({
        id: 'a',
        source: 'battery-1',
        target: 'consumer-1',
        sourceHandle: 'plus',
        targetHandle: 'plus',
        length: 2,
      }),
      edge({
        id: 'b',
        source: 'battery-1',
        target: 'consumer-1',
        sourceHandle: 'minus',
        targetHandle: 'minus',
        length: 2.5,
      }),
    ])[0]!;
    expect(row).toBeDefined();
    expect(rowLengthMeters(row)).toBe(2.5);
    expect(
      rowLengthMeters(
        buildCableRows(nodes, [edge({ id: 'c', source: 'battery-1', target: 'consumer-1' })])[0]!
      )
    ).toBeUndefined();
  });

  it('rowCrossSectionLabel kombiniert und sortiert Querschnitte', () => {
    const row = buildCableRows(nodes, [
      edge({
        id: 'a',
        source: 'battery-1',
        target: 'consumer-1',
        sourceHandle: 'plus',
        targetHandle: 'plus',
        crossSection: 4,
      }),
      edge({
        id: 'b',
        source: 'battery-1',
        target: 'consumer-1',
        sourceHandle: 'minus',
        targetHandle: 'minus',
        crossSection: 2.5,
      }),
    ])[0]!;
    expect(row).toBeDefined();
    expect(rowCrossSectionLabel(row)).toBe('2.5/4');
    expect(
      rowCrossSectionLabel(
        buildCableRows(nodes, [edge({ id: 'c', source: 'battery-1', target: 'consumer-1' })])[0]!
      )
    ).toBe('—');
  });

  it('rowFuseLabel zeigt Sicherung, Bauform bzw. AC-Schutzorgan', () => {
    type EdgeInput = Parameters<typeof edge>[0];
    const mk = (data: Omit<EdgeInput, 'id' | 'source' | 'target'>) =>
      buildCableRows(nodes, [edge({ id: 'x', source: 'battery-1', target: 'consumer-1', ...data })])[0]!;
    expect(rowFuseLabel(mk({ fuseSize: 16 }))).toBe('16 A');
    expect(rowFuseLabel(mk({ fuseType: 'classT' }))).toBe('CLASST');
    expect(rowFuseLabel(mk({ acProtection: { kind: 'mcb', characteristic: 'B' } }))).toBe('LS B');
    expect(rowFuseLabel(mk({}))).toBe('—');
  });

  it('rowStatus aggregiert die schwerste Warnung der Zeilen-Kanten', () => {
    const row = buildCableRows(nodes, [
      edge({ id: 'plus', source: 'battery-1', target: 'consumer-1', sourceHandle: 'plus' }),
      edge({ id: 'minus', source: 'battery-1', target: 'consumer-1', sourceHandle: 'minus' }),
    ])[0]!;
    const map = new Map<string, RowStatus>([
      ['plus', 'warning'],
      ['minus', 'critical'],
    ]);
    expect(rowStatus(row, map)).toBe('critical');
    expect(rowStatus(row, new Map([['plus', 'info']]))).toBe('info');
    expect(rowStatus(row, new Map())).toBe('ok');
  });
});

describe('cableRows – Helfer', () => {
  it('nodeDisplayName bevorzugt das eigene Label und liefert Registry-Fallback', () => {
    const named = node('n1', 'Kühlbox');
    expect(nodeDisplayName(named)).toBe('Kühlbox');
    const bare: Node = { id: 'battery-1', type: 'battery', position: { x: 0, y: 0 }, data: {} };
    expect(nodeDisplayName(bare)).not.toBe('');
    expect(nodeDisplayName(undefined)).toBe('—');
  });

  it('polarityOfEdge erkennt Plus/Minus an den Handle-IDs', () => {
    const base = edge({ id: 'x', source: 'a', target: 'b' });
    expect(polarityOfEdge({ ...base, sourceHandle: 'plus' })).toBe('plus');
    expect(polarityOfEdge({ ...base, targetHandle: 'minus' })).toBe('minus');
    expect(polarityOfEdge(base)).toBeUndefined();
  });
});
