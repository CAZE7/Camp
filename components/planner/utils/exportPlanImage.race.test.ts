import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePlannerStore } from '../../../store/usePlannerStore';
import { capturePlanImage, exportPlanImage } from './exportPlanImage';

const toPngMock = vi.fn(() => Promise.resolve('data:image/png;base64,AAAA'));
vi.mock('html-to-image', () => ({ toPng: () => toPngMock() }));

const actions = [
  { label: 'capturePlanImage', run: () => capturePlanImage() },
  { label: 'exportPlanImage', run: () => exportPlanImage() },
];

function selectSecondNode(): void {
  usePlannerStore.setState((state) => {
    const nodes = state.nodes.map((node) => ({ ...node, selected: node.id === 'b' }));
    return { nodes, selectedNodes: nodes.filter((node) => node.selected) };
  });
}

const selectedIds = (): string[] =>
  usePlannerStore
    .getState()
    .nodes.filter((node) => node.selected)
    .map((node) => node.id);

/** Realer Zustand-Store, nur PNG-Ausgabe und Browser-Frames werden kontrolliert. */
describe('PR-609-Audit — Auswahl während asynchroner Bildaufnahme', () => {
  beforeEach(() => {
    toPngMock.mockReset().mockResolvedValue('data:image/png;base64,AAAA');
    document.body.innerHTML = '<div class="react-flow"><div class="react-flow__viewport"></div></div>';
    usePlannerStore.setState({
      viewMode: 'electric',
      nodes: [
        { id: 'a', type: 'battery', position: { x: 0, y: 0 }, data: {}, selected: true },
        { id: 'b', type: 'battery', position: { x: 300, y: 0 }, data: {}, selected: false },
      ],
      edges: [],
      waterNodes: [],
      waterEdges: [],
      selectedNodes: [],
      selectedEdges: [],
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(actions)('$label: erhält die Benutzerauswahl aus dem PNG-Rendering', async ({ run }) => {
    toPngMock.mockImplementation(() => {
      expect(selectedIds()).toEqual([]);
      selectSecondNode();
      return Promise.resolve('data:image/png;base64,AAAA');
    });
    await run();
    expect(selectedIds()).toEqual(['b']);
    expect(usePlannerStore.getState().selectedNodes.map((node) => node.id)).toEqual(['b']);
  });

  it.each(actions)(
    '$label: erfasst Auswahländerungen bereits während der vorbereitenden Frames',
    async ({ run }) => {
      const frames: FrameRequestCallback[] = [];
      vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });
      const pending = run();
      await vi.waitFor(() => expect(frames.length).toBeGreaterThan(0));
      selectSecondNode();
      await vi.waitFor(() => {
        for (const callback of frames.splice(0)) callback(0);
        expect(toPngMock).toHaveBeenCalledOnce();
      });
      await pending;
      expect(selectedIds()).toEqual(['b']);
    }
  );

  it.each(actions)(
    '$label: restauriert bei Auswahlwechsel und anschließendem Abwählen nicht den Altstand (ABA)',
    async ({ run }) => {
      toPngMock.mockImplementation(() => {
        selectSecondNode();
        usePlannerStore.setState((state) => ({
          nodes: state.nodes.map((node) => ({ ...node, selected: false })),
          selectedNodes: [],
        }));
        return Promise.resolve('data:image/png;base64,AAAA');
      });
      await run();
      expect(selectedIds()).toEqual([]);
    }
  );

  it.each(actions)(
    '$label: stellt unveränderte Auswahl auch bei Renderfehler wieder her',
    async ({ label, run }) => {
      toPngMock.mockRejectedValue(new Error('PNG fehlgeschlagen'));
      if (label === 'capturePlanImage') {
        await expect(run()).rejects.toThrow('PNG fehlgeschlagen');
      } else {
        await expect(run()).resolves.toMatchObject({ type: 'error' });
      }
      expect(selectedIds()).toEqual(['a']);
      const state = usePlannerStore.getState();
      expect(state.selectedNodes[0]).toBe(state.nodes[0]);
      expect(document.querySelector('.planner-exporting')).toBeNull();
      expect(document.querySelector('[data-plan-watermark]')).toBeNull();
    }
  );

  it.each(actions)(
    '$label: Fehler überschreibt ebenfalls keine neue Benutzerauswahl',
    async ({ label, run }) => {
      toPngMock.mockImplementation(() => {
        selectSecondNode();
        return Promise.reject(new Error('PNG fehlgeschlagen'));
      });
      if (label === 'capturePlanImage') {
        await expect(run()).rejects.toThrow('PNG fehlgeschlagen');
      } else {
        await expect(run()).resolves.toMatchObject({ type: 'error' });
      }
      expect(selectedIds()).toEqual(['b']);
    }
  );

  it.each(actions)('$label: ein ursprünglich unselektierter Plan bleibt unverändert', async ({ run }) => {
    usePlannerStore.setState((state) => ({
      nodes: state.nodes.map((node) => ({ ...node, selected: false })),
    }));
    const nodes = usePlannerStore.getState().nodes;
    await run();
    expect(usePlannerStore.getState().nodes).toBe(nodes);
    expect(selectedIds()).toEqual([]);
  });

  it.each(actions)(
    '$label: Wasser-Auswahl wird ebenfalls vorübergehend entfernt und korrekt restauriert',
    async ({ run }) => {
      usePlannerStore.setState({
        viewMode: 'water',
        waterNodes: [
          { id: 'water', type: 'freshWaterTank', position: { x: 0, y: 0 }, data: {}, selected: true },
        ],
      });
      toPngMock.mockImplementation(() => {
        expect(usePlannerStore.getState().waterNodes[0]?.selected).toBe(false);
        return Promise.resolve('data:image/png;base64,AAAA');
      });
      await run();
      expect(usePlannerStore.getState().waterNodes[0]?.selected).toBe(true);
    }
  );

  it('parallel angeforderte Aufnahmen verändern den gemeinsamen DOM-/Auswahlzustand nicht gleichzeitig', async () => {
    let active = 0;
    const concurrency: number[] = [];
    toPngMock.mockImplementation(async () => {
      active += 1;
      concurrency.push(active);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      active -= 1;
      return 'data:image/png;base64,AAAA';
    });
    await Promise.all([capturePlanImage(), exportPlanImage()]);
    expect(concurrency).toEqual([1, 1]);
    expect(selectedIds()).toEqual(['a']);
  });

  it('eine fehlgeschlagene Aufnahme blockiert die nächste Aufnahme nicht', async () => {
    toPngMock.mockRejectedValueOnce(new Error('erste Aufnahme fehlgeschlagen'));
    const first = expect(capturePlanImage()).rejects.toThrow('erste Aufnahme fehlgeschlagen');
    const second = expect(capturePlanImage()).resolves.toMatchObject({
      dataUrl: 'data:image/png;base64,AAAA',
    });
    await Promise.all([first, second]);
    expect(selectedIds()).toEqual(['a']);
  });

  it('Änderung einer Kanten-/Wasser-Auswahl während des Renders wird nicht überschrieben', async () => {
    usePlannerStore.setState({
      edges: [{ id: 'edge', source: 'a', target: 'b', selected: true }],
      waterNodes: [
        { id: 'water', type: 'freshWaterTank', position: { x: 0, y: 0 }, data: {}, selected: true },
      ],
      waterEdges: [{ id: 'pipe', source: 'water', target: 'water', selected: true }],
    });
    toPngMock.mockImplementation(() => {
      usePlannerStore.setState((state) => ({
        edges: state.edges.map((edge) => ({ ...edge, selected: true })),
        selectedEdges: state.edges.map((edge) => ({ ...edge, selected: true })),
      }));
      return Promise.resolve('data:image/png;base64,AAAA');
    });
    await capturePlanImage();
    const state = usePlannerStore.getState();
    expect(state.edges[0]?.selected).toBe(true);
    expect(state.waterNodes[0]?.selected).toBe(false);
    expect(state.waterEdges[0]?.selected).toBe(false);
  });
});
