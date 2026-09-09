import { describe, expect, it } from 'vitest';
import type { FunctionZone } from './functionZones';
import {
  computeFunctionZones,
  getZoneStage,
  ZONE_MERGE_GAP_X,
  ZONE_PAD_X,
  ZONE_PAD_Y,
  ZONE_STAGES,
} from './functionZones';
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from './layout';

interface FixtureNode {
  id: string;
  type: string;
  position: { x: number; y: number };
}

const node = (id: string, type: string, x: number, y: number): FixtureNode => ({
  id,
  type,
  position: { x, y },
});

describe('functionZones', () => {
  it('bildet die fünf Funktionsstufen in Flussrichtung ab', () => {
    expect(ZONE_STAGES.map((stage) => stage.label)).toEqual([
      'Quellen',
      'Laden & Wandeln',
      'Speichern & Verteilen',
      'Wechselrichter',
      'Verbrauchen',
    ]);
    expect(ZONE_STAGES.map((stage) => stage.rank)).toEqual([0, 1, 2, 3, 4]);
  });

  it('liefert zu jedem Rang das Stufen-Metadatum', () => {
    expect(getZoneStage(0)?.key).toBe('sources');
    expect(getZoneStage(4)?.key).toBe('consumers');
    expect(getZoneStage(9)).toBeUndefined();
  });

  it('legt pro besetzter Stufe ein Band an, das die Knotenspalte umschließt', () => {
    // Fünf Bauteile, eines je Stufe, in Flussrichtung nebeneinander.
    const zones = computeFunctionZones([
      node('solar', 'solar', 0, 200),
      node('mppt', 'mpptController', 400, 200),
      node('batt', 'battery', 800, 200),
      node('inv', 'inverter', 1200, 200),
      node('con', 'consumer', 1600, 200),
    ]);

    expect(zones).toHaveLength(5);
    expect(zones.map((zone) => zone.key)).toEqual(['sources', 'charge', 'store', 'inverter', 'consumers']);
    expect(zones.map((zone) => zone.rank)).toEqual([0, 1, 2, 3, 4]);
    expect(zones.map((zone) => zone.nodeCount)).toEqual([1, 1, 1, 1, 1]);

    // Quelle: x = 0 − PAD_X, Breite = Default-Breite + 2×PAD_X.
    const sources = zoneAt(zones, 0);
    expect(sources.x).toBe(-ZONE_PAD_X);
    expect(sources.width).toBe(DEFAULT_NODE_WIDTH + 2 * ZONE_PAD_X);
    // y-Spanne ist global (einheitliche Bandhöhe über alle Stufen).
    for (const zone of zones) {
      expect(zone.y).toBe(200 - ZONE_PAD_Y);
      expect(zone.height).toBe(DEFAULT_NODE_HEIGHT + 2 * ZONE_PAD_Y);
    }
  });

  it('verschmilzt gleichstufige Gruppen, die nah beieinanderliegen', () => {
    const zones = computeFunctionZones([
      node('batt-a', 'battery', 0, 0),
      node('batt-b', 'battery', DEFAULT_NODE_WIDTH + 20, 400), // Lücke 20 px < 72 px
    ]);
    expect(zones).toHaveLength(1);
    const band = zoneAt(zones, 0);
    expect(band.key).toBe('store');
    expect(band.nodeCount).toBe(2);
    expect(band.y).toBe(-ZONE_PAD_Y); // globaler y-Bereich über beide Knoten
    expect(band.height).toBe(400 + DEFAULT_NODE_HEIGHT - 0 + 2 * ZONE_PAD_Y);
  });

  it('trennt Gruppen derselben Stufe, die weit auseinanderliegen', () => {
    const gap = ZONE_MERGE_GAP_X + 40;
    const zones = computeFunctionZones([
      node('con-a', 'consumer', 0, 0),
      node('con-b', 'consumer', DEFAULT_NODE_WIDTH + gap, 0),
    ]);
    expect(zones).toHaveLength(2);
    expect(zones.every((zone) => zone.key === 'consumers')).toBe(true);
  });

  it('lässt leere Stufen aus (keine Band-Lücken-Kacheln)', () => {
    const zones = computeFunctionZones([node('solar', 'solar', 0, 0), node('con', 'consumer', 400, 0)]);
    expect(zones.map((zone) => zone.key)).toEqual(['sources', 'consumers']);
  });

  it('liefert für einen leeren Plan keine Zonen', () => {
    expect(computeFunctionZones([])).toEqual([]);
    expect(computeFunctionZones([node('a', 'solar', 0, 0), node('b', 'solar', 0, 200)])).toHaveLength(1);
  });

  it('nutzt gemessene Maße, sobald React Flow sie liefert', () => {
    const wide = {
      id: 'big',
      type: 'conduit',
      position: { x: 0, y: 0 },
      width: 300,
      height: 180,
    };
    const zones = computeFunctionZones([wide]);
    expect(zoneAt(zones, 0).width).toBe(300 + 2 * ZONE_PAD_X);
  });
});

/** Zugriff mit Laufzeit-Guard (noUncheckedIndexedAccess). */
function zoneAt(zones: readonly FunctionZone[], index: number): FunctionZone {
  const zone = zones[index];
  if (!zone) throw new Error(`Zone an Index ${index} fehlt im Testergebnis`);
  return zone;
}
