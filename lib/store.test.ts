import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from './store';

describe('useAppStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAppStore.setState({ isProMode: false, calculatedSolarWatts: 0 });
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useAppStore());
    expect(result.current.isProMode).toBe(false);
    expect(result.current.calculatedSolarWatts).toBe(0);
  });

  it('should toggle isProMode', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.toggleProMode();
    });
    expect(result.current.isProMode).toBe(true);

    act(() => {
      result.current.toggleProMode();
    });
    expect(result.current.isProMode).toBe(false);
  });

  it('should set calculatedSolarWatts', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.setCalculatedSolarWatts(400);
    });

    expect(result.current.calculatedSolarWatts).toBe(400);
  });

  it('should persist state to localStorage', () => {
    const { result } = renderHook(() => useAppStore());

    act(() => {
      result.current.setCalculatedSolarWatts(400);
      result.current.toggleProMode();
    });

    const storedState = JSON.parse(window.localStorage.getItem('camper-app-storage') || '{}');
    expect(storedState.state.calculatedSolarWatts).toBe(400);
    expect(storedState.state.isProMode).toBe(true);
  });
});
