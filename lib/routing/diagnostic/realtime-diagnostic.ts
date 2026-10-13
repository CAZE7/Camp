/**
 * Realtime Diagnostic Updates
 * 
 * Live-Updates während des Routing-Prozesses.
 * Nutzt EventEmitter für Browser-Kompatibilität.
 * Kann später auf WebSocket erweitert werden.
 */

import type {
  DiagnosticStateId,
  RoutingMetrics,
  DiagnosticStateSnapshot,
} from './types';

// ============================================================================
// Types
// ============================================================================

export type RealtimeEventType =
  | 'state-started'
  | 'state-progress'
  | 'state-completed'
  | 'metric-updated'
  | 'route-completed'
  | 'quality-issue'
  | 'error';

export interface RealtimeEvent {
  type: RealtimeEventType;
  timestamp: number;
  stateId?: DiagnosticStateId;
  data?: any;
}

export interface StateProgressEvent extends RealtimeEvent {
  type: 'state-progress';
  stateId: DiagnosticStateId;
  data: {
    progress: number; // 0-100
    currentEdge?: string;
    completedEdges: number;
    totalEdges: number;
    estimatedTimeRemaining?: number;
  };
}

export interface RouteCompletedEvent extends RealtimeEvent {
  type: 'route-completed';
  stateId: DiagnosticStateId;
  data: {
    edgeId: string;
    durationMs: number;
    length: number;
    bends: number;
    usedFallback: boolean;
  };
}

export interface QualityIssueEvent extends RealtimeEvent {
  type: 'quality-issue';
  stateId: DiagnosticStateId;
  data: {
    severity: 'warning' | 'error' | 'critical';
    message: string;
    edgeId?: string;
    metric?: string;
    value?: number;
  };
}

export type RealtimeEventHandler = (event: RealtimeEvent) => void;

// ============================================================================
// Realtime Diagnostic Broadcaster
// ============================================================================

export class RealtimeDiagnosticBroadcaster {
  private listeners: Map<RealtimeEventType, Set<RealtimeEventHandler>> = new Map();
  private allListeners: Set<RealtimeEventHandler> = new Set();
  private eventHistory: RealtimeEvent[] = [];
  private maxHistorySize = 1000;
  private isPaused = false;

  constructor() {
    // Initialize listener maps for all event types
    const eventTypes: RealtimeEventType[] = [
      'state-started',
      'state-progress',
      'state-completed',
      'metric-updated',
      'route-completed',
      'quality-issue',
      'error',
    ];
    eventTypes.forEach((type) => this.listeners.set(type, new Set()));
  }

  /**
   * Subscribe to specific event type
   */
  on(type: RealtimeEventType, handler: RealtimeEventHandler): () => void {
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.add(handler);
    }

    // Return unsubscribe function
    return () => {
      handlers?.delete(handler);
    };
  }

  /**
   * Subscribe to all events
   */
  onAll(handler: RealtimeEventHandler): () => void {
    this.allListeners.add(handler);
    return () => {
      this.allListeners.delete(handler);
    };
  }

  /**
   * Emit event to all listeners
   */
  emit(event: RealtimeEvent): void {
    if (this.isPaused) return;

    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify specific listeners
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      });
    }

    // Notify all-listeners
    this.allListeners.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in all-event handler:', error);
      }
    });
  }

  /**
   * Emit state started event
   */
  emitStateStarted(stateId: DiagnosticStateId, stateLabel: string): void {
    this.emit({
      type: 'state-started',
      timestamp: Date.now(),
      stateId,
      data: { stateLabel },
    });
  }

  /**
   * Emit state progress event
   */
  emitStateProgress(
    stateId: DiagnosticStateId,
    progress: number,
    completedEdges: number,
    totalEdges: number,
    currentEdge?: string
  ): void {
    this.emit({
      type: 'state-progress',
      timestamp: Date.now(),
      stateId,
      data: {
        progress,
        completedEdges,
        totalEdges,
        currentEdge,
      },
    } as StateProgressEvent);
  }

  /**
   * Emit state completed event
   */
  emitStateCompleted(
    stateId: DiagnosticStateId,
    metrics: RoutingMetrics,
    durationMs: number
  ): void {
    this.emit({
      type: 'state-completed',
      timestamp: Date.now(),
      stateId,
      data: { metrics, durationMs },
    });
  }

  /**
   * Emit route completed event
   */
  emitRouteCompleted(
    stateId: DiagnosticStateId,
    edgeId: string,
    durationMs: number,
    length: number,
    bends: number,
    usedFallback: boolean
  ): void {
    this.emit({
      type: 'route-completed',
      timestamp: Date.now(),
      stateId,
      data: {
        edgeId,
        durationMs,
        length,
        bends,
        usedFallback,
      },
    } as RouteCompletedEvent);
  }

  /**
   * Emit quality issue event
   */
  emitQualityIssue(
    stateId: DiagnosticStateId,
    severity: 'warning' | 'error' | 'critical',
    message: string,
    edgeId?: string,
    metric?: string,
    value?: number
  ): void {
    this.emit({
      type: 'quality-issue',
      timestamp: Date.now(),
      stateId,
      data: {
        severity,
        message,
        edgeId,
        metric,
        value,
      },
    } as QualityIssueEvent);
  }

  /**
   * Emit error event
   */
  emitError(message: string, details?: any): void {
    this.emit({
      type: 'error',
      timestamp: Date.now(),
      data: { message, details },
    });
  }

  /**
   * Get event history
   */
  getHistory(type?: RealtimeEventType): RealtimeEvent[] {
    if (type) {
      return this.eventHistory.filter((e) => e.type === type);
    }
    return [...this.eventHistory];
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Pause event emission
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume event emission
   */
  resume(): void {
    this.isPaused = false;
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.forEach((handlers) => handlers.clear());
    this.allListeners.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalBroadcaster: RealtimeDiagnosticBroadcaster | null = null;

export function getRealtimeBroadcaster(): RealtimeDiagnosticBroadcaster {
  if (!globalBroadcaster) {
    globalBroadcaster = new RealtimeDiagnosticBroadcaster();
  }
  return globalBroadcaster;
}

export function resetRealtimeBroadcaster(): void {
  if (globalBroadcaster) {
    globalBroadcaster.removeAllListeners();
    globalBroadcaster.clearHistory();
  }
  globalBroadcaster = null;
}

// ============================================================================
// React Hook (for future use)
// ============================================================================

/**
 * React hook for subscribing to realtime diagnostic events
 * 
 * Usage:
 * ```tsx
 * function DiagnosticStatus() {
 *   const [progress, setProgress] = useState(0);
 *   
 *   useRealtimeDiagnostic('state-progress', (event) => {
 *     if (event.type === 'state-progress') {
 *       setProgress(event.data.progress);
 *     }
 *   });
 *   
 *   return <div>Progress: {progress}%</div>;
 * }
 * ```
 */
export function createUseRealtimeDiagnostic() {
  return function useRealtimeDiagnostic(
    type: RealtimeEventType,
    handler: RealtimeEventHandler
  ): void {
    // This would use React's useEffect in actual implementation
    // For now, we provide the structure
    const broadcaster = getRealtimeBroadcaster();
    const unsubscribe = broadcaster.on(type, handler);
    
    // In React, this would be:
    // useEffect(() => {
    //   const unsubscribe = broadcaster.on(type, handler);
    //   return unsubscribe;
    // }, [type, handler]);
    
    return unsubscribe();
  };
}

// ============================================================================
// WebSocket Adapter (for future use)
// ============================================================================

export interface WebSocketAdapter {
  connect(url: string): void;
  disconnect(): void;
  send(event: RealtimeEvent): void;
  onMessage(handler: (event: RealtimeEvent) => void): void;
}

export class WebSocketDiagnosticAdapter implements WebSocketAdapter {
  private ws: WebSocket | null = null;
  private messageHandler: ((event: RealtimeEvent) => void) | null = null;
  private broadcaster: RealtimeDiagnosticBroadcaster;

  constructor(broadcaster: RealtimeDiagnosticBroadcaster) {
    this.broadcaster = broadcaster;
  }

  connect(url: string): void {
    if (typeof WebSocket === 'undefined') {
      console.warn('WebSocket not available in this environment');
      return;
    }

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('✅ WebSocket connected to', url);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RealtimeEvent;
        if (this.messageHandler) {
          this.messageHandler(data);
        }
        // Forward to local broadcaster
        this.broadcaster.emit(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(event: RealtimeEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  onMessage(handler: (event: RealtimeEvent) => void): void {
    this.messageHandler = handler;
  }
}

// ============================================================================
// Integration Helper
// ============================================================================

/**
 * Helper to integrate realtime diagnostics into routing pipeline
 * 
 * Usage in routeAll.ts:
 * ```ts
 * import { createRealtimeProgressTracker } from '@/lib/routing/diagnostic/realtime-diagnostic';
 * 
 * const tracker = createRealtimeProgressTracker('C', edges.length);
 * 
 * for (const edge of edges) {
 *   tracker.startEdge(edge.id);
 *   const route = await routeEdge(edge);
 *   tracker.completeEdge(edge.id, route);
 * }
 * 
 * tracker.complete();
 * ```
 */
export function createRealtimeProgressTracker(
  stateId: DiagnosticStateId,
  totalEdges: number
) {
  const broadcaster = getRealtimeBroadcaster();
  let completedEdges = 0;
  const startTime = Date.now();

  return {
    start(): void {
      broadcaster.emitStateStarted(stateId, `State ${stateId}`);
    },

    startEdge(edgeId: string): void {
      const progress = (completedEdges / totalEdges) * 100;
      broadcaster.emitStateProgress(stateId, progress, completedEdges, totalEdges, edgeId);
    },

    completeEdge(
      edgeId: string,
      route: { length: number; bends: number; durationMs: number; usedFallback: boolean }
    ): void {
      completedEdges++;
      broadcaster.emitRouteCompleted(
        stateId,
        edgeId,
        route.durationMs,
        route.length,
        route.bends,
        route.usedFallback
      );

      // Check for quality issues
      if (route.usedFallback) {
        broadcaster.emitQualityIssue(
          stateId,
          'warning',
          `Route ${edgeId} used fallback`,
          edgeId,
          'fallbackRoutes',
          1
        );
      }
    },

    complete(metrics: RoutingMetrics): void {
      const durationMs = Date.now() - startTime;
      broadcaster.emitStateCompleted(stateId, metrics, durationMs);
    },

    reportIssue(
      severity: 'warning' | 'error' | 'critical',
      message: string,
      edgeId?: string
    ): void {
      broadcaster.emitQualityIssue(stateId, severity, message, edgeId);
    },
  };
}
