/**
 * AutoWire-Review: Vorher/Nachher je Leitung — reine Projektion, keine Rechnung.
 */
import { describe, expect, it } from 'vitest';
import { autoWireDiffSummary, autoWireEdgeDiff } from './reviewDiff';
import type { CableEdgeData } from '../domain/cableEdgeData';
import type { Edge, Node } from '../domain/graph';
import type { AutoWireConflict } from './conflicts';

const edge = (id: string, data: CableEdgeData = {}): Edge<CableEdgeData> => ({
  id,
  source: 'bat',
  target: 'inv',
  data,
});

const nodes: Node[] = [
  { id: 'bat', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Aufbaubatterie' } },
  { id: 'inv', type: 'inverter', position: { x: 1, y: 0 }, data: { label: 'Wechselrichter' } },
];

const conflict = (edgeIds: readonly string[]): AutoWireConflict => ({
  kind: 'load-exceeds-limit',
  severity: 'critical',
  ruleId: 'AUTO-BMS-001',
  message: 'BMS 50 A reicht nicht.',
  edgeIds,
  nodeIds: ['bat'],
});

describe('autoWireEdgeDiff — Vorher/Nachher je Leitung', () => {
  it('übernimmt die Werte unverändert aus edge.data (keine UI-Rechnung)', () => {
    const rows = autoWireEdgeDiff(
      [],
      [edge('e-1', { crossSection: 7, fuseSize: 13, edgeDomain: 'DC_12V' })],
      nodes
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('new');
    expect(rows[0]?.before).toBeNull();
    expect(rows[0]?.after?.crossSection).toBe(7);
    expect(rows[0]?.after?.fuseSize).toBe(13);
    expect(rows[0]?.after?.domainLabel).toBe('DC 12 V');
    expect(rows[0]?.label).toBe('Aufbaubatterie → Wechselrichter');
    expect(rows[0]?.reasons.join(' ')).toContain('nicht aus einer Berechnung der Anzeige');
  });

  it('nennt bei Änderungen Querschnitt, Sicherung und Verlegebedingung einzeln', () => {
    const rows = autoWireEdgeDiff(
      [edge('e-1', { crossSection: 2.5, fuseSize: 20 })],
      [
        edge('e-1', {
          crossSection: 4,
          fuseSize: 25,
          installationCondition: 'engine-bay',
          edgeDomain: 'AC_230V',
        }),
      ],
      nodes
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('changed');
    const text = rows[0]?.reasons.join(' ') ?? '';
    expect(text).toContain('2,5 mm² → 4 mm²');
    expect(text).toContain('20 A → 25 A');
    expect(text).toContain('Referenzmodell (wie bisher)');
    expect(text).toContain('Motorraum');
    expect(text).toContain('I_z-Basis');
    expect(text).toContain('eigene Annahmen');
    expect(rows[0]?.after?.domainLabel).toBe('230 V AC');
  });

  it('meldet ungültige Verlegebedingungen als nicht ausführbar statt zurückzufallen', () => {
    const rows = autoWireEdgeDiff([], [edge('e-1', { installationCondition: 'bogus' })]);
    expect(rows[0]?.after?.valid).toBe(false);
    expect(rows[0]?.after?.error).toContain('unbekannte Verlegebedingung');
    expect(rows[0]?.reasons.join(' ')).toContain('Nicht ausführbar');
    expect(rows[0]?.reasons.join(' ')).toContain('UNVERIFIABLE');
  });

  it('unterscheidet neu / geändert / entfernt / unverändert und sortiert deterministisch', () => {
    const before = [
      edge('a-changed', { crossSection: 2.5 }),
      edge('b-same', { crossSection: 2.5 }),
      edge('d-removed', { crossSection: 10 }),
    ];
    const after = [
      edge('a-changed', { crossSection: 4 }),
      edge('b-same', { crossSection: 2.5 }),
      edge('c-new', { crossSection: 6 }),
    ];
    const rows = autoWireEdgeDiff(before, after);
    expect(rows.map((row) => `${row.id}:${row.status}`)).toEqual([
      'a-changed:changed',
      'c-new:new',
      'd-removed:removed',
      'b-same:unchanged',
    ]);
    expect(rows.find((row) => row.id === 'd-removed')?.after).toBeNull();
    expect(rows.find((row) => row.id === 'b-same')?.reasons.join(' ')).toContain('Keine Änderung');
    expect(autoWireDiffSummary(rows)).toBe('1 geändert · 1 neu · 1 entfernt · 1 unverändert');
  });

  it('hängt Konflikte nur an die namentlich betroffenen Leitungen', () => {
    const rows = autoWireEdgeDiff([], [edge('e-1'), edge('e-2')], nodes, [conflict(['e-1'])]);
    expect(rows.find((row) => row.id === 'e-1')?.conflicts.map((c) => c.ruleId)).toEqual(['AUTO-BMS-001']);
    expect(rows.find((row) => row.id === 'e-2')?.conflicts).toEqual([]);
  });

  it('Datenblattbedingungen werden als Hersteller-I_z ausgewiesen', () => {
    const rows = autoWireEdgeDiff(
      [],
      [edge('e-1', { installationCondition: 'datasheet', manufacturerIzA: 95 })]
    );
    expect(rows[0]?.after?.valid).toBe(true);
    expect(rows[0]?.after?.assessment).toBe('Datenblatt (Hersteller-I_z)');
  });

  it('leerer Plan und leerer Vorschlag ergeben keine Zeilen', () => {
    expect(autoWireEdgeDiff([], [])).toEqual([]);
    expect(autoWireDiffSummary([])).toBe('0 geändert · 0 neu · 0 entfernt · 0 unverändert');
  });
});
