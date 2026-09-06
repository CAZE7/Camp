import { buildElkGraph, parseElkResult, type ElkGraph, type ElkLayoutResult, type ElkPlan } from './graph';

/**
 * WP-4 (#393): ELK-Runner — asynchrone Ausführung mit Timeout und
 * Letzte-Anfrage-gewinnt (Worker-Vertrag P-6, Spec §6.3).
 *
 * Transportstrategie:
 * - Browser: dynamischer Import von elkjs; elkjs bringt seinen EIGENEN
 *   Web Worker mit (`elk-worker`), der die Layout-Rechnung vom Main-Thread
 *   nimmt. Der dynamische Import hält elkjs (~1,4 MB) aus dem
 *   Initial-Bundle (Lighthouse-Gate M11-5).
 * - Tests/Node: identischer Pfad ohne Worker (elkjs erkennt die Umgebung).
 *
 * Verträge:
 * - TIMEOUT: `layoutWithElk` verwirft die Rechnung nach `timeoutMs` und
 *   lehnt mit `ElkTimeoutError` ab — der Aufrufer fällt auf den
 *   bestehenden Router zurück (Spec: „Bestehender Router bleibt Fallback").
 * - LETZTE ANFRAGE GEWINNT: `createElkSession` nummeriert Anfragen; jede
 *   neue Anfrage invalidiert alle laufenden. Veraltete Antworten lösen
 *   mit `stale: true` auf und dürfen NIE in den Store geschrieben werden —
 *   keine Race-Pfade bei schnellen Drag-Updates.
 */

export class ElkTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`ELK-Layout nach ${timeoutMs} ms abgebrochen — Fallback auf bestehenden Router`);
    this.name = 'ElkTimeoutError';
  }
}

/** Default-Timeout: großzügig über dem 100+-Kanten-Referenzplan (<1 s). */
export const ELK_TIMEOUT_MS = 3000;

type ElkInstance = { layout: (graph: ElkGraph) => Promise<ElkGraph> };
type ElkConstructor = new () => ElkInstance;

let elkInstance: ElkInstance | null = null;

/** Lazy-Singleton — elkjs wird erst beim ersten Layout geladen. */
async function getElk(): Promise<ElkInstance> {
  if (elkInstance) return elkInstance;
  // Dynamischer Import (Bundle-Split): bundled-Variante funktioniert in
  // Browser UND Node (Vitest) identisch.
  const mod = (await import('elkjs/lib/elk.bundled.js')) as unknown as {
    default: ElkConstructor;
  };
  const Elk = mod.default;
  elkInstance = new Elk();
  return elkInstance;
}

/** @internal Nur für Tests: Instanz austauschen/zurücksetzen. */
export function setElkInstanceForTest(instance: ElkInstance | null): void {
  elkInstance = instance;
}

/** Einmaliges Layout mit Timeout. */
export async function layoutWithElk(
  plan: ElkPlan,
  options?: { timeoutMs?: number }
): Promise<ElkLayoutResult> {
  const timeoutMs = options?.timeoutMs ?? ELK_TIMEOUT_MS;
  const graph = buildElkGraph(plan);
  const elk = await getElk();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      elk.layout(graph),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ElkTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
    return parseElkResult(result);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export type ElkSessionResult = { stale: false; result: ElkLayoutResult } | { stale: true; result: null };

export type ElkSession = {
  /**
   * Neue Layout-Anfrage; invalidiert alle laufenden. Veraltete Antworten
   * lösen mit `stale: true` auf (statt zu rejecten) — der Aufrufer prüft
   * das Flag und schreibt nur frische Ergebnisse.
   */
  request: (plan: ElkPlan, options?: { timeoutMs?: number }) => Promise<ElkSessionResult>;
  /** Sequenznummer der letzten Anfrage (Diagnose/Tests). */
  currentSeq: () => number;
};

/** Serialisierung für Drag-Szenarien: die letzte Anfrage gewinnt (P-6). */
export function createElkSession(): ElkSession {
  let seq = 0;
  return {
    async request(plan, options) {
      const mySeq = ++seq;
      try {
        const result = await layoutWithElk(plan, options);
        if (mySeq !== seq) return { stale: true, result: null };
        return { stale: false, result };
      } catch (error) {
        // Auch Fehler veralteter Anfragen sind bedeutungslos.
        if (mySeq !== seq) return { stale: true, result: null };
        throw error;
      }
    },
    currentSeq: () => seq,
  };
}
