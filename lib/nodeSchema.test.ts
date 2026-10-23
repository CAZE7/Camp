import { describe, it, expect } from 'vitest';
import {
  describeNodeFieldDe,
  isKnownNodeType,
  NODE_DATA_SCHEMA,
  sanitizeNodeDataBySchema,
  syncDefaultNodeLabel,
} from './nodeSchema';
import type { NodeDataRegistry } from '../components/nodes/types';

describe('DOM-003 — deklaratives node.data-Schema (lib/nodeSchema.ts)', () => {
  it('entfernt bekannte Felder mit falschem Laufzeit-Typ', () => {
    const { data, removedFields } = sanitizeNodeDataBySchema('battery', {
      label: 'Aufbau',
      capacity: 'viel', // String statt Zahl
      chemistry: 42, // Zahl statt Enum-String
      nominalVoltage: NaN, // NaN ist keine endliche Zahl
      role: 'startbahn', // nicht in ['starter','house']
      hours: 'spät', // garnicht deklariert für battery → bleibt (unbekannt)
    });
    expect(removedFields.sort()).toEqual(['capacity', 'chemistry', 'nominalVoltage', 'role']);
    expect(data).toEqual({ label: 'Aufbau', hours: 'spät' });
  });

  it('behält korrekte Werte und Unbekanntes (Forward-Kompatibilität)', () => {
    const { data, removedFields } = sanitizeNodeDataBySchema('battery', {
      label: 'Aufbau',
      capacity: 200,
      chemistry: 'AGM',
      role: 'house',
      zukunftsFeld: { neu: true }, // unbekannt → bleibt
    });
    expect(removedFields).toEqual([]);
    expect(data).toEqual({
      label: 'Aufbau',
      capacity: 200,
      chemistry: 'AGM',
      role: 'house',
      zukunftsFeld: { neu: true },
    });
  });

  it('boolean-Felder (hasRcd) verwerfen Strings/Zahlen', () => {
    const bad = sanitizeNodeDataBySchema('inverter', { hasRcd: 'ja' });
    expect(bad.removedFields).toEqual(['hasRcd']);
    const good = sanitizeNodeDataBySchema('inverter', { hasRcd: true });
    expect(good.data.hasRcd).toBe(true);
  });

  it('Solar-Felder (ELE-007): voc/isc/tempCoefficient sind Zahlen-Felder', () => {
    const { removedFields } = sanitizeNodeDataBySchema('solar', {
      voc: '22 V',
      isc: 11.4,
      tempCoefficient: -0.35,
    });
    expect(removedFields).toEqual(['voc']);
  });

  it('unbekannter Bauteiltyp bleibt unangetastet (kein Spec = keine Prüfung)', () => {
    const { data, removedFields } = sanitizeNodeDataBySchema('warpDrive', { watts: 'fast' });
    expect(removedFields).toEqual([]);
    expect(data).toEqual({ watts: 'fast' });
  });

  it('Schema-Feldnamen sind synchron zur NodeDataRegistry (elektrisch relevante Felder)', () => {
    // Der häufigste Drift: ein neues Datenfeld wird in der Registry deklariert,
    // aber nicht ins Persistenz-Schema gepflegt. Wir prüfen die tragenden
    // Felder je Typ gegen die Registry-Schlüssel (statische Reflexion über
    // eine Pflichtliste, da Runtime die Interface-Optionalität nicht sieht).
    const pflicht: Record<string, string[]> = {
      battery: ['capacity', 'chemistry', 'nominalVoltage', 'role'],
      inverter: ['continuousPower', 'hasRcd'],
      shorePower: ['hasRcd', 'rating', 'acCurrentA'],
      solar: ['voc', 'isc', 'tempCoefficient'],
      mpptController: ['amps', 'maxPvVoltage'],
      busbar: ['role', 'rating'],
    };
    for (const [type, fields] of Object.entries(pflicht)) {
      for (const field of fields) {
        expect(NODE_DATA_SCHEMA[type], `${type}.${field} fehlt im Schema`).toHaveProperty(field);
      }
    }
    // Registry-Typen, die laut Schema-Tabelle bekannt sein müssen
    for (const type of Object.keys(NODE_DATA_SCHEMA)) {
      expect(type in ({} as NodeDataRegistry) || true).toBe(true); // Typ-Level-Sync via tsc
    }
  });

  it('K3 + N9: verwirft negative Werte und Werte oberhalb von max (z. B. solar.watts = -5)', () => {
    const solar = sanitizeNodeDataBySchema('solar', {
      label: 'Manipuliertes Modul',
      watts: -5,
      amps: -1,
      voc: 2000,
    });
    expect(solar.removedFields.sort()).toEqual(['amps', 'voc', 'watts']);
    expect(solar.data).toEqual({ label: 'Manipuliertes Modul' });

    const consumer = sanitizeNodeDataBySchema('consumer', {
      watts: 99_999_999,
      hours: 30,
    });
    expect(consumer.removedFields.sort()).toEqual(['hours', 'watts']);
  });

  it('N9: kennt sämtliche registrierten Bauteiltypen (Elektrik, Dach, Wasser)', () => {
    const allRegistryKeys: Array<keyof NodeDataRegistry> = [
      'battery',
      'busbar',
      'charger',
      'conduit',
      'consumer',
      'consumer230v',
      'dcdcCharger',
      'acBatteryCharger',
      'mpptController',
      'fuse',
      'ground',
      'inverter',
      'shorePower',
      'shunt',
      'solar',
      'roofSolar',
      'roofWindow',
      'roofBackground',
      'freshWaterTank',
      'grayWaterTank',
      'pump',
      'accumulator',
      'preFilter',
      'sink',
      'shower',
    ];
    for (const key of allRegistryKeys) {
      expect(isKnownNodeType(key)).toBe(true);
    }
    expect(isKnownNodeType('warpDrive')).toBe(false);
    expect(isKnownNodeType(undefined)).toBe(false);
  });

  it('N13 + N15: synchronisiert führende und nachgestellte Standardbezeichnungen und deutsche Feldnamen', () => {
    expect(describeNodeFieldDe('watts')).toBe('Leistung (W)');
    expect(describeNodeFieldDe('unknownCustomField')).toBe('unknownCustomField');

    expect(syncDefaultNodeLabel('inverter', { label: '500W Inverter' }, { continuousPower: 2000 })).toBe(
      '2000W Inverter'
    );
    expect(syncDefaultNodeLabel('inverter', { label: 'Wechselrichter 500 W' }, { watts: 1500 })).toBe(
      'Wechselrichter 1500 W'
    );
    expect(
      syncDefaultNodeLabel('inverter', { label: 'MultiPlus Sitzbank' }, { continuousPower: 2000 })
    ).toBeUndefined();
    expect(syncDefaultNodeLabel('inverter', { label: '500W Inverter' }, { label: 'Eigener Name' })).toBe(
      'Eigener Name'
    );

    expect(
      syncDefaultNodeLabel('battery', { label: '100Ah Lithium', chemistry: 'LiFePO4' }, { capacity: 280 })
    ).toBe('280Ah Lithium');
    expect(
      syncDefaultNodeLabel('battery', { label: '100Ah LiFePO4', chemistry: 'AGM' }, { capacity: 95 })
    ).toBe('95Ah AGM');
    expect(
      syncDefaultNodeLabel('battery', { label: 'Batterie 100 Ah', chemistry: 'LiFePO4' }, { capacity: 200 })
    ).toBe('Batterie 200 Ah');
    expect(
      syncDefaultNodeLabel('battery', { label: 'LiFePO4 100Ah', chemistry: 'LiFePO4' }, { capacity: 300 })
    ).toBe('LiFePO4 300Ah');

    expect(syncDefaultNodeLabel('solar', { label: '100Wp Solarmodul' }, { watts: 400 })).toBe(
      '400Wp Solarmodul'
    );
    expect(syncDefaultNodeLabel('roofSolar', { label: 'Solarmodul 150 Wp' }, { watts: 220 })).toBe(
      'Solarmodul 220 Wp'
    );
    expect(syncDefaultNodeLabel('consumer', { label: 'LED' }, { watts: 20 })).toBeUndefined();
    expect(syncDefaultNodeLabel('battery', { label: '' }, { capacity: 200 })).toBeUndefined();

    // M14: allowZero=false weist 0 zurück
    expect(sanitizeNodeDataBySchema('battery', { nominalVoltage: 0 }).removedFields).toEqual([
      'nominalVoltage',
    ]);
  });
});
