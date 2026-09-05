/**
 * Worker-Pool für das pathfinding-ESC — optional, erst wenn Phase A–D
 * messbaren Gewinn zeigen (kein Premature-Optimization).
 *
 * Architektur:
 *   - Ein `PathWorker` pro Browse-tab (singleton über `usePlannerStore`).
 *   - Anfragen werden als `SerializablePathRequest` geserialisiert und
 *     per `postMessage` an den Worker geschickt.
 *   - Ergebnisse kommen als `PathResultSerialized` zurück und werden
 *     in den Kabel-Route-Cache eingetragen.
 *   - Der Worker importiert `findCablePath` aus `pathfinding.ts` und führt
 *     die Suche durch — kein React, kein DOM, nur reine Funktionen.
 *
 * Hinweis: In small-tab-Implementierungen (z.B. mobile Safari) kann der
 * Worker selbst zu langsam sein. Daher ist der Pool konfigurierbar:
 *   - `enabled = false` → alle Suchen im Haupt-Thread (fallback).
 *   - `enabled = true` → Worker genutzt, aber Haupt-Thread bleibt als
 *     Fallback bereit (Worker-Start fehlerhaft → Automatik auf false).
 *
 * Serialisierungsprotokoll:
 *   Anfrage: `{ type: 'route', request: SerializablePathRequest }`
 *   Ergebnis: `{ type: 'result', id: string, result: PathResultSerialized }`
 *   Fehler:   `{ type: 'error', id: string, message: string }`
 */



// ---------------------------------------------------------------------------
// Serialisierbare Typen (M6-10, Worker-Portabilität)
// ---------------------------------------------------------------------------

export const WORKER_ENABLED_KEY = 'camp.routing.workerEnabled';

/** Anfrage, die per postMessage an den Worker geschickt werden kann.
 * Nur primitive Typen (Zahlen, Strings, Arrays) — kein React-Flow-Imports. */
export type SerializablePathRequest = {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  /** Position-Konstanten als String (Position.Right → 'right'). */
  sourcePosition?: string;
  targetPosition?: string;
  offset?: number;
  /** Aufgeblähte Hindernis-Rechtecke (nach OBSTACLE_MARGIN). */
  obstacles: Array<{ x: number; y: number; width: number; height: number }>;
  /** Kreuzungssegmente als Paare. */
  crossingSegments: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }>;
  borderRadius?: number;
  /** Cache-Schlüssel für den Worker-internen LRU-Cache (optional). */
  cacheKey?: string;
};

/** Ergebnis aus dem Worker — ebenso nur primitive Typen. */
export type PathResultSerialized = {
  path: string;
  waypoints: Array<{ x: number; y: number }>;
  labelX: number;
  labelY: number;
  offsetX: number;
  offsetY: number;
  length: number;
  bends: number;
  crossings: number;
  usedSearch: 'catalog' | 'astar' | 'fallback';
};

/** Serielle Nachricht an den Worker. */
export type WorkerRequest = {
  type: 'route';
  id: string;
  request: SerializablePathRequest;
};

/** Serielle Nachricht vom Worker. */
export type WorkerResponse =
  | { type: 'result'; id: string; result: PathResultSerialized }
  | { type: 'error'; id: string; message: string };

// ---------------------------------------------------------------------------
// Worker-Pool (Singleton)
// ---------------------------------------------------------------------------

type WorkerStatus = 'idle' | 'busy' | 'error';

type PendingRequest = {
  resolve: (result: PathResultSerialized) => void;
  reject: (error: Error) => void;
};

class WorkerPool {
  private worker: Worker | null = null;
  private status: WorkerStatus = 'idle';
  private pending: Map<string, PendingRequest> = new Map();
  private enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  /** Worker-Instanz initialisieren (nur einmal pro Session). */
  init(workerUrl: string): void {
    if (!this.enabled) return;
    if (this.worker) return;

    try {
      this.worker = new Worker(workerUrl, { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        const pending = this.pending.get(msg.id);
        if (!pending) return;

        if (msg.type === 'result') {
          pending.resolve(msg.result);
        } else {
          pending.reject(new Error(msg.message));
        }
        this.pending.delete(msg.id);
        if (this.pending.size === 0) {
          this.status = 'idle';
        }
      };

      this.worker.onerror = (error: ErrorEvent) => {
        for (const pending of this.pending.values()) {
          pending.reject(new Error(error.message));
        }
        this.pending.clear();
        this.status = 'error';
      };

      this.status = 'idle';
    } catch (error) {
      this.enabled = false;
      console.warn(`[WorkerPool] Worker-Initialisierung fehlgeschlagen, Fallback auf Haupt-Thread: ${error}`);
    }
  }

  /** Anfrage an den Worker senden. Gibt `null` zurück, wenn Worker deaktiviert. */
  request(id: string, request: SerializablePathRequest): Promise<PathResultSerialized> | null {
    if (!this.enabled || !this.worker || this.status === 'error') {
      return null;
    }

    this.status = 'busy';
    return new Promise<PathResultSerialized>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ type: 'route', id, request } as WorkerRequest);
    });
  }

  /** Status abfragen (für Progress-Indikatoren). */
  getStatus(): WorkerStatus {
    return this.status;
  }

  /** Worker herunterfahren (z.B. beim Unmount). */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pending.clear();
    this.status = 'idle';
  }
}

// Singleton-Instanz (wird von usePlannerStore initialisiert)
let poolInstance: WorkerPool | null = null;

export const getWorkerPool = (): WorkerPool | null => poolInstance;

export const createWorkerPool = (enabled: boolean = false): WorkerPool => {
  poolInstance = new WorkerPool(enabled);
  return poolInstance;
};

export const destroyWorkerPool = (): void => {
  if (poolInstance) {
    poolInstance.terminate();
    poolInstance = null;
  }
};

// ---------------------------------------------------------------------------
// Konvertierungshilfen (Haupt-Thread ↔ Worker)
// ---------------------------------------------------------------------------

/** Position-Konstante in String umwandeln (für Serialisierung). */
export const positionToString = (position: string | undefined): string | undefined => position?.toLowerCase();

/** String zurück in Position-Konstante (für Deserialisierung im Worker). */
export const stringToPosition = (
  str: string | undefined
): 'left' | 'right' | 'top' | 'bottom' | undefined => {
  if (!str) return undefined;
  const lower = str.toLowerCase();
  if (lower === 'left' || lower === 'right' || lower === 'top' || lower === 'bottom') {
    return lower as 'left' | 'right' | 'top' | 'bottom';
  }
  return undefined;
};
