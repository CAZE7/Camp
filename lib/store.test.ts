import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { APP_PREFERENCES_STORAGE_KEY } from './storageKeys';
import { useAppStore } from './store';

describe('useAppStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAppStore.setState({ calculatedSolarWatts: 0, hasOnboarded: false });
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useAppStore());
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

    expect(result.current.calculatedSolarWatts).toBe(400);
    expect(window.localStorage.getItem(APP_PREFERENCES_STORAGE_KEY)).toContain('400');
  });

  it('persists onboarding and solar wattage', () => {
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.setHasOnboarded(true);
      result.current.setCalculatedSolarWatts(320);
    });
    const saved = window.localStorage.getItem(APP_PREFERENCES_STORAGE_KEY);
    expect(saved).toContain('"hasOnboarded":true');
    expect(saved).toContain('"calculatedSolarWatts":320');
  });
});
