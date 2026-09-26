import { beforeEach, describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { isPresentationOnlyNode } from '../../edges/utils/routableNodes';
import { BACKBONE_GROUP_ID, resetBackboneGroupCache, withBackboneGroup } from './backboneGroup';

const node = (id: string, type: string, x: number, y: number): Node => ({
  id,
  type,
  position: { x, y },
  width: 192,
  height: 120,
  data: {},
});

describe('backbone visual grouping', () => {
  // Der Rahmen wird über Aufrufe hinweg zwischengespeichert; jeder Test
  // startet mit leerem Cache (sonst hinge er an der Reihenfolge).
  beforeEach(resetBackboneGroupCache);

  const nodes = [
    node('battery', 'battery', 100, 100),
    node('shunt', 'shunt', 400, 240),
    node('load', 'consumer', 800, 100),
  ];

  it('adds a non-interactive frame around core nodes only', () => {
    const grouped = withBackboneGroup(nodes, true);
    const frame = grouped.find((item) => item.id === BACKBONE_GROUP_ID)!;
    expect(frame.type).toBe('backboneGroup');
    expect(frame.selectable).toBe(false);
    expect(frame.draggable).toBe(false);
    expect(frame.position.x).toBeLessThan(100);
    expect(frame.position.y).toBeLessThan(100);
    expect(Number(frame.style?.width)).toBeGreaterThan(492);
  });

  it('does nothing when disabled or fewer than two core nodes exist', () => {
    expect(withBackboneGroup(nodes, false)).toBe(nodes);
    const oneCore = [nodes[0]!, nodes[2]!];
    expect(withBackboneGroup(oneCore, true)).toBe(oneCore);
  });
});

/**
 * Regression (Bug 2026-09-26, „Routing springt zwischen 0 und 20“): Ein bei
 * jedem Store-Schreibvorgang neu erzeugtes Rahmen-Objekt hat React Flow dazu
 * gebracht, den Rahmen neu zu übernehmen und neu zu messen — und das war über
 * die Layout-Signatur ein zweiter Routing-Lauf mit anderem Hindernisbild.
 * Gleiche Geometrie muss dasselbe Objekt liefern.
 */
describe('Stabile Identität des Rahmen-Knotens', () => {
  const nodes = [
    node('battery', 'battery', 100, 100),
    node('shunt', 'shunt', 400, 240),
    node('load', 'consumer', 800, 100),
  ];

  beforeEach(resetBackboneGroupCache);

  it('gleiche Kern-Geometrie ⇒ dasselbe Rahmen-Objekt (auch bei neu gebauten Arrays)', () => {
    const first = withBackboneGroup(nodes, true);
    // Ein Store-Schreibvorgang liefert neue Array- und Node-Objekte mit
    // identischer Geometrie (React-Flow-`applyNodeChanges`).
    const rebuilt = nodes.map((item) => ({ ...item, data: { ...item.data } }));
    expect(rebuilt[0]).not.toBe(nodes[0]);

    const second = withBackboneGroup(rebuilt, true);

    expect(second[0]).toBe(first[0]);
  });

  it('geänderte Kern-Geometrie ⇒ neues Rahmen-Objekt mit neuer Box', () => {
    const first = withBackboneGroup(nodes, true)[0]!;
    const moved = nodes.map((item) =>
      item.id === 'battery' ? { ...item, position: { x: 200, y: 100 } } : item
    );

    const second = withBackboneGroup(moved, true)[0]!;

    expect(second).not.toBe(first);
    expect(second.position.x).toBe(200 - 44);
  });

  it('trägt den Darstellungs-Marker und die beabsichtigte Größe', () => {
    const frame = withBackboneGroup(nodes, true)[0]!;

    expect(isPresentationOnlyNode(frame)).toBe(true);
    expect(frame.data?.presentationOnly).toBe(true);
    // Die Box hängt nicht an der DOM-Messung: `width/height` sind gesetzt.
    expect(frame.width).toBe(Number(frame.style?.width));
    expect(frame.height).toBe(Number(frame.style?.height));
  });

  it('nach dem Ausschalten startet die Gruppierung mit frischer Box', () => {
    const first = withBackboneGroup(nodes, true)[0]!;
    expect(withBackboneGroup(nodes, false)).toBe(nodes);
    const second = withBackboneGroup(nodes, true)[0]!;
    expect(second).toEqual(first);
  });
});
