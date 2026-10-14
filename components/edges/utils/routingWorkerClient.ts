import type { RoutingJob, RoutingJobReply, RoutingJobResult } from './routingJob';

/** 50-node dense probe ~2.5s. 10s watchdog allows startup/slower devices; not an optimality budget. */
export const ROUTING_WORKER_TIMEOUT_MS = 10_000;
type Outcome = { stale: true } | { stale: false; result: RoutingJobResult };

/** One worker, one pending request. Cancelling really terminates computation, not just its Promise. */
export function createRoutingWorkerClient(
  createWorker: () => Worker = () =>
    new Worker(new URL('./routing.worker.ts', import.meta.url), { type: 'module' }),
  timeoutMs = ROUTING_WORKER_TIMEOUT_MS
) {
  let worker: Worker | undefined;
  let cancelPending: (() => void) | undefined;
  const terminate = () => {
    worker?.terminate();
    worker = undefined;
  };
  const cancel = () => {
    cancelPending?.();
    cancelPending = undefined;
  };
  return {
    cancel,
    dispose() {
      cancel();
      terminate();
    },
    request(job: RoutingJob): Promise<Outcome> {
      cancel();
      return new Promise((resolve, reject) => {
        let active: Worker;
        try {
          active = worker ??= createWorker();
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        let done = false;
        const finish = () => {
          if (done) return false;
          done = true;
          clearTimeout(timer);
          active.onmessage = null;
          active.onerror = null;
          active.onmessageerror = null;
          cancelPending = undefined;
          return true;
        };
        const fail = (message: string) => {
          if (finish()) {
            terminate();
            reject(new Error(message));
          }
        };
        const timer = setTimeout(
          () => fail(`Routing-Zeitbudget (${timeoutMs} ms) überschritten; Berechnung abgebrochen.`),
          timeoutMs
        );
        cancelPending = () => {
          if (finish()) {
            terminate();
            resolve({ stale: true });
          }
        };
        active.onmessage = (event: MessageEvent<RoutingJobReply>) => {
          if (!finish()) return;
          if (event.data.error !== undefined) reject(new Error(event.data.error));
          else resolve({ stale: false, result: event.data.result });
        };
        active.onerror = (event) => fail(event.message || 'Routing-Worker fehlgeschlagen.');
        active.onmessageerror = () => fail('Routing-Ergebnis konnte nicht gelesen werden.');
        try {
          active.postMessage(job);
        } catch (error) {
          fail(error instanceof Error ? error.message : String(error));
        }
      });
    },
  };
}
