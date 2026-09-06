import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSequentialTapConnect } from './useSequentialTapConnect';
import { usePlannerStore } from '../../../store/usePlannerStore';
import { withSelector } from '../../../test-helpers/reactflowMocks';

// Mock the store
vi.mock('../../../store/usePlannerStore', () => ({
  usePlannerStore: vi.fn(),
}));

describe('useSequentialTapConnect', () => {
  let mockOnConnect: ReturnType<typeof vi.fn>;
  let mockIsValidConnection: ReturnType<typeof vi.fn>;
  let mockSetFirstTappedHandle: ReturnType<typeof vi.fn>;

  type FirstTapped = { nodeId: string; handleId: string; handleType: string };
  let currentFirstTappedHandle: FirstTapped | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    currentFirstTappedHandle = null;

    mockOnConnect = vi.fn();
    mockIsValidConnection = vi.fn().mockReturnValue(true);
    mockSetFirstTappedHandle = vi
      .fn()
      .mockImplementation(
        (update: FirstTapped | null | ((prev: FirstTapped | null) => FirstTapped | null)) => {
          if (typeof update === 'function') {
            currentFirstTappedHandle = update(currentFirstTappedHandle);
          } else {
            currentFirstTappedHandle = update;
          }
        }
      );

    // Mock implementation of usePlannerStore to return our mock functions based on the selector
    vi.mocked(usePlannerStore).mockImplementation(
      withSelector({
        onConnect: mockOnConnect,
        isValidConnection: mockIsValidConnection,
        setFirstTappedHandle: mockSetFirstTappedHandle,
      }) as typeof usePlannerStore
    );
  });

  afterEach(() => {
    // Clean up body
    document.body.innerHTML = '';
  });

  it('should attach and detach global click listener on mount and unmount', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useSequentialTapConnect());

    expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('should reset tap state if clicking somewhere else (not a handle)', () => {
    renderHook(() => useSequentialTapConnect());

    const div = document.createElement('div');
    document.body.appendChild(div);
    div.click();

    expect(mockSetFirstTappedHandle).toHaveBeenCalledWith(null);
  });

  it('should ignore clicks on elements with .react-flow__handle but no nodeId/handleId', () => {
    renderHook(() => useSequentialTapConnect());

    const handle = document.createElement('div');
    handle.classList.add('react-flow__handle');
    // Intentionally omit data-nodeid and data-handleid
    document.body.appendChild(handle);

    handle.click();

    // The setFirstTappedHandle should not be called with an updater function,
    // it will just not reach the `if (nodeId && handleId)` block.
    expect(mockSetFirstTappedHandle).not.toHaveBeenCalled();
  });

  it('should register first tapped handle', () => {
    renderHook(() => useSequentialTapConnect());

    const handle = document.createElement('div');
    handle.classList.add('react-flow__handle', 'source');
    handle.setAttribute('data-nodeid', 'node-1');
    handle.setAttribute('data-handleid', 'handle-1');
    document.body.appendChild(handle);

    handle.click();

    expect(mockSetFirstTappedHandle).toHaveBeenCalled();
    expect(currentFirstTappedHandle).toEqual({
      nodeId: 'node-1',
      handleId: 'handle-1',
      handleType: 'source',
    });
  });

  it('should cancel and reset state if the exact same handle is tapped twice', () => {
    renderHook(() => useSequentialTapConnect());

    const handle = document.createElement('div');
    handle.classList.add('react-flow__handle', 'source');
    handle.setAttribute('data-nodeid', 'node-1');
    handle.setAttribute('data-handleid', 'handle-1');
    document.body.appendChild(handle);

    handle.click(); // First tap
    expect(currentFirstTappedHandle).toEqual({
      nodeId: 'node-1',
      handleId: 'handle-1',
      handleType: 'source',
    });

    handle.click(); // Second tap on same handle
    expect(currentFirstTappedHandle).toBeNull();
    expect(mockOnConnect).not.toHaveBeenCalled();
  });

  it('should attempt connection on second tap if valid and reset state', () => {
    renderHook(() => useSequentialTapConnect());

    // First tap
    const handle1 = document.createElement('div');
    handle1.classList.add('react-flow__handle', 'source');
    handle1.setAttribute('data-nodeid', 'node-1');
    handle1.setAttribute('data-handleid', 'source-1');
    document.body.appendChild(handle1);

    handle1.click();
    expect(currentFirstTappedHandle).toEqual({
      nodeId: 'node-1',
      handleId: 'source-1',
      handleType: 'source',
    });

    // Second tap
    const handle2 = document.createElement('div');
    handle2.classList.add('react-flow__handle', 'target'); // target is implied if not source
    handle2.setAttribute('data-nodeid', 'node-2');
    handle2.setAttribute('data-handleid', 'target-2');
    document.body.appendChild(handle2);

    handle2.click();

    expect(mockIsValidConnection).toHaveBeenCalledWith({
      source: 'node-1',
      target: 'node-2',
      sourceHandle: 'source-1',
      targetHandle: 'target-2',
    });

    expect(mockOnConnect).toHaveBeenCalledWith({
      source: 'node-1',
      target: 'node-2',
      sourceHandle: 'source-1',
      targetHandle: 'target-2',
    });

    expect(currentFirstTappedHandle).toBeNull(); // Reset after attempt
  });

  it('should not call onConnect if connection is invalid, but still reset state', () => {
    mockIsValidConnection.mockReturnValue(false);

    renderHook(() => useSequentialTapConnect());

    // First tap
    const handle1 = document.createElement('div');
    handle1.classList.add('react-flow__handle', 'target');
    handle1.setAttribute('data-nodeid', 'node-1');
    handle1.setAttribute('data-handleid', 'target-1');
    document.body.appendChild(handle1);

    handle1.click();

    // Second tap
    const handle2 = document.createElement('div');
    handle2.classList.add('react-flow__handle', 'source');
    handle2.setAttribute('data-nodeid', 'node-2');
    handle2.setAttribute('data-handleid', 'source-2');
    document.body.appendChild(handle2);

    handle2.click();

    expect(mockIsValidConnection).toHaveBeenCalled();
    expect(mockOnConnect).not.toHaveBeenCalled();
    expect(currentFirstTappedHandle).toBeNull();
  });
});
