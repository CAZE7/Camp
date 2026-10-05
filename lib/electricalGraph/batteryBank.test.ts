import { describe, expect, it } from 'vitest';
import {
  DECLARABLE_BANK_TOPOLOGIES,
  deriveBatteryBanks,
  isBankTopology,
  primaryHouseBank,
} from './batteryBank';
import type { Node } from '../domain/graph';
import { amps, volts } from '../units';
import { NODE_DATA_SCHEMA } from '../nodeSchema';

const battery = (id: string, data: Record<string, unknown> = {}): Node => ({
  id,
  type: 'battery',
  position: { x: 0, y: 0 },
  data: { chemistry: 'LiFePO4', capacity: 100, nominalVoltage: 12.8, ...data },
});

const bankOf = (nodes: Node[], id: string) => {
  const model = deriveBatteryBanks(nodes);
  const bank = model.banks.find((candidate) => candidate.id === id);
  if (!bank) throw new Error(`Bank ${id} fehlt: ${model.banks.map((b) => b.id).join(', ')}`);
  return bank;
};

describe('V2-BANK — explizites Batteriebank-Modell', () => {
  it('die deklarierbaren Topologien stehen genauso im Persistenz-Schema', () => {
    const schema = NODE_DATA_SCHEMA['battery']?.['bankTopology'];
    expect(schema?.enumValues?.slice().sort()).toEqual([...DECLARABLE_BANK_TOPOLOGIES].sort());
    for (const topology of DECLARABLE_BANK_TOPOLOGIES) expect(isBankTopology(topology)).toBe(true);
    for (const wrong of ['unassigned', 'reihe', '', 7, null]) expect(isBankTopology(wrong)).toBe(false);
  });

  it('ein Plan ohne Batterien hat keine Bänke und keine Fragen', () => {
    const model = deriveBatteryBanks([{ id: 'c1', type: 'consumer', position: { x: 0, y: 0 }, data: {} }]);
    expect(model.banks).toEqual([]);
    expect(model.questions).toEqual([]);
    expect(primaryHouseBank(model)).toBeUndefined();
  });

  it('eine einzelne Batterie ist eindeutig: single, Werte unverändert', () => {
    const model = deriveBatteryBanks([battery('b1')]);
    expect(model.banks).toHaveLength(1);
    const bank = model.banks[0]!;
    expect(bank.topology).toBe('single');
    expect(bank.nominalVoltage).toBe(volts(12.8));
    expect(bank.capacityAh).toBe(100);
    expect(bank.voltageClass).toBe('12V');
    expect(model.questions).toEqual([]);
    expect(model.bankOfBattery.get('b1')).toBe(bank.id);
  });

  // ── Der Kern des Befundes: zwei gleiche Batterien sind NICHT parallel ──
  it('zwei undeklarierte Aufbaubatterien ⇒ eine Frage, keine Annahme', () => {
    const model = deriveBatteryBanks([battery('b1'), battery('b2')]);
    expect(model.banks).toHaveLength(2);
    for (const bank of model.banks) {
      expect(bank.topology).toBe('unassigned');
      expect(bank.declared).toBe(false);
      // Konservativ: NICHT summiert — die Bank zählt wie eine Einzelbatterie.
      expect(bank.capacityAh).toBe(100);
      expect(bank.nominalVoltage).toBe(volts(12.8));
    }
    const ambiguous = model.questions.filter((question) => question.kind === 'ambiguous-topology');
    expect(ambiguous).toHaveLength(1);
    expect(ambiguous[0]!.batteryIds).toEqual(['b1', 'b2']);
    expect(ambiguous[0]!.options).toContain('parallel');
    expect(ambiguous[0]!.options).toContain('series');
  });

  it('drei undeklarierte Batterien ergeben trotzdem nur EINE Frage', () => {
    const model = deriveBatteryBanks([battery('b1'), battery('b2'), battery('b3')]);
    expect(model.questions.filter((question) => question.kind === 'ambiguous-topology')).toHaveLength(1);
  });

  it('gleiche bankId gruppiert, fehlende bankId trennt — auch bei identischen Daten', () => {
    const grouped = deriveBatteryBanks([
      battery('b1', { bankId: 'haus', bankTopology: 'parallel' }),
      battery('b2', { bankId: 'haus', bankTopology: 'parallel' }),
    ]);
    expect(grouped.banks).toHaveLength(1);
    expect(grouped.banks[0]!.batteryIds).toEqual(['b1', 'b2']);

    const separate = deriveBatteryBanks([
      battery('b1', { bankTopology: 'single' }),
      battery('b2', { bankTopology: 'single' }),
    ]);
    expect(separate.banks).toHaveLength(2);
  });

  it('Reihenschaltung: Spannung × n, Kapazität bleibt, Strom bleibt der schwächste', () => {
    const bank = bankOf(
      [
        battery('b1', { bankId: 'reihe', bankTopology: 'series', bmsContinuousDischarge: 100 }),
        battery('b2', { bankId: 'reihe', bankTopology: 'series', bmsContinuousDischarge: 80 }),
      ],
      'reihe'
    );
    expect(bank.topology).toBe('series');
    expect(bank.seriesCount).toBe(2);
    expect(bank.nominalVoltage).toBe(volts(25.6));
    expect(bank.voltageClass).toBe('24V');
    expect(bank.capacityAh).toBe(100);
    // In Reihe fließt derselbe Strom durch beide — Addition wäre falsch.
    expect(bank.maxDischargeCurrent).toBe(amps(80));
  });

  it('Parallelschaltung: Kapazität summiert, Spannung bleibt, Ströme summiert', () => {
    const bank = bankOf(
      [
        battery('b1', { bankId: 'haus', bankTopology: 'parallel', bmsContinuousDischarge: 100 }),
        battery('b2', { bankId: 'haus', bankTopology: 'parallel', bmsContinuousDischarge: 100 }),
      ],
      'haus'
    );
    expect(bank.nominalVoltage).toBe(volts(12.8));
    expect(bank.capacityAh).toBe(200);
    expect(bank.maxDischargeCurrent).toBe(amps(200));
    expect(bank.parallelCount).toBe(2);
  });

  it('parallel mit EINER unbekannten BMS-Grenze summiert nicht (keine erfundene Reserve)', () => {
    const bank = bankOf(
      [
        battery('b1', { bankId: 'haus', bankTopology: 'parallel', bmsContinuousDischarge: 100 }),
        battery('b2', { bankId: 'haus', bankTopology: 'parallel' }),
      ],
      'haus'
    );
    expect(bank.maxDischargeCurrent).toBeUndefined();
    expect(bank.capacityAh).toBe(200);
  });

  it('series-parallel ohne Zahlen ⇒ Rückfrage statt erfundener Matrix', () => {
    const model = deriveBatteryBanks([
      battery('b1', { bankId: 'matrix', bankTopology: 'series-parallel' }),
      battery('b2', { bankId: 'matrix', bankTopology: 'series-parallel' }),
    ]);
    expect(model.banks[0]!.topology).toBe('unassigned');
    expect(model.questions.some((question) => question.kind === 'missing-counts')).toBe(true);
  });

  it('series-parallel verlangt genau series × parallel Mitglieder', () => {
    const model = deriveBatteryBanks([
      battery('b1', {
        bankId: 'matrix',
        bankTopology: 'series-parallel',
        bankSeries: 2,
        bankParallel: 2,
      }),
      battery('b2', { bankId: 'matrix', bankTopology: 'series-parallel' }),
    ]);
    expect(model.banks[0]!.topology).toBe('unassigned');
    expect(model.banks[0]!.nominalVoltage).toBe(volts(12.8));
    expect(model.questions.some((question) => question.kind === 'member-count-mismatch')).toBe(true);
  });

  it('series-parallel mit vier Mitgliedern rechnet eine erklärte 2s2p-Matrix korrekt', () => {
    const bank = bankOf(
      [
        battery('b1', {
          bankId: 'matrix',
          bankTopology: 'series-parallel',
          bankSeries: 2,
          bankParallel: 2,
          bmsContinuousDischarge: 100,
        }),
        battery('b2', { bankId: 'matrix', bankTopology: 'series-parallel', bmsContinuousDischarge: 100 }),
        battery('b3', { bankId: 'matrix', bankTopology: 'series-parallel', bmsContinuousDischarge: 100 }),
        battery('b4', { bankId: 'matrix', bankTopology: 'series-parallel', bmsContinuousDischarge: 100 }),
      ],
      'matrix'
    );
    expect(bank.nominalVoltage).toBe(volts(25.6));
    expect(bank.capacityAh).toBe(200);
    expect(bank.maxDischargeCurrent).toBe(amps(200));
  });

  it('eine deklarierte Reihenzahl muss der Mitgliederzahl entsprechen', () => {
    const model = deriveBatteryBanks([
      battery('b1', { bankId: 'reihe', bankTopology: 'series', bankSeries: 3 }),
      battery('b2', { bankId: 'reihe', bankTopology: 'series' }),
    ]);
    expect(model.banks[0]!.topology).toBe('unassigned');
    expect(model.questions.some((question) => question.kind === 'member-count-mismatch')).toBe(true);
  });

  it('widersprüchliche oder unbekannte Topologieangaben bleiben unzugewiesen', () => {
    const conflict = deriveBatteryBanks([
      battery('b1', { bankId: 'conflict', bankTopology: 'series' }),
      battery('b2', { bankId: 'conflict', bankTopology: 'parallel' }),
    ]);
    expect(conflict.banks[0]!.topology).toBe('unassigned');
    expect(conflict.questions.some((question) => question.kind === 'declaration-mismatch')).toBe(true);

    const invalid = deriveBatteryBanks([battery('b1', { bankId: 'invalid', bankTopology: 'paralell' })]);
    expect(invalid.banks[0]!.topology).toBe('unassigned');
    expect(invalid.questions.some((question) => question.kind === 'declaration-mismatch')).toBe(true);
  });

  it('gemischte Chemie in einer erklärten Bank ist eine Frage, kein Kennwert', () => {
    const model = deriveBatteryBanks([
      battery('b1', { bankId: 'mix', bankTopology: 'parallel', chemistry: 'LiFePO4' }),
      battery('b2', { bankId: 'mix', bankTopology: 'parallel', chemistry: 'AGM' }),
    ]);
    expect(model.questions.some((question) => question.kind === 'mixed-chemistry')).toBe(true);
    expect(model.banks[0]!.chemistry).toBe('');
  });

  it('ungleiche Nennspannungen in einer Bank werden gemeldet, nicht gemittelt', () => {
    const model = deriveBatteryBanks([
      battery('b1', { bankId: 'mix', bankTopology: 'parallel', nominalVoltage: 12.8 }),
      battery('b2', { bankId: 'mix', bankTopology: 'parallel', nominalVoltage: 25.6 }),
    ]);
    expect(model.questions.some((question) => question.kind === 'voltage-mismatch')).toBe(true);
    // Maßgeblich ist die kleinste Spannung (sichere Seite).
    expect(model.banks[0]!.nominalVoltage).toBe(volts(12.8));
  });

  it('Starterbatterien sind immer eine eigene single-Bank und machen nichts mehrdeutig', () => {
    const model = deriveBatteryBanks([
      battery('house', { label: 'Aufbau' }),
      battery('start', { label: 'Starterbatterie', chemistry: 'AGM', nominalVoltage: 12 }),
    ]);
    const starter = model.banks.find((bank) => bank.role === 'starter');
    expect(starter?.topology).toBe('single');
    expect(model.banks.find((bank) => bank.role === 'house')?.topology).toBe('single');
    expect(model.questions).toEqual([]);
  });

  it('eine Starterbatterie färbt ihre erklärte Bank auf „starter“', () => {
    const model = deriveBatteryBanks([
      battery('b1', { bankId: 'motor', bankTopology: 'parallel', label: 'Starterbatterie' }),
      battery('b2', { bankId: 'motor', bankTopology: 'parallel' }),
    ]);
    expect(model.banks[0]!.role).toBe('starter');
  });

  it('fehlende Nennspannung nutzt die übergebene Systemspannung, nicht 12 V aus dem Nichts', () => {
    const model = deriveBatteryBanks([battery('b1', { nominalVoltage: undefined })], volts(25.6));
    expect(model.banks[0]!.nominalVoltage).toBe(volts(25.6));
    expect(model.banks[0]!.voltageClass).toBe('24V');
  });

  it('primaryHouseBank wählt deterministisch die kleinste Haus-Bank-ID', () => {
    const nodes = [
      battery('b2', { bankId: 'zweite', bankTopology: 'single' }),
      battery('b1', { bankId: 'erste', bankTopology: 'single' }),
    ];
    expect(primaryHouseBank(deriveBatteryBanks(nodes))?.id).toBe('erste');
    expect(primaryHouseBank(deriveBatteryBanks([...nodes].reverse()))?.id).toBe('erste');
  });

  it('ist reihenfolgeunabhängig (Determinismus)', () => {
    const nodes = [
      battery('b3', { bankId: 'haus', bankTopology: 'parallel' }),
      battery('b1', { bankId: 'haus', bankTopology: 'parallel' }),
      battery('b2', { label: 'Starterbatterie', chemistry: 'AGM' }),
    ];
    const forward = deriveBatteryBanks(nodes);
    const backward = deriveBatteryBanks([...nodes].reverse());
    expect(JSON.stringify(backward.banks)).toBe(JSON.stringify(forward.banks));
    expect(backward.questions).toEqual(forward.questions);
  });

  it('kaputte Zahlen (0, Text) werden ignoriert statt übernommen', () => {
    const bank = bankOf(
      [
        battery('b1', {
          bankId: 'haus',
          bankTopology: 'parallel',
          bmsContinuousDischarge: 'viel',
          capacity: 0,
        }),
        battery('b2', { bankId: 'haus', bankTopology: 'parallel' }),
      ],
      'haus'
    );
    expect(bank.maxDischargeCurrent).toBeUndefined();
    expect(bank.capacityAh).toBe(100);
  });
});
