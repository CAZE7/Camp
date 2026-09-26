import { beforeEach, describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  COLLISION_CLASS,
  DRAG_ARMED_CLASS,
  resetNodeInteractionStateCache,
  withNodeInteractionState,
} from './nodeInteractionState';

/**
 * Regression (Bug 2026-09-26): `interactiveNodes` erzeugte bei jedem Aufruf
 * neue Node-Objekte (`{ ...node, className }`). React Flow 12 übernimmt einen
 * Knoten nur bei identischem Objekt unverändert in seinen Bestand
 * (`adoptUserNodes`, `checkEquality`) — sonst baut es den internen Knoten neu
 * auf und misst neu. Genau dieser Neuaufbau trieb die Re-Routing-Schleife.
 */

const makeNode = (id = 'load'): Node => ({
  id,
  type: 'consumer',
  position: { x: 0, y: 0 },
  className: 'planner-node',
  data: { label: 'Lampe' },
});

const HANDLE = '.node-drag-handle';

describe('withNodeInteractionState — stabile Knoten-Identität', () => {
  beforeEach(resetNodeInteractionStateCache);

  it('ohne Flags kommt der Knoten unverändert zurück (keine Kopie)', () => {
    const node = makeNode();
    expect(withNodeInteractionState(node, { collision: false, dragHandle: 'inherit' })).toBe(node);
  });

  it('gleiche Flags ⇒ dasselbe Objekt', () => {
    const node = makeNode();
    const first = withNodeInteractionState(node, { collision: true, dragHandle: 'inherit' });
    const second = withNodeInteractionState(node, { collision: true, dragHandle: 'inherit' });
    expect(second).toBe(first);
  });

  it('Kollision hängt nur die Kollisionsklasse an (feiner Zeiger)', () => {
    const node = makeNode();
    const wrapped = withNodeInteractionState(node, { collision: true, dragHandle: 'inherit' });
    expect(wrapped.className).toBe(`planner-node ${COLLISION_CLASS}`);
    expect(wrapped.dragHandle).toBeUndefined();
    expect(node.className).toBe('planner-node'); // Eingang bleibt unangetastet
  });

  it('Touch: ziehbarer Knoten bekommt den Griff als dragHandle', () => {
    const node = makeNode();
    const wrapped = withNodeInteractionState(node, {
      collision: false,
      dragHandle: 'handle',
      handleSelector: HANDLE,
    });
    expect(wrapped.dragHandle).toBe(HANDLE);
    expect(wrapped.className).toBe('planner-node');
  });

  it('Touch: langes Drücken gibt den ganzen Knoten frei (dragHandle undefined + Klasse)', () => {
    const node = makeNode();
    const wrapped = withNodeInteractionState(node, { collision: false, dragHandle: 'armed' });
    expect(wrapped.dragHandle).toBeUndefined();
    expect(wrapped.className).toBe(`planner-node ${DRAG_ARMED_CLASS}`);
  });

  it('Touch + Kollision kombiniert beide Klassen', () => {
    const node = makeNode();
    const armed = withNodeInteractionState(node, { collision: true, dragHandle: 'armed' });
    const handle = withNodeInteractionState(node, {
      collision: true,
      dragHandle: 'handle',
      handleSelector: HANDLE,
    });
    expect(armed.className).toBe(`planner-node ${DRAG_ARMED_CLASS} ${COLLISION_CLASS}`);
    expect(handle.className).toBe(`planner-node ${COLLISION_CLASS}`);
  });

  it('ein ersetzter Basis-Knoten erzeugt genau eine neue Variante', () => {
    const node = makeNode();
    const first = withNodeInteractionState(node, { collision: true, dragHandle: 'inherit' });
    const rebuilt: Node = { ...node };
    const second = withNodeInteractionState(rebuilt, { collision: true, dragHandle: 'inherit' });

    expect(second).not.toBe(first);
    expect(second.className).toBe(first.className);
    // … und bleibt danach stabil.
    expect(withNodeInteractionState(rebuilt, { collision: true, dragHandle: 'inherit' })).toBe(second);
  });
});
