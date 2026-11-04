import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react';
import { Position, ReactFlow, ReactFlowProvider, type Node, type NodeChange } from '@xyflow/react';
import { describe, expect, it, vi } from 'vitest';

import { buildNodeTypes } from '../registry';
import { withBauteilAria } from '../planner/utils/bauteilAria';

/**
 * Prüfgrundlage ist das **echte DOM** von React Flow, nicht das Mock aus
 * `FlowCanvas.test.tsx`: Nur hier zeigt sich, dass `domAttributes` den
 * hartgeschriebenen Rollenwert der Bibliothek wirklich überschreibt und dass
 * keine zweite Gruppe in der Karte bleibt (Spezifikation §3.6).
 *
 * Die Bauteile laufen durch `withBauteilAria` — denselben Aufruf, den
 * `FlowCanvas.tsx:867` und `app/tools/dach/page.tsx` verwenden.
 */

const batterienKnoten: Node = withBauteilAria(
  {
    id: 'bat-1',
    type: 'battery',
    position: { x: 0, y: 0 },
    data: { label: 'Aufbaubatterie' },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  } as Node,
  'B1'
);

// Der Rahmen des Hauptstromkreises ist Dekoration und bewusst nicht
// fokussierbar (utils/backboneGroup.ts) — er soll keine Bauteil-Gruppe sein.
const rahmenKnoten: Node = withBauteilAria({
  id: '__planner-backbone-group',
  type: 'backboneGroup',
  position: { x: -10, y: -10 },
  focusable: false,
  data: { presentationOnly: true },
} as Node);

const knoten: Node[] = [batterienKnoten, rahmenKnoten];

const zeichene = (onNodesChange = vi.fn()) => {
  const { rerender } = render(
    <ReactFlowProvider>
      <ReactFlow nodes={knoten} edges={[]} nodeTypes={buildNodeTypes()} onNodesChange={onNodesChange} />
    </ReactFlowProvider>
  );
  return { rerender, onNodesChange };
};

const wrapper = (id: string) => document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement;

describe('Bauteilgruppe im echten DOM (§3.6)', () => {
  it('hat genau ein Group-Element je Bauteil', () => {
    zeichene();
    const batteriej = wrapper('bat-1');
    expect(batteriej.getAttribute('role')).toBe('group');
    // Keine verschachtelte Gruppe: die Karte trägt keine Rolle mehr.
    expect(batteriej.querySelectorAll('[role="group"]')).toHaveLength(0);
    // Und die Karte nennt sich auch nicht mehr selbst.
    expect(batteriej.querySelector('[aria-label]')).toBeNull();
  });

  it('überschreibt den Bibliothekswert „node" mit der lokalen Rollenbeschreibung', () => {
    zeichene();
    expect(wrapper('bat-1').getAttribute('aria-roledescription')).toBe('Bauteil');
  });

  it('gibt dem Wrapper einen aussagekräftigen, lokalisierten Namen', () => {
    zeichene();
    expect(wrapper('bat-1').getAttribute('aria-label')).toBe('Batterie B1, Aufbaubatterie');
  });

  it('macht den Deko-Rahmen nicht zum Bauteil', () => {
    zeichene();
    // Der Rahmen ist nicht fokussierbar, also setzt die Bibliothek keine Rolle
    // (§3.6 Punkt 3). Ihr hartgeschriebenes `aria-roledescription="node"` bleibt
    // an einem Element ohne Rolle wirkungslos — bewusst nicht überschrieben:
    // eine Deko als „Bauteil" anzubieten wäre eine falsche Aussage.
    const rahmen = wrapper('__planner-backbone-group');
    expect(rahmen.getAttribute('role')).toBeNull();
    expect(rahmen.getAttribute('aria-label')).toBeNull();
    expect(rahmen.getAttribute('aria-roledescription')).toBe('node');
  });

  it('setzt kein aria-selected an der Rolle group', () => {
    zeichene();
    expect(wrapper('bat-1').hasAttribute('aria-selected')).toBe(false);
  });

  it('ist per Tastatur erreichbar und meldet die Auswahl an', () => {
    const { onNodesChange } = zeichene();
    const batteriej = wrapper('bat-1');
    expect(batteriej.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(batteriej, { key: 'Enter', code: 'Enter' });
    const wahlen = onNodesChange.mock.calls
      .flat()
      .flatMap((anderung) => (anderung as NodeChange[]) ?? [])
      .filter((anderung) => anderung.type === 'select');
    expect(wahlen.length).toBeGreaterThan(0);
    expect((wahlen[0] as { selected?: boolean }).selected).toBe(true);
  });

  it('nennt den Auswahlzustand im Accessible Name', () => {
    // Dasselbe Bauteil, einmal ausgewählt: der Name trägt den Zustand, weil
    // role="group" kein gültiges aria-selected kennt.
    const ausgewaehlt = withBauteilAria({ ...batterienKnoten, selected: true }, 'B1');
    expect(ausgewaehlt.ariaLabel).toBe('Batterie B1, Aufbaubatterie — ausgewählt');
    render(
      <ReactFlowProvider>
        <ReactFlow nodes={[ausgewaehlt]} edges={[]} nodeTypes={buildNodeTypes()} />
      </ReactFlowProvider>
    );
    expect(screen.getAllByText('Aufbaubatterie').length).toBeGreaterThan(0);
  });

  it('führt in keiner Bauteil-Karte eine eigene Rolle oder ein eigenes aria-label', () => {
    // §3.6 Punkt 4: die Karte trägt die Rolle nicht mehr, wenn der Wrapper sie
    // schon hat. Diese Prüfung läuft über den Quelltext, damit eine später
    // ergänzte Gruppenrolle nicht zuerst im Browser auffällt.
    const ordner = resolve(process.cwd(), 'components/nodes');
    const fehl: string[] = [];
    for (const datei of readdirSync(ordner).filter(
      (name) => name.endsWith('.tsx') && !name.includes('.test.')
    )) {
      readFileSync(resolve(ordner, datei), 'utf8')
        .split('\n')
        .forEach((zeile, i) => {
          if (/role=\{?["']/.test(zeile) || /aria-label=\{?["'`]/.test(zeile)) {
            fehl.push(`${datei}:${i + 1}  ${zeile.trim().slice(0, 80)}`);
          }
        });
    }
    expect(fehl, `ARIA direkt an einer Bauteil-Karte:\n${fehl.join('\n')}`).toEqual([]);
  });
});
