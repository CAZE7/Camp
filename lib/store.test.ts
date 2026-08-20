import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from './store';

describe('useAppStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAppStore.setState({ calculatedSolarWatts: 0, isProMode: false, hasOnboarded: false });
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useAppStore());
    expect(result.current.isProMode).toBe(false);
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
    expect(window.localStorage.getItem('werft-app-preferences-v1')).toContain('400');
  });

  it('persists onboarding and display preferences', () => {
    const { result } = renderHook(() => useAppStore());
    act(() => {
      result.current.setHasOnboarded(true);
      result.current.setIsProMode(true);
    });
    const saved = window.localStorage.getItem('werft-app-preferences-v1');
    expect(saved).toContain('"hasOnboarded":true');
    expect(saved).toContain('"isProMode":true');
  });
});
