import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PLANNER_STORAGE_KEY } from '../../../lib/storageKeys';
import { TEMPLATE_MINIMALIST } from '../templates';
import { encodeSharePlan } from '../../../store/sharePlan';
import { usePlannerEntryPlan } from './usePlannerEntryPlan';

const applyTemplate = vi.fn();
const importProject = vi.fn(() => true);
const setHasOnboarded = vi.fn();

const plannerState = {
  nodes: [] as unknown[],
  edges: [] as unknown[],
  waterNodes: [] as unknown[],
  waterEdges: [] as unknown[],
  viewMode: 'electric',
  season: 'summer',
  applyTemplate,
  importProject,
};

vi.mock('../../../store/usePlannerStore', () => ({
  usePlannerStore: { getState: () => plannerState },
}));

vi.mock('../../../lib/store', () => ({
  useAppStore: (selector: (state: { setHasOnboarded: typeof setHasOnboarded }) => unknown) =>
    selector({ setHasOnboarded }),
}));

function Probe() {
  const { notice } = usePlannerEntryPlan();
  return notice ? <p>{notice.message}</p> : null;
}

describe('usePlannerEntryPlan — Einstieg in den Planer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    importProject.mockReturnValue(true);
    plannerState.nodes = [];
    plannerState.waterNodes = [];
    window.localStorage.clear();
    window.history.pushState({}, '', '/planer/');
  });

  it('lädt beim ersten Besuch das Beispiel-Setup statt einer leeren Fläche', async () => {
    render(<Probe />);

    await waitFor(() => expect(applyTemplate).toHaveBeenCalledWith('kastenwagen'));
    expect(await screen.findByText(/Beispiel geladen/)).toBeInTheDocument();
    expect(setHasOnboarded).not.toHaveBeenCalled();
  });

  it('lässt einen gespeicherten Plan unangetastet (kein Beispiel darüber)', async () => {
    window.localStorage.setItem(PLANNER_STORAGE_KEY, '{"state":{"nodes":[]},"version":1}');
    render(<Probe />);

    // Dem Effekt einen Durchlauf geben — danach darf nichts geladen sein.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(applyTemplate).not.toHaveBeenCalled();
    expect(importProject).not.toHaveBeenCalled();
  });

  it('löst ?template=ladebooster-solar auf das Kastenwagen-Setup auf und räumt die Adresse auf', async () => {
    window.history.pushState({}, '', '/planer/?template=ladebooster-solar');
    render(<Probe />);

    await waitFor(() => expect(applyTemplate).toHaveBeenCalledWith('kastenwagen'));
    expect(setHasOnboarded).toHaveBeenCalledWith(true);
    expect(window.location.search).toBe('');
  });

  it('öffnet einen geteilten Plan aus dem Hash direkt auf der Fläche', async () => {
    const hash = await encodeSharePlan({
      viewMode: 'electric',
      season: 'summer',
      nodes: TEMPLATE_MINIMALIST.nodes as never,
      edges: TEMPLATE_MINIMALIST.edges as never,
      waterNodes: [],
      waterEdges: [],
    });
    window.history.pushState({}, '', `/planer/#${hash}`);
    render(<Probe />);

    await waitFor(() => expect(importProject).toHaveBeenCalledTimes(1));
    expect(applyTemplate).not.toHaveBeenCalled();
    expect(await screen.findByText(/Geteilter Plan geladen/)).toBeInTheDocument();
    expect(window.location.hash).toBe('');
  });

  it('meldet einen beschädigten Teilen-Link sichtbar und lässt den Plan unverändert', async () => {
    window.history.pushState({}, '', '/planer/#plan=z.kaputt');
    render(<Probe />);

    expect(await screen.findByText(/konnte nicht geladen werden/)).toBeInTheDocument();
    expect(importProject).not.toHaveBeenCalled();
    expect(applyTemplate).not.toHaveBeenCalled();
  });
});
