import { describe, expect, it } from 'vitest';
import type { Node } from '../domain/graph';
import { isHouseBattery, reachesHouseBattery } from './validation';

/**
 * Pfadprüfung „Ladebooster erreicht eine Aufbaubatterie" (Regel E2 / TOPO-002).
 *
 * Anlass (Prüfbericht 2026-09-28): Regel E prüfte nur, DASS der Booster einen
 * Ein- und einen Ausgang hat. Eine Kante Booster → Schiene genügte, auch wenn
 * die Schiene mit keiner Aufbaubatterie verbunden war. Diese Testebene hält
 * die Fachlogik ohne React fest; die Meldung selbst prüft
 * `components/planner/hooks/useLiveValidation.test.ts`.
 */

const node = (id: string, type: string, data: Record<string, unknown> = {}): Node =>
  ({ id, type, position: { x: 0, y: 0 }, data }) as Node;

const battery = (id: string, data: Record<string, unknown> = {}): Node => node(id, 'battery', data);

describe('isHouseBattery', () => {
  it('erkennt die Aufbaubatterie an der Rolle', () => {
    expect(isHouseBattery(battery('h', { role: 'house' }))).toBe(true);
    expect(isHouseBattery(battery('s', { role: 'starter' }))).toBe(false);
  });

  it('die explizite Rolle schlägt die Label-Heuristik (AUDIT AUTO-003)', () => {
    // Ein umbenanntes Bauteil darf seine Aufgabe nicht still wechseln.
    expect(isHouseBattery(battery('x', { role: 'house', label: 'Starterbatterie' }))).toBe(true);
    expect(isHouseBattery(battery('x', { role: 'starter', label: 'Aufbaubatterie' }))).toBe(false);
  });

  it('fällt ohne Rolle auf das Label zurück', () => {
    expect(isHouseBattery(battery('x', { label: 'Aufbaubatterie 200 Ah' }))).toBe(true);
    expect(isHouseBattery(battery('x', { label: 'Starterbatterie' }))).toBe(false);
    expect(isHouseBattery(battery('x', { label: 'Starter Battery' }))).toBe(false);
    // Ohne jede Angabe ist die Batterie keine belegte Starterseite — sie zählt
    // zur Hausseite (konservativ: keine erfundene Starterrolle).
    expect(isHouseBattery(battery('x', {}))).toBe(true);
  });

  it('gilt nur für Batterien', () => {
    expect(isHouseBattery(node('b', 'busbar', { role: 'house' }))).toBe(false);
    expect(isHouseBattery(node('s', 'shunt'))).toBe(false);
  });
});

describe('reachesHouseBattery', () => {
  const plan = () => ({
    // Starterseite hängt DIREKT am Booster — sie darf die Prüfung nicht erfüllen.
    starter: battery('starter', { role: 'starter' }),
    booster: node('booster', 'dcdcCharger'),
    plusRail: node('plusRail', 'busbar', { role: 'positive' }),
    minusRail: node('minusRail', 'busbar', { role: 'negative' }),
    house: battery('house', { role: 'house' }),
  });

  it('findet den Pfad über die Schienen (undirektional)', () => {
    const p = plan();
    // Verdrahtung wie AutoWire sie erzeugt: Batterie → Schiene, Lader → Schiene.
    const edges = [
      { source: 'starter', target: 'booster' },
      { source: 'booster', target: 'plusRail' },
      { source: 'booster', target: 'minusRail' },
      { source: 'house', target: 'plusRail' },
      { source: 'house', target: 'minusRail' },
    ];
    expect(
      reachesHouseBattery('booster', [p.starter, p.booster, p.plusRail, p.minusRail, p.house], edges)
    ).toBe(true);
  });

  it('meldet false, wenn nur die Starterseite am Booster hängt', () => {
    const p = plan();
    // Der gemeldete Fall: Schienen ohne Aufbaubatterie.
    const edges = [
      { source: 'starter', target: 'booster' },
      { source: 'booster', target: 'plusRail' },
      { source: 'booster', target: 'minusRail' },
    ];
    expect(
      reachesHouseBattery('booster', [p.starter, p.booster, p.plusRail, p.minusRail, p.house], edges)
    ).toBe(false);
  });

  it('zählt die Starterbatterie nicht als Ziel', () => {
    const p = plan();
    const edges = [{ source: 'starter', target: 'booster' }];
    // Erreichbar ist die Starterseite — genau das ist NICHT die Prüfung.
    expect(reachesHouseBattery('booster', [p.starter, p.booster], edges)).toBe(false);
  });

  it('meldet false, wenn die Aufbaubatterie in einer fremden Insel liegt', () => {
    const p = plan();
    const edges = [
      { source: 'booster', target: 'plusRail' },
      { source: 'house', target: 'minusRail' },
    ];
    expect(reachesHouseBattery('booster', [p.booster, p.plusRail, p.minusRail, p.house], edges)).toBe(false);
  });

  it('meldet false ohne Aufbaubatterie im Plan', () => {
    const p = plan();
    const edges = [{ source: 'booster', target: 'plusRail' }];
    expect(reachesHouseBattery('booster', [p.booster, p.plusRail], edges)).toBe(false);
  });
});
