import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * QA B-17: Der PNG-Export darf keine Auswahl-Rahmen ins Bild rendern. Die
 * Auswahl wird vor dem Rendern gelöst und danach wiederhergestellt.
 */
const toPngMock = vi.fn();
vi.mock('html-to-image', () => ({ toPng: (...args: unknown[]): unknown => toPngMock(...args) }));

describe('exportPlanImage · Auswahl (B-17)', () => {
  beforeEach(() => {
    toPngMock.mockReset();
    document.body.innerHTML = '<div class="react-flow"><div class="react-flow__viewport"></div></div>';
  });

  it('löst die Auswahl während des Renderns und stellt sie danach wieder her', async () => {
    const { usePlannerStore } = await import('../../../store/usePlannerStore');
    const { exportPlanImage } = await import('./exportPlanImage');
    usePlannerStore.setState({
      viewMode: 'electric',
      nodes: [
        { id: 'a', type: 'battery', position: { x: 0, y: 0 }, data: {}, selected: true },
        { id: 'b', type: 'battery', position: { x: 300, y: 0 }, data: {}, selected: false },
      ] as never,
      edges: [],
    });

    let selectedDuringRender: boolean[] = [];
    toPngMock.mockImplementation(() => {
      selectedDuringRender = usePlannerStore.getState().nodes.map((n) => n.selected === true);
      return Promise.resolve('data:image/png;base64,AAAA');
    });
    // Download-Link-Klick in jsdom unterdrücken.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const result = await exportPlanImage();

    expect(result.type).toBe('success');
    expect(selectedDuringRender).toEqual([false, false]);
    expect(usePlannerStore.getState().nodes.map((n) => n.selected)).toEqual([true, false]);
  });
});
