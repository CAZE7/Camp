import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlannerStore } from './usePlannerStore';
import { resetHistoryCoalescing } from './slices/graphInternals';

/**
 * Nachtest 2026-10-16, N4: „Wert von 20 auf 125 ändern → Rückgängig“
 * brauchte drei Schritte (einer pro Tastendruck). Erwartet: EIN
 * Rückgängig stellt den Wert vor dem Tippen wieder her.
 */
describe('Verlauf-Koaleszenz (N4)', () => {
  beforeEach(() => {
    resetHistoryCoalescing();
    usePlannerStore.setState({
      nodes: [
        {
          id: 'c1',
          type: 'consumer',
          position: { x: 0, y: 0 },
          data: { label: 'Licht', watts: 20, hours: 2 },
        },
      ] as never,
      edges: [],
      waterNodes: [],
      waterEdges: [],
      historyPast: [],
      historyFuture: [],
      canUndo: false,
      canRedo: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetHistoryCoalescing();
  });

  const watts = () =>
    (usePlannerStore.getState().nodes[0]?.data as { watts?: number } | undefined)?.watts;

  it('fasst Tastendrücke im selben Feld zu einem Schritt zusammen', () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000);
    usePlannerStore.getState().updateNodeData('c1', { watts: 1 });
    now.mockReturnValue(1_100);
    usePlannerStore.getState().updateNodeData('c1', { watts: 12 });
    now.mockReturnValue(1_200);
    usePlannerStore.getState().updateNodeData('c1', { watts: 125 });

    expect(watts()).toBe(125);
    expect(usePlannerStore.getState().historyPast).toHaveLength(1);

    usePlannerStore.getState().undo();
    expect(watts()).toBe(20);
  });

  it('trennt Schritte nach Ablauf des Zeitfensters', () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000);
    usePlannerStore.getState().updateNodeData('c1', { watts: 30 });
    now.mockReturnValue(5_000);
    usePlannerStore.getState().updateNodeData('c1', { watts: 40 });

    expect(usePlannerStore.getState().historyPast).toHaveLength(2);
    usePlannerStore.getState().undo();
    expect(watts()).toBe(30);
  });

  it('trennt Schritte bei einem anderen Feld', () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000);
    usePlannerStore.getState().updateNodeData('c1', { watts: 30 });
    now.mockReturnValue(1_100);
    usePlannerStore.getState().updateNodeData('c1', { hours: 5 });

    expect(usePlannerStore.getState().historyPast).toHaveLength(2);
  });

  it('beendet die Kette nach Rückgängig — neues Tippen ist ein neuer Schritt', () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000);
    usePlannerStore.getState().updateNodeData('c1', { watts: 30 });
    now.mockReturnValue(1_100);
    usePlannerStore.getState().updateNodeData('c1', { watts: 35 });
    usePlannerStore.getState().undo();
    expect(watts()).toBe(20);

    now.mockReturnValue(1_200);
    usePlannerStore.getState().updateNodeData('c1', { watts: 50 });
    expect(usePlannerStore.getState().historyPast).toHaveLength(1);
    usePlannerStore.getState().undo();
    expect(watts()).toBe(20);
  });
});
