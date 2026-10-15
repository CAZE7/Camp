import { beforeEach, describe, expect, it, vi } from 'vitest';

import { exportPlanImage, PLAN_WATERMARK_TEXT, watermarkBadgeLayout } from './exportPlanImage';

const toPngMock = vi.fn((..._args: unknown[]): Promise<string> => Promise.resolve(''));

vi.mock('html-to-image', () => ({
  toPng: (...args: unknown[]): Promise<string> => toPngMock(...args),
}));

vi.mock('../../../store/usePlannerStore', () => ({
  usePlannerStore: {
    getState: () => ({
      viewMode: 'electric',
      nodes: [{ id: 'battery-1', type: 'battery', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
      waterNodes: [],
      waterEdges: [],
    }),
  },
}));

describe('exportPlanImage — Foren-Export mit Wasserzeichen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('legt das Badge unten rechts in die Plan-Bounds', () => {
    expect(watermarkBadgeLayout({ x: 100, y: 50, width: 900, height: 600 })).toEqual({
      left: 660,
      top: 598,
      width: 340,
    });
  });

  it('zeigt das Wasserzeichen nur während der Aufnahme und entfernt es danach', async () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'react-flow';
    const viewport = document.createElement('div');
    viewport.className = 'react-flow__viewport';
    wrapper.appendChild(viewport);
    document.body.appendChild(wrapper);

    let badgeTextDuringCapture: string | null = null;
    toPngMock.mockImplementation(() => {
      badgeTextDuringCapture = document.querySelector('[data-plan-watermark]')?.textContent ?? null;
      return Promise.resolve('data:image/png;base64,mocked');
    });

    const clicks: string[] = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        Object.defineProperty(element, 'click', {
          value: () => clicks.push((element as HTMLAnchorElement).download),
        });
      }
      return element;
    });

    const result = await exportPlanImage();

    expect(result.type).toBe('success');
    expect(badgeTextDuringCapture).toContain(PLAN_WATERMARK_TEXT);
    expect(badgeTextDuringCapture).toContain('elektroplaner-camper.de');
    expect(document.querySelector('[data-plan-watermark]')).toBeNull();
    expect(clicks).toEqual(['elektroplaner-camper-schaltplan.png']);
  });
});
