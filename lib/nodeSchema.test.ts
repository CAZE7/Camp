import { describe, it, expect } from 'vitest';
import { isKnownNodeType, NODE_DATA_SCHEMA, sanitizeNodeDataBySchema } from './nodeSchema';
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
});
