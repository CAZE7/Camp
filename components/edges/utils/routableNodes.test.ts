import { describe, expect, it } from 'vitest';
import {
  collectRoutableNodes,
  isPresentationOnlyNode,
  PRESENTATION_GROUP_TYPE,
  PRESENTATION_ONLY_FLAG,
  routableNodes,
} from './routableNodes';

/**
 * Regression (Bug 2026-09-26, „Routing springt zwischen 0 und 20 Zwängen“):
 * Der Rahmen des Hauptstromkreises ist reine Darstellung und darf den Router
 * nicht erreichen. Vorher zählte er als Bauteil (jedes Kabel, das ein
 * Kern-Bauteil verlässt, schnitt seinen Rand = I1) und als Hindernis
 * (Umwege) — beides abhängig davon, ob React Flow ihn gerade gemessen hatte.
 */

const component = (id: string, type = 'consumer') => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label: id },
});

const frame = (overrides: Record<string, unknown> = {}) => ({
  id: '__planner-backbone-group',
  type: PRESENTATION_GROUP_TYPE,
  position: { x: -44, y: -56 },
  width: 844,
  height: 392,
  data: { label: 'Hauptstromkreis', [PRESENTATION_ONLY_FLAG]: true },
  ...overrides,
});

describe('Präsentations-Grenze des Routings', () => {
  it('erkennt den Hauptstromkreis-Rahmen schon am Typ', () => {
    expect(isPresentationOnlyNode({ type: PRESENTATION_GROUP_TYPE })).toBe(true);
    // Auch ohne generischen Marker: gespeicherte Pläne bleiben geschützt.
    expect(isPresentationOnlyNode({ type: PRESENTATION_GROUP_TYPE, data: {} })).toBe(true);
  });

  it('erkennt den generischen Marker in `data` (künftige Overlays)', () => {
    expect(isPresentationOnlyNode({ type: 'focusOverlay', data: { presentationOnly: true } })).toBe(true);
    expect(isPresentationOnlyNode({ type: 'focusOverlay', data: { presentationOnly: false } })).toBe(false);
    // Nur `true` zählt — kein truthy-Fang.
    expect(isPresentationOnlyNode({ type: 'focusOverlay', data: { presentationOnly: 'yes' } })).toBe(false);
  });

  it('hält Bauteile für Routing-relevant', () => {
    expect(isPresentationOnlyNode(component('battery', 'battery'))).toBe(false);
    expect(isPresentationOnlyNode({ type: 'consumer', data: { label: 'Lampe', watts: 5 } })).toBe(false);
  });

  it('behandelt fehlende Knoten nicht als Darstellung (Aufruferfehler bleibt sichtbar)', () => {
    expect(isPresentationOnlyNode(null)).toBe(false);
    expect(isPresentationOnlyNode(undefined)).toBe(false);
  });

  it('routableNodes gibt dasselbe Array zurück, wenn nichts gefiltert wird', () => {
    const nodes = [component('battery', 'battery'), component('load')];
    expect(routableNodes(nodes)).toBe(nodes);
  });

  it('routableNodes entfernt genau die Darstellungs-Knoten', () => {
    const battery = component('battery', 'battery');
    const overlay = { id: 'overlay', type: 'overlay', data: { presentationOnly: true } };
    const load = component('load');
    const nodes = [frame(), battery, overlay, load];

    const routable = routableNodes(nodes);

    expect(routable).toEqual([battery, load]);
    expect(routable).not.toBe(nodes);
    // Die Bauteil-Objekte selbst bleiben identisch (keine Kopien).
    expect(routable[0]).toBe(battery);
    expect(routable[1]).toBe(load);
  });

  it('collectRoutableNodes trennt eine Iterable (nodeLookup.values()) in beide Listen', () => {
    const battery = component('battery', 'battery');
    const group = frame();
    const load = component('load');

    const { routable, presentation } = collectRoutableNodes(
      new Map([
        [group.id, group],
        [battery.id, battery],
        [load.id, load],
      ]).values()
    );

    expect(routable).toEqual([battery, load]);
    expect(presentation).toEqual([group]);
  });
});
