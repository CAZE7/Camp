/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
// Store-Mocks via vi.mock Factory: TypeScript sieht die Original-Typen,
// nicht die Mock-Typen. Deshalb sind as any Casts und eslint-disable nötig.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const toPngMock = vi.fn();
vi.mock('html-to-image', () => ({ toPng: (...args: unknown[]): unknown => toPngMock(...args) }));

vi.mock('../../../store/usePlannerStore', () => ({
  usePlannerStore: {
    getState: vi.fn(),
    setState: vi.fn(),
    subscribe: vi.fn(),
    destroy: vi.fn(),
  },
}));

/**
 * Regressionstest für die Race-Condition im Planbild-Export:
 *
 * Während des asynchronen Bild-Renderings ändert der Benutzer seine Auswahl.
 * Die Auswahl nach dem Export muss die neue (aktuelle) Auswahl sein, nicht
 * die alte, die vor dem Export erfasst wurde. Die alte Auswahl darf nicht
 * unconditional wiederhergestellt werden.
 */
describe('exportPlanImage · Race-Condition: Auswahl während asynchronem Export geändert', () => {
  beforeEach(() => {
    toPngMock.mockReset();
    document.body.innerHTML = '<div class="react-flow"><div class="react-flow__viewport"></div></div>';
    vi.resetAllMocks();
  });

  it('capturePlanImage: überschreibt keine Benutzerauswahl, die während des Renders geändert wurde', async () => {
    const { usePlannerStore } = await import('../../../store/usePlannerStore');
    const { capturePlanImage } = await import('./exportPlanImage');

    // Store initialisieren: Node A ausgewählt, Node B nicht
    (usePlannerStore.getState as any).mockReturnValue({
      viewMode: 'electric',
      nodes: [
        { id: 'a', type: 'battery', position: { x: 0, y: 0 }, data: {}, selected: true },
        { id: 'b', type: 'battery', position: { x: 300, y: 0 }, data: {}, selected: false },
      ] as never,
      edges: [],
      waterNodes: [],
      waterEdges: [],
      selectedNodes: [],
      selectedEdges: [],
    });
    const setStateMock = vi.fn((updater: (s: any) => any) => {
      const prev = usePlannerStore.getState();
      const next = updater(prev);
      (usePlannerStore.getState as any).mockReturnValue(next);
    });
    (usePlannerStore.setState as any).mockImplementation(setStateMock);

    // Während des asynchronen Renders: Benutzer ändert Auswahl von A auf B
    toPngMock.mockImplementation(() => {
      usePlannerStore.setState((s: any) => ({
        nodes: s.nodes.map((n: any) => ({ ...n, selected: n.id === 'b' })),
        edges: [],
        waterNodes: [],
        waterEdges: [],
        selectedNodes: [],
        selectedEdges: [],
      }));
      return Promise.resolve('data:image/png;base64,AAAA');
    });

    const result = await capturePlanImage();

    expect(result.dataUrl).toBe('data:image/png;base64,AAAA');
    // Die aktuelle Auswahl muss Node B sein — nicht Node A (die alte Auswahl)
    const finalState = usePlannerStore.getState();
    const nodeA = finalState.nodes.find((n: any) => n.id === 'a');
    const nodeB = finalState.nodes.find((n: any) => n.id === 'b');
    expect(nodeA?.selected).toBe(false);
    expect(nodeB?.selected).toBe(true);
  });

  it('capturePlanImage: stellt alte Auswahl wieder her, wenn sich nichts geändert hat', async () => {
    const { usePlannerStore } = await import('../../../store/usePlannerStore');
    const { capturePlanImage } = await import('./exportPlanImage');

    (usePlannerStore.getState as any).mockReturnValue({
      viewMode: 'electric',
      nodes: [
        { id: 'a', type: 'battery', position: { x: 0, y: 0 }, data: {}, selected: true },
        { id: 'b', type: 'battery', position: { x: 300, y: 0 }, data: {}, selected: false },
      ] as never,
      edges: [],
      waterNodes: [],
      waterEdges: [],
      selectedNodes: [],
      selectedEdges: [],
    });
    const setStateMock = vi.fn((updater: (s: any) => any) => {
      const prev = usePlannerStore.getState();
      const next = updater(prev);
      (usePlannerStore.getState as any).mockReturnValue(next);
    });
    (usePlannerStore.setState as any).mockImplementation(setStateMock);

    toPngMock.mockImplementation(() => {
      return Promise.resolve('data:image/png;base64,AAAA');
    });

    const result = await capturePlanImage();

    expect(result.dataUrl).toBe('data:image/png;base64,AAAA');
    // Die alte Auswahl (Node A) muss wiederhergestellt werden, da sich nichts geändert hat
    const finalState = usePlannerStore.getState();
    const nodeA = finalState.nodes.find((n: any) => n.id === 'a');
    const nodeB = finalState.nodes.find((n: any) => n.id === 'b');
    expect(nodeA?.selected).toBe(true);
    expect(nodeB?.selected).toBe(false);
  });

  it('capturePlanImage: leere Auswahl wird nicht beschädigt', async () => {
    const { usePlannerStore } = await import('../../../store/usePlannerStore');
    const { capturePlanImage } = await import('./exportPlanImage');

    (usePlannerStore.getState as any).mockReturnValue({
      viewMode: 'electric',
      nodes: [{ id: 'a', type: 'battery', position: { x: 0, y: 0 }, data: {}, selected: false }] as never,
      edges: [],
      waterNodes: [],
      waterEdges: [],
      selectedNodes: [],
      selectedEdges: [],
    });
    const setStateMock = vi.fn((updater: (s: any) => any) => {
      const prev = usePlannerStore.getState();
      const next = updater(prev);
      (usePlannerStore.getState as any).mockReturnValue(next);
    });
    (usePlannerStore.setState as any).mockImplementation(setStateMock);

    toPngMock.mockImplementation(() => {
      return Promise.resolve('data:image/png;base64,AAAA');
    });

    const result = await capturePlanImage();

    expect(result.dataUrl).toBe('data:image/png;base64,AAAA');
    // Keine Auswahl war vorhanden, nichts darf wiederhergestellt werden
    const finalState = usePlannerStore.getState();
    const nodeA = finalState.nodes.find((n: any) => n.id === 'a');
    expect(nodeA?.selected).toBe(false);
  });

  it('exportPlanImage: überschreibt keine Benutzerauswahl, die während des Renders geändert wurde', async () => {
    const { usePlannerStore } = await import('../../../store/usePlannerStore');
    const { exportPlanImage } = await import('./exportPlanImage');

    (usePlannerStore.getState as any).mockReturnValue({
      viewMode: 'electric',
      nodes: [
        { id: 'a', type: 'battery', position: { x: 0, y: 0 }, data: {}, selected: true },
        { id: 'b', type: 'battery', position: { x: 300, y: 0 }, data: {}, selected: false },
      ] as never,
      edges: [],
      waterNodes: [],
      waterEdges: [],
      selectedNodes: [],
      selectedEdges: [],
    });
    const setStateMock = vi.fn((updater: (s: any) => any) => {
      const prev = usePlannerStore.getState();
      const next = updater(prev);
      (usePlannerStore.getState as any).mockReturnValue(next);
    });
    (usePlannerStore.setState as any).mockImplementation(setStateMock);

    // Download-Klick unterdrücken
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    toPngMock.mockImplementation(() => {
      usePlannerStore.setState((s: any) => ({
        nodes: s.nodes.map((n: any) => ({ ...n, selected: n.id === 'b' })),
        edges: [],
      }));
      return Promise.resolve('data:image/png;base64,AAAA');
    });

    const result = await exportPlanImage();

    expect(result.type).toBe('success');
    const finalState = usePlannerStore.getState();
    const nodeA = finalState.nodes.find((n: any) => n.id === 'a');
    const nodeB = finalState.nodes.find((n: any) => n.id === 'b');
    expect(nodeA?.selected).toBe(false);
    expect(nodeB?.selected).toBe(true);
  });

  it('exportPlanImage: Render-Fehler lässt Auswahl nicht beschädigt zurück', async () => {
    const { usePlannerStore } = await import('../../../store/usePlannerStore');
    const { exportPlanImage } = await import('./exportPlanImage');

    (usePlannerStore.getState as any).mockReturnValue({
      viewMode: 'electric',
      nodes: [{ id: 'a', type: 'battery', position: { x: 0, y: 0 }, data: {}, selected: true }] as never,
      edges: [],
      waterNodes: [],
      waterEdges: [],
      selectedNodes: [],
      selectedEdges: [],
    });
    const setStateMock = vi.fn((updater: (s: any) => any) => {
      const prev = usePlannerStore.getState();
      const next = updater(prev);
      (usePlannerStore.getState as any).mockReturnValue(next);
    });
    (usePlannerStore.setState as any).mockImplementation(setStateMock);

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    toPngMock.mockImplementation(() => {
      throw new Error('Render fehlgeschlagen');
    });

    const result = await exportPlanImage();

    expect(result.type).toBe('error');
    // Auch nach einem Fehler darf die alte Auswahl nicht einfach überschrieben werden,
    // wenn sie sich dazwischen geändert hat. Hier hat sie sich nicht geändert,
    // also sollte sie wiederhergestellt werden (oder zumindest nicht beschädigt sein).
    const finalState = usePlannerStore.getState();
    const nodeA = finalState.nodes.find((n: any) => n.id === 'a');
    expect(nodeA?.selected).toBe(true);
  });
});
