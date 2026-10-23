import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePlannerActions } from './usePlannerActions';
import { usePlannerStore } from '../../../store/usePlannerStore';

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
