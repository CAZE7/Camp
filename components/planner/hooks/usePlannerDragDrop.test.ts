import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlannerDragDrop } from './usePlannerDragDrop';
import { usePlannerStore } from '../../../store/usePlannerStore';

// Mock the store
vi.mock('../../../store/usePlannerStore', () => ({
  usePlannerStore: vi.fn(),
}));

describe('usePlannerDragDrop', () => {
  const mockOnDrop = vi.fn();
  const mockOnCustomDrop = vi.fn();
  const mockScreenToFlowPosition = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock implementation of usePlannerStore to return our mock functions based on the selector
    (usePlannerStore as unknown as any).mockImplementation((selector: any) => {
      const mockState = {
        onDrop: mockOnDrop,
        onCustomDrop: mockOnCustomDrop,
      };
      return selector(mockState);
    });
  });

  it('should initialize and return onDragOver and onDrop handlers', () => {
    const { result } = renderHook(() => usePlannerDragDrop(mockScreenToFlowPosition));

    expect(typeof result.current.onDragOver).toBe('function');
    expect(typeof result.current.onDrop).toBe('function');
  });

  it('onDragOver should call preventDefault and set dropEffect to move', () => {
    const { result } = renderHook(() => usePlannerDragDrop(mockScreenToFlowPosition));

    const preventDefault = vi.fn();
    const mockEvent = {
      preventDefault,
      dataTransfer: {
        dropEffect: 'none',
      },
    } as unknown as React.DragEvent;

    result.current.onDragOver(mockEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(mockEvent.dataTransfer.dropEffect).toBe('move');
  });

  it('onDrop should call the store onDrop with event and screenToFlowPosition', () => {
    const { result } = renderHook(() => usePlannerDragDrop(mockScreenToFlowPosition));

    const mockEvent = {
      preventDefault: vi.fn(),
    } as unknown as React.DragEvent;

    result.current.onDrop(mockEvent);

    expect(mockOnDrop).toHaveBeenCalledWith(mockEvent, mockScreenToFlowPosition);
  });

  it('should listen to custom-node-drop event and call store onCustomDrop', () => {
    renderHook(() => usePlannerDragDrop(mockScreenToFlowPosition));

    const customEvent = new Event('custom-node-drop');
    window.dispatchEvent(customEvent);

    expect(mockOnCustomDrop).toHaveBeenCalledWith(customEvent, mockScreenToFlowPosition);
  });

  it('should clean up custom-node-drop event listener on unmount', () => {
    const { unmount } = renderHook(() => usePlannerDragDrop(mockScreenToFlowPosition));

    // Unmount to trigger cleanup
    unmount();

    // Dispatch event after unmount
    const customEvent = new Event('custom-node-drop');
    window.dispatchEvent(customEvent);

    // Should not be called
    expect(mockOnCustomDrop).not.toHaveBeenCalled();
  });
});
