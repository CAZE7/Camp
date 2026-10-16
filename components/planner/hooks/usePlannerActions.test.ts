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
    expect(feedback?.message).toContain('Wasser-Tab');
    // Im Wasser-Tab darf kein elektrischer Vorschlag entstehen (weder Vorschau noch Lauf).
    expect(usePlannerStore.getState().autoWirePreview).toBeFalsy();
  });
});
