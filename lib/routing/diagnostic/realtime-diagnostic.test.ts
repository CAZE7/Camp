import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RealtimeDiagnosticBroadcaster,
  type RealtimeEvent,
  type StateProgressEvent,
  type RouteCompletedEvent,
  type QualityIssueEvent,
} from './realtime-diagnostic';

describe('Realtime Diagnostic Broadcaster', () => {
  let broadcaster: RealtimeDiagnosticBroadcaster;

  beforeEach(() => {
    broadcaster = new RealtimeDiagnosticBroadcaster();
  });

  describe('Event Subscription', () => {
    it('should subscribe to specific event types', () => {
      const handler = vi.fn();
      const unsubscribe = broadcaster.on('state-started', handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call handler when event is emitted', () => {
      const handler = vi.fn();
      broadcaster.on('state-started', handler);

      const event: RealtimeEvent = {
        type: 'state-started',
        timestamp: Date.now(),
        stateId: 'A',
      };

      broadcaster.emit(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should not call handler for different event types', () => {
      const handler = vi.fn();
      broadcaster.on('state-started', handler);

      const event: RealtimeEvent = {
        type: 'state-completed',
        timestamp: Date.now(),
        stateId: 'A',
      };

      broadcaster.emit(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should unsubscribe handler', () => {
      const handler = vi.fn();
      const unsubscribe = broadcaster.on('state-started', handler);

      unsubscribe();

      const event: RealtimeEvent = {
        type: 'state-started',
        timestamp: Date.now(),
        stateId: 'A',
      };

      broadcaster.emit(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should subscribe to all events', () => {
      const handler = vi.fn();
      const unsubscribe = broadcaster.onAll(handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call all-events handler for any event', () => {
      const handler = vi.fn();
      broadcaster.onAll(handler);

      const event1: RealtimeEvent = {
        type: 'state-started',
        timestamp: Date.now(),
        stateId: 'A',
      };

      const event2: RealtimeEvent = {
        type: 'state-completed',
        timestamp: Date.now(),
        stateId: 'B',
      };

      broadcaster.emit(event1);
      broadcaster.emit(event2);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(event1);
      expect(handler).toHaveBeenCalledWith(event2);
    });
  });

  describe('Event History', () => {
    it('should store event history', () => {
      const event: RealtimeEvent = {
        type: 'state-started',
        timestamp: Date.now(),
        stateId: 'A',
      };

      broadcaster.emit(event);

      const history = broadcaster.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(event);
    });

    it('should limit history size', () => {
      broadcaster.setMaxHistorySize(10);

      for (let i = 0; i < 15; i++) {
        broadcaster.emit({
          type: 'state-started',
          timestamp: Date.now(),
          stateId: 'A',
        });
      }

      const history = broadcaster.getHistory();
      expect(history.length).toBeLessThanOrEqual(10);
    });

    it('should clear history', () => {
      broadcaster.emit({
        type: 'state-started',
        timestamp: Date.now(),
        stateId: 'A',
      });

      broadcaster.clearHistory();

      const history = broadcaster.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('Pause/Resume', () => {
    it('should pause event emission', () => {
      const handler = vi.fn();
      broadcaster.on('state-started', handler);

      broadcaster.pause();

      broadcaster.emit({
        type: 'state-started',
        timestamp: Date.now(),
        stateId: 'A',
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should resume event emission', () => {
      const handler = vi.fn();
      broadcaster.on('state-started', handler);

      broadcaster.pause();
      broadcaster.resume();

      broadcaster.emit({
        type: 'state-started',
        timestamp: Date.now(),
        stateId: 'A',
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should queue events when paused', () => {
      const handler = vi.fn();
      broadcaster.on('state-started', handler);

      broadcaster.pause();

      broadcaster.emit({
        type: 'state-started',
        timestamp: Date.now(),
        stateId: 'A',
      });

      broadcaster.resume();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('Specific Event Types', () => {
    it('should emit state-progress events', () => {
      const handler = vi.fn();
      broadcaster.on('state-progress', handler);

      const event: StateProgressEvent = {
        type: 'state-progress',
        timestamp: Date.now(),
        stateId: 'C',
        data: {
          progress: 50,
          completedEdges: 5,
          totalEdges: 10,
        },
      };

      broadcaster.emit(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should emit route-completed events', () => {
      const handler = vi.fn();
      broadcaster.on('route-completed', handler);

      const event: RouteCompletedEvent = {
        type: 'route-completed',
        timestamp: Date.now(),
        stateId: 'C',
        data: {
          edgeId: 'edge1',
          durationMs: 100,
          length: 50,
          bends: 2,
          usedFallback: false,
        },
      };

      broadcaster.emit(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should emit quality-issue events', () => {
      const handler = vi.fn();
      broadcaster.on('quality-issue', handler);

      const event: QualityIssueEvent = {
        type: 'quality-issue',
        timestamp: Date.now(),
        stateId: 'D',
        data: {
          severity: 'warning',
          message: 'High bend count',
          edgeId: 'edge1',
          metric: 'bends',
          value: 10,
        },
      };

      broadcaster.emit(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should emit error events', () => {
      const handler = vi.fn();
      broadcaster.on('error', handler);

      const event: RealtimeEvent = {
        type: 'error',
        timestamp: Date.now(),
        data: {
          message: 'Routing failed',
          error: new Error('Test error'),
        },
      };

      broadcaster.emit(event);

      expect(handler).toHaveBeenCalledWith(event);
    });
  });

  describe('State Convenience Methods', () => {
    it('should emit state-started via startState', () => {
      const handler = vi.fn();
      broadcaster.on('state-started', handler);

      broadcaster.startState('A', 'Initial state');

      expect(handler).toHaveBeenCalled();
      const event = handler.mock.calls[0][0];
      expect(event.type).toBe('state-started');
      expect(event.stateId).toBe('A');
    });

    it('should emit state-completed via completeState', () => {
      const handler = vi.fn();
      broadcaster.on('state-completed', handler);

      broadcaster.completeState('A', { durationMs: 100 });

      expect(handler).toHaveBeenCalled();
      const event = handler.mock.calls[0][0];
      expect(event.type).toBe('state-completed');
      expect(event.stateId).toBe('A');
    });

    it('should emit state-progress via updateProgress', () => {
      const handler = vi.fn();
      broadcaster.on('state-progress', handler);

      broadcaster.updateProgress('C', 50, 5, 10);

      expect(handler).toHaveBeenCalled();
      const event = handler.mock.calls[0][0];
      expect(event.type).toBe('state-progress');
      expect(event.data.progress).toBe(50);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in event handlers', () => {
      const errorHandler = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      broadcaster.on('state-started', () => {
        throw new Error('Handler error');
      });

      broadcaster.on('error', errorHandler);

      broadcaster.emit({
        type: 'state-started',
        timestamp: Date.now(),
        stateId: 'A',
      });

      expect(errorHandler).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
