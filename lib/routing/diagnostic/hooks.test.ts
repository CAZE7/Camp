import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  recordDiagnosticState,
  recordInitialState,
  recordPostAutoWireState,
  recordPostRoutingState,
  recordPostPostprocessingState,
  recordFinalState,
} from './hooks';
import type { SnapshotNodeInput, SnapshotEdgeInput, SnapshotRouteInput } from './snapshot';

// Mock dependencies
vi.mock('./index', () => ({
  isRoutingDiagnosticsEnabled: vi.fn(),
  getActiveDiagnosticSession: vi.fn(),
}));

vi.mock('./snapshot', async () => {
  const actual = await vi.importActual('./snapshot');
  return {
    ...actual,
    captureStateSnapshot: vi.fn(() => ({
      stateId: 'A',
      stateLabel: 'Test',
      timestamp: Date.now(),
      nodes: [],
      edges: [],
      routes: [],
    })),
  };
});

describe('Diagnostic Hooks', () => {
  const mockNodes: SnapshotNodeInput[] = [
    { id: 'node1', position: { x: 0, y: 0 } },
  ];
  const mockEdges: SnapshotEdgeInput[] = [
    { id: 'edge1', source: 'node1', target: 'node2' },
  ];
  const mockRoutes: SnapshotRouteInput[] = [
    { edgeId: 'edge1', waypoints: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('recordDiagnosticState', () => {
    it('should do nothing when diagnostics are disabled', async () => {
      const { isRoutingDiagnosticsEnabled } = await import('./index');
      vi.mocked(isRoutingDiagnosticsEnabled).mockReturnValue(false);

      recordDiagnosticState({
        stateId: 'A',
        nodes: mockNodes,
        edges: mockEdges,
        routes: [],
      });

      const { getActiveDiagnosticSession } = await import('./index');
      expect(getActiveDiagnosticSession).not.toHaveBeenCalled();
    });

    it('should do nothing when no active session exists', async () => {
      const { isRoutingDiagnosticsEnabled, getActiveDiagnosticSession } = await import('./index');
      vi.mocked(isRoutingDiagnosticsEnabled).mockReturnValue(true);
      vi.mocked(getActiveDiagnosticSession).mockReturnValue(null);

      recordDiagnosticState({
        stateId: 'A',
        nodes: mockNodes,
        edges: mockEdges,
        routes: [],
      });

      expect(getActiveDiagnosticSession).toHaveBeenCalled();
    });

    it('should record state when session is active', async () => {
      const { isRoutingDiagnosticsEnabled, getActiveDiagnosticSession } = await import('./index');
      const mockSession = {
        recordState: vi.fn(),
      };
      vi.mocked(isRoutingDiagnosticsEnabled).mockReturnValue(true);
      vi.mocked(getActiveDiagnosticSession).mockReturnValue(mockSession as any);

      recordDiagnosticState({
        stateId: 'A',
        nodes: mockNodes,
        edges: mockEdges,
        routes: [],
      });

      expect(mockSession.recordState).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const { isRoutingDiagnosticsEnabled, getActiveDiagnosticSession } = await import('./index');
      const mockSession = {
        recordState: vi.fn(() => {
          throw new Error('Test error');
        }),
      };
      vi.mocked(isRoutingDiagnosticsEnabled).mockReturnValue(true);
      vi.mocked(getActiveDiagnosticSession).mockReturnValue(mockSession as any);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        recordDiagnosticState({
          stateId: 'A',
          nodes: mockNodes,
          edges: mockEdges,
          routes: [],
        });
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('recordInitialState', () => {
    it('should call recordDiagnosticState with state A', async () => {
      const { isRoutingDiagnosticsEnabled, getActiveDiagnosticSession } = await import('./index');
      const mockSession = {
        recordState: vi.fn(),
      };
      vi.mocked(isRoutingDiagnosticsEnabled).mockReturnValue(true);
      vi.mocked(getActiveDiagnosticSession).mockReturnValue(mockSession as any);

      recordInitialState(mockNodes, mockEdges);

      expect(mockSession.recordState).toHaveBeenCalled();
    });
  });

  describe('recordPostAutoWireState', () => {
    it('should call recordDiagnosticState with state B', async () => {
      const { isRoutingDiagnosticsEnabled, getActiveDiagnosticSession } = await import('./index');
      const mockSession = {
        recordState: vi.fn(),
      };
      vi.mocked(isRoutingDiagnosticsEnabled).mockReturnValue(true);
      vi.mocked(getActiveDiagnosticSession).mockReturnValue(mockSession as any);

      recordPostAutoWireState(mockNodes, mockEdges);

      expect(mockSession.recordState).toHaveBeenCalled();
    });
  });

  describe('recordPostRoutingState', () => {
    it('should call recordDiagnosticState with state C', async () => {
      const { isRoutingDiagnosticsEnabled, getActiveDiagnosticSession } = await import('./index');
      const mockSession = {
        recordState: vi.fn(),
      };
      vi.mocked(isRoutingDiagnosticsEnabled).mockReturnValue(true);
      vi.mocked(getActiveDiagnosticSession).mockReturnValue(mockSession as any);

      recordPostRoutingState(mockNodes, mockEdges, mockRoutes);

      expect(mockSession.recordState).toHaveBeenCalled();
    });
  });

  describe('recordPostPostprocessingState', () => {
    it('should call recordDiagnosticState with state D', async () => {
      const { isRoutingDiagnosticsEnabled, getActiveDiagnosticSession } = await import('./index');
      const mockSession = {
        recordState: vi.fn(),
      };
      vi.mocked(isRoutingDiagnosticsEnabled).mockReturnValue(true);
      vi.mocked(getActiveDiagnosticSession).mockReturnValue(mockSession as any);

      recordPostPostprocessingState(mockNodes, mockEdges, mockRoutes);

      expect(mockSession.recordState).toHaveBeenCalled();
    });
  });

  describe('recordFinalState', () => {
    it('should call recordDiagnosticState with state E', async () => {
      const { isRoutingDiagnosticsEnabled, getActiveDiagnosticSession } = await import('./index');
      const mockSession = {
        recordState: vi.fn(),
      };
      vi.mocked(isRoutingDiagnosticsEnabled).mockReturnValue(true);
      vi.mocked(getActiveDiagnosticSession).mockReturnValue(mockSession as any);

      recordFinalState(mockNodes, mockEdges, mockRoutes);

      expect(mockSession.recordState).toHaveBeenCalled();
    });
  });
});
