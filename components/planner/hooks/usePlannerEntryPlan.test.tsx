import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PLANNER_STORAGE_KEY } from '../../../lib/storageKeys';
import { TEMPLATE_KASTENWAGEN, TEMPLATE_MINIMALIST } from '../templates';
import { encodeSharePlan } from '../../../store/sharePlan';
import { buildCleanEntryUrl, usePlannerEntryPlan } from './usePlannerEntryPlan';

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
    plannerState.edges = [];
    plannerState.waterNodes = [];
    plannerState.waterEdges = [];
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

  it('H5: fragt um Bestätigung, bevor ein #plan=-Link ein bearbeitetes Starter-Setup (300 Ah) überschreibt', async () => {
    plannerState.nodes = TEMPLATE_KASTENWAGEN.nodes.map((node) =>
      node.id === 'battery-1' ? { ...node, data: { ...node.data, capacity: 300 } } : node
    );
    plannerState.edges = [...TEMPLATE_KASTENWAGEN.edges];

    const hash = await encodeSharePlan({
      viewMode: 'electric',
      season: 'summer',
      nodes: TEMPLATE_KASTENWAGEN.nodes as never,
      edges: TEMPLATE_KASTENWAGEN.edges as never,
      waterNodes: [],
      waterEdges: [],
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      window.history.pushState({}, '', `/planer/#${hash}`);
      render(<Probe />);

      await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
      expect(importProject).not.toHaveBeenCalled();
      expect(window.location.hash).toBe('');
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('N7: erhält utm_*-Parameter beim Bereinigen von ?template= und #plan=', () => {
    expect(
      buildCleanEntryUrl({
        pathname: '/planer/',
        search: '?utm_source=forum&template=autark&utm_medium=social',
        hash: '#plan=z.abc',
      })
    ).toBe('/planer/?utm_source=forum&utm_medium=social');
  });

  it('N7: bereinigt eine unbekannte ?template=-ID sichtbar statt sie still in der URL zu lassen', async () => {
    window.history.pushState({}, '', '/planer/?template=gibtsnicht&utm_source=newsletter');
    render(<Probe />);

    expect(await screen.findByText(/Unbekannte Vorlage „gibtsnicht“/)).toBeInTheDocument();
    expect(applyTemplate).toHaveBeenCalledWith('kastenwagen');
    expect(window.location.search).toBe('?utm_source=newsletter');
  });
});
