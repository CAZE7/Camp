import { describe, expect, it } from 'vitest';
import { BUILTIN_COMPONENT_SPECS } from '../../components/registry/builtinComponents';
import type { PlannerNodeType } from '../../components/nodes/types';
import {
  ELECTRIC_NODE_TYPES,
  NON_CONNECTABLE_NODE_TYPES,
  WATER_NODE_TYPES,
  busbarRoleOf,
  handlePolarity,
  isConnectableNodeType,
} from './connectionPolicy';
import { SOLAR_NODE_TYPES } from './handleDomains';

/**
 * lib/domain/connectionPolicy.test.ts — die Deny-by-default-Liste wird gemessen.
 *
 * AUDIT V1: `isConnectionAllowed` war fail-open, weil nichts deklarieren musste,
 * welche Bauteiltypen der Planer überhaupt kennt. Diese Liste lebt jetzt in
 * `lib/domain/connectionPolicy.ts` — und nach ARCH-001 darf `lib/` nicht von
 * `components/` abhängen, also ist sie eine zweite Tabelle neben der Registry.
 * Dasselbe Muster wie bei `handleDomains.test.ts`: Der Test hält beide zusammen,
 * damit keine Kopie unbemerkt auseinanderläuft.
 */

/** Typen, die der Planer kennt, die aber KEIN Katalog-Bauteil sind. */
const NON_REGISTRY_TYPES: readonly string[] = ['roofSolar', 'roofWindow', 'roofBackground'];

describe('connectionPolicy — eine Typ-Tabelle, zwei Verbraucher (AUDIT V1)', () => {
  it('jeder Registry-Eintrag steht im richtigen Modus in der Lib-Tabelle', () => {
    const mismatches: string[] = [];
    for (const spec of BUILTIN_COMPONENT_SPECS) {
      const inElectric = ELECTRIC_NODE_TYPES.includes(spec.id);
      const inWater = WATER_NODE_TYPES.includes(spec.id);
      const expectedElectric = spec.mode === 'electric';
      if (inElectric !== expectedElectric || inWater === expectedElectric) {
        mismatches.push(
          `${spec.id}: Registry mode=${spec.mode}, Lib electric=${inElectric} water=${inWater}`
        );
      }
    }
    expect(
      mismatches,
      'Die Deny-by-default-Liste in lib/domain/connectionPolicy.ts ist nicht mehr deckungsgleich ' +
        'mit components/registry/builtinComponents.ts — bitte nachziehen.\n  ' +
        mismatches.join('\n  ')
    ).toEqual([]);
  });

  it('enthält keinen Typ, den weder Registry noch Dachelemente kennen', () => {
    const known = new Set<string>([...BUILTIN_COMPONENT_SPECS.map((spec) => spec.id), ...NON_REGISTRY_TYPES]);
    const orphans = [...ELECTRIC_NODE_TYPES, ...WATER_NODE_TYPES, ...NON_CONNECTABLE_NODE_TYPES].filter(
      (type) => !known.has(type)
    );
    expect(orphans, 'Toter Eintrag: diesen Bauteiltyp gibt es nirgends').toEqual([]);
  });

  it('deckt jeden deklarierten Node-Typ der App ab (keine Lücke im Deny-by-default)', () => {
    // `PlannerNodeType` ist die Typ-Union der App (components/nodes/types.ts).
    // Ein neuer Bauteiltyp, der hier nicht auftaucht, wäre beim Ziehen
    // unerreichbar — deshalb wird die Abdeckung gegen die Union geprüft.
    const declared: PlannerNodeType[] = [
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
    const covered = [...ELECTRIC_NODE_TYPES, ...WATER_NODE_TYPES, ...NON_CONNECTABLE_NODE_TYPES];
    const missing = declared.filter((type) => !covered.includes(type));
    expect(missing, 'Diese Typen sind in keiner Liste — sie wären nie verbindbar').toEqual([]);
  });

  it('Solar-Typen sind elektrisch verbindbar, Dachelemente ohne Anschluss nicht', () => {
    for (const solarType of SOLAR_NODE_TYPES) {
      expect(isConnectableNodeType(solarType, 'electric')).toBe(true);
    }
    expect(isConnectableNodeType('roofWindow', 'electric')).toBe(false);
    expect(isConnectableNodeType('roofBackground', 'electric')).toBe(false);
    // Modus-Trennung:
    expect(isConnectableNodeType('pump', 'water')).toBe(true);
    expect(isConnectableNodeType('pump', 'electric')).toBe(false);
    expect(isConnectableNodeType('battery', 'water')).toBe(false);
    // Unbekannt/leer:
    expect(isConnectableNodeType(undefined, 'electric')).toBe(false);
    expect(isConnectableNodeType('', 'electric')).toBe(false);
    expect(isConnectableNodeType('dachluke', 'electric')).toBe(false);
  });

  it('Polarität ist eine Rolle, kein Namens-Präfix', () => {
    // Die echten Handle-Ids der Bauteile (components/nodes/*.tsx):
    for (const spec of BUILTIN_COMPONENT_SPECS) {
      for (const handle of spec.handles) {
        const expected = handle.id === 'plus' ? 'plus' : handle.id === 'minus' ? 'minus' : null;
        expect(handlePolarity(handle.id), `${spec.id}.${handle.id}`).toBe(expected);
      }
    }
    // Fantasie-Ids, die `includes('plus')` früher zu Polen machte:
    expect(handlePolarity('in-plus')).toBeNull();
    expect(handlePolarity('surplus')).toBeNull();
    expect(handlePolarity('minus-sensor')).toBeNull();
    expect(handlePolarity(null)).toBeNull();
    expect(handlePolarity(undefined)).toBeNull();
  });

  it('Sammelschienen-Rolle: data.role schlägt Label, sonst unknown', () => {
    expect(busbarRoleOf({ role: 'positive' })).toBe('positive');
    expect(busbarRoleOf({ role: 'negative' })).toBe('negative');
    expect(busbarRoleOf({ label: 'Plus-Schiene' })).toBe('positive');
    expect(busbarRoleOf({ label: 'Minus-Schiene' })).toBe('negative');
    expect(busbarRoleOf({ role: 'positive', label: 'Minus-Schiene' })).toBe('positive');
    expect(busbarRoleOf({})).toBe('unknown');
    expect(busbarRoleOf(undefined)).toBe('unknown');
  });
});
