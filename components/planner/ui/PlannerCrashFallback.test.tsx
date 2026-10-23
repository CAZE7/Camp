import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PLANNER_STORAGE_KEY } from '@/lib/storageKeys';
import { usePlannerStore } from '@/store/usePlannerStore';
import { PlannerCrashFallback } from './PlannerCrashFallback';

describe('PlannerCrashFallback (K3 Notfall-Rücksetzung)', () => {
  it('löscht korrupte localStorage-Daten, bereinigt #plan= aus der URL und stellt den Startplan wieder her', () => {
    window.localStorage.setItem(PLANNER_STORAGE_KEY, '{"corrupt":true}');
    window.history.replaceState(null, '', '/planer/?utm_source=forum&template=autark#plan=z.kaputt');
    usePlannerStore.setState({ nodes: [], edges: [] });

    const onRetry = vi.fn();
    render(<PlannerCrashFallback onRetry={onRetry} />);

    expect(screen.getByTestId('planner-crash-fallback')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('planner-crash-reset'));

    expect(window.localStorage.getItem(PLANNER_STORAGE_KEY)).toBeNull();
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?utm_source=forum');
    expect(usePlannerStore.getState().nodes.length).toBeGreaterThan(0);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
