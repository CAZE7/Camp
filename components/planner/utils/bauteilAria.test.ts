import type { Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

// Füllt die Registry mit den eingebauten Bauteilen — im App-Überzug besorgt
// das `planner/constants.ts`, hier im isolierten Test muss es der Test selbst tun.
import '../../registry';
import { BAUTEIL_ROLLENBESCHREIBUNG, bauteilName, withBauteilAria } from './bauteilAria';

/**
 * §3.6 · Der Accessible Name lebt am Knotenobjekt, weil React Flow ihn auf den
 * echten Node-Wrapper legt. Geprüft wird hier der Text und der
 * Identitätsvertrag; das tatsächliche DOM prüft
 * `components/nodes/bauteilGruppe.dom.test.tsx` (jsdom) und
 * `tests/e2e/planner-canvas-a11y.spec.ts` (Browser).
 */

const knoten = (teil: Partial<Node> = {}): Node =>
  ({
    id: 'n1',
    position: { x: 0, y: 0 },
    data: {},
    ...teil,
  }) as Node;

const attribute = (node: Node): Record<string, string | undefined> =>
  (node.domAttributes ?? {}) as Record<string, string | undefined>;

describe('bauteilName (§3.6)', () => {
  it('nutzt das Registry-Wort als Typnamen', () => {
    expect(bauteilName(knoten({ type: 'battery' }))).toBe('Batterie');
    expect(bauteilName(knoten({ type: 'consumer230v' }))).toBe('230-V-Gerät');
    expect(bauteilName(knoten({ type: 'shunt' }))).toBe('Batteriemonitor (Shunt)');
  });

  it('hängt das Kürzel an, wenn der Canvas eines vergeben hat', () => {
    expect(bauteilName(knoten({ type: 'battery' }), 'G1')).toBe('Batterie G1');
  });

  it('nennt eine eigene Beschriftung, aber nicht zweimal', () => {
    expect(bauteilName(knoten({ type: 'battery', data: { label: 'Aufbaubatterie' } }), 'G2')).toBe(
      'Batterie G2, Aufbaubatterie'
    );
    expect(bauteilName(knoten({ type: 'battery', data: { label: 'Batterie' } }))).toBe('Batterie');
    expect(bauteilName(knoten({ type: 'battery', data: { label: '   ' } }))).toBe('Batterie');
  });

  it('setzt Auswahl und Befunde hinter einen Gedankenstrich', () => {
    expect(bauteilName(knoten({ type: 'battery', selected: true }))).toBe('Batterie — ausgewählt');
    expect(bauteilName(knoten({ type: 'battery', selected: true, data: { isOverlapping: true } }))).toBe(
      'Batterie — ausgewählt, überlappt ein anderes Element'
    );
  });

  it('benennt Dachobjekte mit Abmessung, weil sie nicht in der Registry stehen', () => {
    expect(bauteilName(knoten({ type: 'roofSolar', data: { width: 120.4, height: 60.6, watts: 200 } }))).toBe(
      'Solarpanel, 120 mal 61 Zentimeter, 200 Watt'
    );
    expect(bauteilName(knoten({ type: 'roofBackground', data: { width: 300, height: 150 } }))).toBe(
      'Dachfläche, 300 mal 150 Zentimeter'
    );
    expect(
      bauteilName(knoten({ type: 'roofWindow', data: { width: 40, height: 40, isInvalid: true } }))
    ).toBe('Dachfenster, 40 mal 40 Zentimeter — ragt aus der Safe Zone');
  });

  it('fällt für einen unbekannten Typ auf das Gattungswort zurück', () => {
    expect(bauteilName(knoten({ type: 'irgendEinKnoten' }))).toBe('Bauteil');
  });

  it('verschweigt Altdaten, die weder endliche Zahl noch Text sind', () => {
    expect(bauteilName(knoten({ type: 'roofSolar', data: { width: '120', watts: NaN } }))).toBe('Solarpanel');
  });
});

describe('withBauteilAria (§3.6)', () => {
  it('setzt die lokale Rollenbeschreibung über domAttributes', () => {
    const behandelt = withBauteilAria(knoten({ type: 'battery' }));
    expect(attribute(behandelt)['aria-roledescription']).toBe(BAUTEIL_ROLLENBESCHREIBUNG);
    expect(behandelt.ariaLabel).toBe('Batterie');
  });

  it('lässt bestehende domAttribute erhalten', () => {
    // `data-*` lässt der Typ der Bibliothek in domAttributes nicht zu
    // (Omit über HTMLAttributes) — `title` schon.
    const behandelt = withBauteilAria(knoten({ type: 'battery', domAttributes: { title: 'G1' } }));
    expect(behandelt.domAttributes?.title).toBe('G1');
  });

  it('gibt einen unveränderten Knoten als dasselbe Objekt zurück', () => {
    const vorher = knoten({ type: 'battery' });
    const behandelt = withBauteilAria(vorher);
    // Der erste Aufruf muss ein neues Objekt sein: der Knoten hatte weder Name
    // noch Rollenbeschreibung. Danach darf der Vertrag greifen.
    expect(behandelt).not.toBe(vorher);
    expect(withBauteilAria(behandelt)).toBe(behandelt);
  });

  it('überschreibt einen Namen, der nicht mehr zum Zustand passt', () => {
    const behandelt = withBauteilAria(knoten({ type: 'battery', ariaLabel: 'Batterie — ausgewählt' }));
    expect(behandelt.ariaLabel).toBe('Batterie');
  });

  it('lässt den Deko-Rahmen des Hauptstromkreises unangetastet', () => {
    // Der Backbone-Gruppenknoten ist bewusst nicht fokussierbar
    // (utils/backboneGroup.ts) und soll deshalb keine Bauteil-Gruppe sein.
    const rahmen = knoten({ type: 'backboneGroup', focusable: false });
    expect(withBauteilAria(rahmen)).toBe(rahmen);
  });

  it('setzt kein aria-selected — die Rolle group kennt es nicht', () => {
    const behandelt = withBauteilAria(knoten({ type: 'battery', selected: true }));
    expect(attribute(behandelt)['aria-selected']).toBeUndefined();
    expect(behandelt.ariaLabel).toContain('ausgewählt');
  });
});
