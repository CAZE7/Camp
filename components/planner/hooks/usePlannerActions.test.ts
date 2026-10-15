import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePlannerActions } from './usePlannerActions';
import { usePlannerStore } from '../../../store/usePlannerStore';

describe('usePlannerActions — Automatisch verbinden (B-11)', () => {
  beforeEach(() => {
    usePlannerStore.getState().clearPlan();
  });

  it('runs the electric auto-wire only in the electric view', () => {
    const autoWireSpy = vi.spyOn(usePlannerStore.getState(), 'autoWireSystem');
    const onFeedback = vi.fn();
    const { result } = renderHook(() =>
      usePlannerActions({ warnings: [], onFeedback, onRequestReset: () => {} })
    );

    usePlannerStore.setState({ viewMode: 'water' });
    act(() => result.current.runAutoWire());

    expect(onFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'info', message: expect.stringContaining('Wasser-Tab') })
    );
    // Im Wasser-Tab darf kein elektrischer Vorschlag entstehen.
    expect(usePlannerStore.getState().autoWirePreview).toBeFalsy();
    autoWireSpy.mockRestore();
  });
});
