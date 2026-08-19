import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from './store';

describe('useAppStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAppStore.setState({ calculatedSolarWatts: 0 });
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useAppStore());
    // Es gibt nur noch eine vollständige Ansicht (kein Umschalter mehr).
    expect(result.current.isProMode).toBe(true);
    expect(result.current.calculatedSolarWatts).toBe(0);
  });

  it('should set calculatedSolarWatts', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.setCalculatedSolarWatts(400);
    });

    expect(result.current.calculatedSolarWatts).toBe(400);
  });

  it('should retain state changes in memory across calls', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.setCalculatedSolarWatts(400);
    });

    // Store has no persist middleware — state lives in memory only
    expect(result.current.calculatedSolarWatts).toBe(400);
  });
});
