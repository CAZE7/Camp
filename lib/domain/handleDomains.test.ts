import { describe, expect, it } from 'vitest';
import { BUILTIN_COMPONENT_SPECS } from '../../components/registry/builtinComponents';
import { getEdgeDomain, getHandleDomain } from '../electrical';
import { SOLAR_NODE_TYPES, handleDomain } from './handleDomains';
import { COPPER_CONDUCTIVITY_MS_PER_MM2, COPPER_RESISTIVITY_OHM_MM2_PER_M } from '../materials';

/**
 * lib/domain/handleDomains.test.ts — die Domänen-Autorität wird gemessen.
 *
 * AUDIT ELE-007: Es gab ZWEI Funktionen mit ZWEI Tabellen für dieselbe Frage.
 * `getHandleDomain('inverter','ac_in','source')` war AC_230V, während
 * `getEdgeDomain('inverter','battery','ac_in',…)` DC_12V ergab — beim Ziehen
 * galt eine Domäne, beim Speichern eine andere. Dazu kam eine dritte Kopie als
 * statisches `domain`-Feld in der Bauteil-Registry.
 *
 * Dieser Test hält alle drei zusammen: Die Registry (Anzeige/Sidebar), die
 * Handle-Funktion (Ziehen, isValidConnection) und die Kanten-Funktion
 * (Speichern/Dimensionierung) müssen dieselbe Antwort geben.
 */

describe('Domänen: eine Autorität, drei Verbraucher (AUDIT ELE-007)', () => {
  it('jedes deklarierte Registry-Handle stimmt mit handleDomain überein', () => {
    const mismatches: string[] = [];
    for (const component of BUILTIN_COMPONENT_SPECS) {
      for (const handle of component.handles) {
        const expected = handle.domain;
        if (expected !== 'DC_12V' && expected !== 'AC_230V') continue; // Wasser/Leerrohr
        const actual = handleDomain(component.id, handle.id, handle.type);
        if (actual !== expected) {
          mismatches.push(
            `${component.id}.${handle.id} (${handle.type}): Registry sagt ${expected}, handleDomain sagt ${actual}`
          );
        }
      }
    }
    expect(
      mismatches,
      'Eine vierte Kopie der Zuordnung darf nicht entstehen — bitte lib/domain/handleDomains.ts ändern.\n  ' +
        mismatches.join('\n  ')
    ).toEqual([]);
  });

  it('getHandleDomain und getEdgeDomain antworten rollenbewusst identisch', () => {
    // Solar-Knoten sind die dokumentierte Ausnahme: ihre DOMÄNE ist 'Solar'
    // (eigene Kategorie), nicht AC/DC. getHandleDomain kennt nur AC/DC und
    // liefert dort konservativ DC — die Kantenfunktion hat Vorrang (eigener
    // Test unten).
    const nodeTypes = Array.from(
      new Set(BUILTIN_COMPONENT_SPECS.map((c) => c.id).filter((id) => !SOLAR_NODE_TYPES.includes(id)))
    );
    const handleIds = Array.from(
      new Set(
        BUILTIN_COMPONENT_SPECS.flatMap((c) => c.handles.map((h) => h.id)).concat([
          'ac_in',
          'plus',
          'minus',
          'ac_out',
        ])
      )
    );
    const mismatches: string[] = [];
    for (const nodeType of nodeTypes) {
      for (const handleId of handleIds) {
        for (const role of ['source', 'target'] as const) {
          const viaHandle = getHandleDomain(nodeType, handleId, role);
          // Die Kantenfunktion wendet dieselbe Tabelle richtungsbewusst an:
          // als Quelle gegen einen neutralen DC-Gegenpol …
          const viaEdgeSource = getEdgeDomain(nodeType, 'busbar', handleId, 'plus');
          if (role === 'source' && viaHandle !== viaEdgeSource) {
            mismatches.push(
              `${nodeType}.${handleId} als Quelle: Handle=${viaHandle}, Kante=${viaEdgeSource}`
            );
          }
          // … und als Ziel gegen einen neutralen DC-Gegenpol.
          const viaEdgeTarget = getEdgeDomain('busbar', nodeType, 'plus', handleId);
          if (role === 'target' && viaHandle !== viaEdgeTarget) {
            mismatches.push(`${nodeType}.${handleId} als Ziel: Handle=${viaHandle}, Kante=${viaEdgeTarget}`);
          }
        }
      }
    }
    expect(mismatches, mismatches.join('\n')).toEqual([]);
  });

  it('der konkrete Befund ist behoben: ac_in ist nur als ZIEL 230 V', () => {
    expect(getHandleDomain('inverter', 'ac_in', 'target')).toBe('AC_230V');
    expect(getHandleDomain('inverter', 'ac_in', 'source')).toBe('DC_12V');
    expect(getEdgeDomain('inverter', 'battery', 'ac_in', 'plus')).toBe('DC_12V');
    expect(getEdgeDomain('shorePower', 'inverter', 'plus', 'ac_in')).toBe('AC_230V');
  });

  it('Mischdomäne acBatteryCharger: Landstrom hinein AC, Ladung hinaus DC', () => {
    expect(getHandleDomain('acBatteryCharger', 'plus', 'target')).toBe('AC_230V');
    expect(getHandleDomain('acBatteryCharger', 'plus', 'source')).toBe('DC_12V');
    expect(getHandleDomain('acBatteryCharger', 'minus', 'source')).toBe('DC_12V');
    expect(getEdgeDomain('shorePower', 'acBatteryCharger', 'plus', 'plus')).toBe('AC_230V');
    expect(getEdgeDomain('acBatteryCharger', 'battery', 'plus', 'plus')).toBe('DC_12V');
  });

  it('Solar hat Vorrang vor AC/DC (Kantenebene)', () => {
    expect(getEdgeDomain('solar', 'mpptController', 'plus', 'plus')).toBe('Solar');
    expect(getEdgeDomain('roofSolar', 'battery', 'plus', 'plus')).toBe('Solar');
  });
});

describe('Kupfer-Kennwerte: eine Quelle (AUDIT ELE-010)', () => {
  it('κ und ρ sind konsistent (ρ = 1/κ) und der Praxiswert 0,0175 ist nah dran', () => {
    const fromConductivity = 1 / COPPER_CONDUCTIVITY_MS_PER_MM2;
    expect(COPPER_RESISTIVITY_OHM_MM2_PER_M).toBeCloseTo(fromConductivity, 3);
    // Der Modellwert 0,0175 ist ≤ 2 % pessimistischer als 1/58 — das ist die
    // sichere Richtung (mehr Widerstand, weniger Ik).
    expect(COPPER_RESISTIVITY_OHM_MM2_PER_M).toBeGreaterThanOrEqual(fromConductivity);
    expect(COPPER_RESISTIVITY_OHM_MM2_PER_M / fromConductivity).toBeLessThan(1.02);
  });
});
