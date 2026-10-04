import { describe, it, expect, beforeEach } from 'vitest';
import { usePlannerStore } from './usePlannerStore';
import { edgeIntentOf, isIntentPinned, isRouteLocked } from '../lib/electricalGraph/intent';
import { performAutoWiring } from '../lib/autoWire';
import type { Edge } from '@xyflow/react';
import type { CableEdgeData } from '../components/edges/CableEdge';

/**
 * V2-INTENT-002: Der Nutzer braucht einen WEG, eine bewusste Entscheidung zu
 * erklären. Das Modell (`lib/electricalGraph/intent.ts`) konnte das von
 * Anfang an — es gab nur keine Aktion, die es schreibt. Damit war jede
 * gezogene Leitung beim nächsten Auto-Wire-Lauf Freiwild.
 */
describe('V2-INTENT-002: setEdgeIntent', () => {
  const edge = (patch: Partial<Edge<CableEdgeData>> = {}): Edge<CableEdgeData> => ({
    id: 'e1',
    source: 'b1',
    target: 'c1',
    sourceHandle: 'plus',
    targetHandle: 'plus',
    data: { length: 2 },
    ...patch,
  });

  beforeEach(() => {
    usePlannerStore.setState({
      nodes: [
        {
          id: 'b1',
          type: 'battery',
          position: { x: 0, y: 0 },
          data: { label: 'Batterie', capacity: 100, nominalVoltage: 12.8 },
        },
        { id: 'c1', type: 'consumer', position: { x: 300, y: 0 }, data: { label: 'Licht', watts: 60 } },
      ],
      edges: [edge()],
    });
  });

  const currentEdge = () => usePlannerStore.getState().edges[0]!;

  it('„Meine Entscheidung“ pinnt die Kante gegen Auto-Wire', () => {
    usePlannerStore.getState().setEdgeIntent('e1', 'user');
    const result = currentEdge();
    expect(edgeIntentOf(result)).toBe('user');
    expect(isIntentPinned(result)).toBe(true);
    // Topologie gepinnt, Route aber frei: Der Router darf weiter optimieren.
    expect(isRouteLocked(result)).toBe(false);
  });

  it('„Fixiert“ sperrt zusätzlich die Route', () => {
    usePlannerStore.getState().setEdgeIntent('e1', 'locked');
    const result = currentEdge();
    expect(edgeIntentOf(result)).toBe('locked');
    expect(isRouteLocked(result)).toBe(true);
  });

  it('„Automatik“ gibt die Kante wieder frei', () => {
    usePlannerStore.getState().setEdgeIntent('e1', 'locked');
    usePlannerStore.getState().setEdgeIntent('e1', 'auto');
    const result = currentEdge();
    expect(result.data?.locked).toBe(false);
    expect(result.data?.intent).toBeUndefined();
    expect(isIntentPinned(result)).toBe(false);
  });

  it('eine erklärte Absicht ist keine Auto-Kante mehr', () => {
    usePlannerStore.setState({ edges: [edge({ data: { length: 2, autoWired: true } })] });
    usePlannerStore.getState().setEdgeIntent('e1', 'user');
    expect(currentEdge().data?.autoWired).toBe(false);
  });

  it('lässt andere Kanten und die übrigen Kantendaten unberührt', () => {
    usePlannerStore.setState({
      edges: [edge({ data: { length: 2, crossSection: 6, fuseSize: 30 } }), edge({ id: 'e2' })],
    });
    usePlannerStore.getState().setEdgeIntent('e1', 'user');
    const [first, second] = usePlannerStore.getState().edges;
    expect(first?.data).toMatchObject({ length: 2, crossSection: 6, fuseSize: 30, intent: 'user' });
    expect(second?.data?.intent).toBeUndefined();
  });

  it('ist rückgängig machbar (ein History-Schritt)', () => {
    usePlannerStore.getState().setEdgeIntent('e1', 'locked');
    expect(usePlannerStore.getState().canUndo).toBe(true);
    usePlannerStore.getState().undo();
    expect(currentEdge().data?.locked).toBeUndefined();
  });

  it('zweimal derselbe Wert erzeugt keinen zweiten History-Schritt', () => {
    usePlannerStore.getState().setEdgeIntent('e1', 'user');
    const depth = usePlannerStore.getState().historyPast.length;
    usePlannerStore.getState().setEdgeIntent('e1', 'user');
    expect(usePlannerStore.getState().historyPast.length).toBe(depth);
  });

  /**
   * Der eigentliche Zweck: Die Erklärung muss bei Auto-Wire ankommen.
   * Geprüft wird die Wirkung, nicht die Schreibweise — eine gepinnte Kante
   * überlebt den Lauf mit IHRER Topologie.
   */
  it('eine gepinnte Kante überlebt einen Auto-Wire-Lauf', () => {
    usePlannerStore.getState().setEdgeIntent('e1', 'locked');
    const { nodes, edges } = usePlannerStore.getState();
    const result = performAutoWiring(nodes, edges);
    expect(result).not.toBeNull();
    const survivor = result!.edges.find((candidate) => candidate.id === 'e1');
    expect(survivor).toBeDefined();
    expect(survivor?.source).toBe('b1');
    expect(survivor?.target).toBe('c1');
  });
});
