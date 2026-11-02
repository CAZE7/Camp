import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePlannerActions } from './usePlannerActions';
import { usePlannerStore } from '../../../store/usePlannerStore';

const requestConfirm = vi.fn((_message: string): Promise<boolean> => Promise.resolve(false));

vi.mock('../../ui/ConfirmDialog', () => ({
  requestConfirm: (message: string) => requestConfirm(message),
}));

describe('usePlannerActions — Automatisch verbinden (B-11)', () => {
  beforeEach(() => {
    usePlannerStore.getState().clearPlan();
  });

  it('runs the electric auto-wire only in the electric view', () => {
    const onFeedback = vi.fn();
    const { result } = renderHook(() =>
      usePlannerActions({ warnings: [], onFeedback, onRequestReset: () => {} })
    );

    usePlannerStore.setState({ viewMode: 'water' });
    act(() => result.current.runAutoWire());

    expect(onFeedback).toHaveBeenCalledTimes(1);
    const feedback = onFeedback.mock.calls[0]?.[0] as { type: string; message: string } | null | undefined;
    expect(feedback?.type).toBe('info');
    expect(feedback?.message).toContain('Wasserplan');
    // Im Wasser-Tab darf kein elektrischer Vorschlag entstehen (weder Vorschau noch Lauf).
    expect(usePlannerStore.getState().autoWirePreview).toBeFalsy();
  });

  it('H5: sharePlan kopiert den Link in die Zwischenablage, ohne #plan= in die eigene Adresszeile zu schreiben', async () => {
    const onFeedback = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    window.history.replaceState(null, '', '/planer/');
    usePlannerStore.getState().applyTemplate('kastenwagen');

    const { result } = renderHook(() =>
      usePlannerActions({ warnings: [], onFeedback, onRequestReset: () => {} })
    );

    await act(async () => {
      await result.current.sharePlan();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(String(writeText.mock.calls[0]?.[0])).toContain('#plan=');
    expect(window.location.hash).toBe('');
  });
});

/**
 * Regressionstest Audit 2026-11-02: „Vorlage laden" war die einzige Stelle,
 * die noch das native `window.confirm()` benutzte. Auf dem Handy ist das ein
 * Systemfenster ohne das Design der Anwendung, außerhalb der Fokusfalle und
 * ohne die Rückfrage-Texte, die jede andere Überschreibung hier zeigt.
 */
describe('usePlannerActions — Vorlage laden ohne nativen Dialog', () => {
  beforeEach(() => {
    usePlannerStore.getState().clearPlan();
    vi.clearAllMocks();
    requestConfirm.mockResolvedValue(false);
  });

  /**
   * Ein vorgeladenes Starter-Setup zählt nicht als eigener Plan — erst eine
   * eigene Änderung löst die Rückfrage aus.
   */
  const ownPlan = () => {
    usePlannerStore.getState().applyTemplate('kastenwagen');
    usePlannerStore.setState((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === 'battery-1' ? { ...node, data: { ...node.data, capacity: 300 } } : node
      ),
    }));
  };

  it('fragt in der App nach, bevor ein eigener Plan ersetzt wird', async () => {
    ownPlan();
    const onFeedback = vi.fn();
    const { result } = renderHook(() =>
      usePlannerActions({ warnings: [], onFeedback, onRequestReset: () => {} })
    );

    const nativeConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    act(() => {
      result.current.loadTemplate('autark');
    });

    await waitFor(() => expect(requestConfirm).toHaveBeenCalledTimes(1));
    expect(nativeConfirm).not.toHaveBeenCalled();
    nativeConfirm.mockRestore();
  });

  it('lässt den Plan unverändert, wenn die Rückfrage verneint wird', async () => {
    ownPlan();
    const before = usePlannerStore.getState().nodes.length;
    const { result } = renderHook(() =>
      usePlannerActions({ warnings: [], onFeedback: vi.fn(), onRequestReset: () => {} })
    );

    act(() => {
      result.current.loadTemplate('autark');
    });

    await waitFor(() => expect(requestConfirm).toHaveBeenCalledTimes(1));
    expect(usePlannerStore.getState().nodes.length).toBe(before);
  });

  it('wendet die Vorlage an, wenn die Rückfrage bestätigt wird', async () => {
    ownPlan();
    requestConfirm.mockResolvedValueOnce(true);
    const onFeedback = vi.fn();
    const { result } = renderHook(() =>
      usePlannerActions({ warnings: [], onFeedback, onRequestReset: () => {} })
    );

    act(() => {
      result.current.loadTemplate('autark');
    });

    await waitFor(() =>
      expect(onFeedback).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }))
    );
  });
});
