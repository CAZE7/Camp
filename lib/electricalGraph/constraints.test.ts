import { describe, expect, it } from 'vitest';
import {
  COMPONENT_CONSTRAINT_DEFAULTS,
  CONSTRAINT_FIELD_MAP,
  componentCurrentLimit,
  resolveComponentConstraints,
} from './constraints';
import { NODE_DATA_SCHEMA } from '../nodeSchema';
import { ELECTRIC_NODE_TYPES } from '../domain/connectionPolicy';
import { amps, volts, watts } from '../units';

describe('V2-CONSTRAINTS — Bauteilgrenzen als Tabelle statt verstreuter type-Vergleiche', () => {
  it('jedes Feld der Grenzen-Tabelle existiert auch im Persistenz-Schema', () => {
    // Driftschutz (Muster aus handleDomains.test.ts): Ein Feld, das hier
    // gelesen, aber nirgends validiert wird, verschwindet beim Speichern.
    for (const [type, specs] of Object.entries(CONSTRAINT_FIELD_MAP)) {
      const schema = NODE_DATA_SCHEMA[type];
      expect(schema, `kein Schema für ${type}`).toBeDefined();
      for (const spec of specs) {
        expect(schema, `${type}.${spec.key} fehlt im Schema`).toHaveProperty(spec.key);
      }
    }
  });

  it('jeder elektrische Bauteiltyp hat eine Domänen- und Schutzvorgabe', () => {
    for (const type of ELECTRIC_NODE_TYPES) {
      expect(COMPONENT_CONSTRAINT_DEFAULTS[type], `${type} ohne Vorgaben`).toBeDefined();
      expect(COMPONENT_CONSTRAINT_DEFAULTS[type]?.allowedDomains?.length).toBeGreaterThan(0);
    }
  });

  it('nur stromführende Bauteile verlangen ein Schutzorgan', () => {
    expect(COMPONENT_CONSTRAINT_DEFAULTS['battery']?.requiredProtection).toBe('fuse');
    expect(COMPONENT_CONSTRAINT_DEFAULTS['consumer230v']?.requiredProtection).toBe('rcd');
    expect(COMPONENT_CONSTRAINT_DEFAULTS['shorePower']?.requiredProtection).toBe('rcd');
    for (const passive of ['busbar', 'shunt', 'fuse', 'ground', 'conduit']) {
      expect(COMPONENT_CONSTRAINT_DEFAULTS[passive]?.requiredProtection, passive).toBe('none');
    }
  });

  it('unbekannter Typ liefert leere Grenzen statt geratener Werte', () => {
    expect(resolveComponentConstraints({ type: 'warpDrive', data: { amps: 9000 } })).toEqual({});
    expect(resolveComponentConstraints({})).toEqual({});
  });

  it('Batterie: BMS-Werte landen auf den richtigen Grenzen', () => {
    const constraints = resolveComponentConstraints({
      type: 'battery',
      data: {
        bmsContinuousDischarge: 100,
        bmsPeakDischarge: 200,
        bmsContinuousCharge: 50,
        nominalVoltage: 25.6,
      },
    });
    expect(constraints.maxDischargeCurrent).toBe(amps(100));
    expect(constraints.maxCurrent).toBe(amps(200));
    expect(constraints.maxChargeCurrent).toBe(amps(50));
    expect(constraints.voltageClass).toBe('24V');
    expect(constraints.requiredProtection).toBe('fuse');
  });

  it('fehlende Angabe heißt „nicht angegeben“, nicht „unbegrenzt“', () => {
    const constraints = resolveComponentConstraints({ type: 'battery', data: { capacity: 200 } });
    expect(constraints.maxDischargeCurrent).toBeUndefined();
    expect(componentCurrentLimit(constraints)).toBeUndefined();
    expect('maxCurrent' in constraints).toBe(false);
  });

  it('unbrauchbare Werte (0, negativ, Text) werden verworfen statt übernommen', () => {
    const constraints = resolveComponentConstraints({
      type: 'battery',
      data: { bmsContinuousDischarge: 0, bmsPeakDischarge: -5, bmsContinuousCharge: 'viel' },
    });
    expect(constraints.maxDischargeCurrent).toBeUndefined();
    expect(constraints.maxCurrent).toBeUndefined();
    expect(constraints.maxChargeCurrent).toBeUndefined();
  });

  it('Zahlen als Text (Komma-Dezimal) werden wie im Inspector gelesen', () => {
    const constraints = resolveComponentConstraints({
      type: 'mpptController',
      data: { amps: '30,5', maxPvVoltage: '150' },
    });
    expect(constraints.continuousCurrent).toBe(amps(30.5));
    expect(constraints.maxVoltage).toBe(volts(150));
  });

  it('Wechselrichter: watts ist Rückfall für continuousPower, überschreibt sie aber nie', () => {
    expect(resolveComponentConstraints({ type: 'inverter', data: { watts: 2000 } }).continuousPower).toBe(
      watts(2000)
    );
    expect(
      resolveComponentConstraints({ type: 'inverter', data: { watts: 2000, continuousPower: 1200 } })
        .continuousPower
    ).toBe(watts(1200));
  });

  it('unbekannte Nennspannung erzeugt keine Ebene (kein stiller 12-V-Fallback)', () => {
    expect(
      resolveComponentConstraints({ type: 'battery', data: { nominalVoltage: 230 } }).voltageClass
    ).toBeUndefined();
    expect(resolveComponentConstraints({ type: 'battery', data: {} }).voltageClass).toBeUndefined();
  });

  it('Knoten ohne data bekommt nur die statischen Vorgaben', () => {
    const constraints = resolveComponentConstraints({ type: 'busbar' });
    expect(constraints).toEqual({ allowedDomains: ['DC_12V'], requiredProtection: 'none' });
  });

  it('componentCurrentLimit folgt der Rangfolge Dauer → Entlade → Spitze', () => {
    expect(componentCurrentLimit({ continuousCurrent: amps(50), maxCurrent: amps(200) })).toBe(amps(50));
    expect(componentCurrentLimit({ maxDischargeCurrent: amps(100), maxCurrent: amps(200) })).toBe(amps(100));
    expect(componentCurrentLimit({ maxCurrent: amps(200) })).toBe(amps(200));
    expect(componentCurrentLimit({})).toBeUndefined();
  });

  it('ist deterministisch — gleiche Eingabe, gleiches Ergebnis', () => {
    const node = { type: 'shorePower', data: { rating: 16, acCurrentA: 10 } };
    expect(resolveComponentConstraints(node)).toEqual(resolveComponentConstraints(node));
  });
});
