import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoutingWorkerClient } from './routingWorkerClient';
import { runRoutingJob, type RoutingJob, type RoutingJobReply } from './routingJob';
import { routingSnapshot, routingSnapshotNodes } from './routingSnapshot';
import { routeAllCables } from './routeAll';
import { routingFixtures } from '../../../benchmarks/routing/fixtures';

class FakeWorker {
  onmessage: ((event: MessageEvent<RoutingJobReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  reply(reply: RoutingJobReply) {
    this.onmessage?.({ data: reply } as MessageEvent<RoutingJobReply>);
  }
}
const job: RoutingJob = { snapshot: { nodes: [], edges: [] }, optimize: false };
afterEach(() => vi.useRealTimers());
describe('routing worker transport', () => {
  it('cancels and terminates obsolete work, and rejects late replies', async () => {
    const workers: FakeWorker[] = [];
    const client = createRoutingWorkerClient(() => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    });
    const old = client.request(job);
    const lateCallback = workers[0]!.onmessage;
    const current = client.request(job);
    expect(await old).toEqual({ stale: true });
    expect(workers[0]!.terminate).toHaveBeenCalledOnce();
    lateCallback?.(new MessageEvent<RoutingJobReply>('message', { data: { result: { routes: [] } } }));
    workers[1]!.reply({ result: { routes: [] } });
    expect(await current).toEqual({ stale: false, result: { routes: [] } });
    client.dispose();
    expect(workers[1]!.terminate).toHaveBeenCalledOnce();
  });
  it('terminates a hung worker on the deadline with an explicit error', async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const client = createRoutingWorkerClient(() => worker as unknown as Worker, 50);
    const pending = client.request(job);
    const assertion = expect(pending).rejects.toThrow('Zeitbudget');
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(worker.terminate).toHaveBeenCalledOnce();
    client.dispose();
  });
  it('reports worker errors without falling back to main-thread computation', async () => {
    const worker = new FakeWorker();
    const client = createRoutingWorkerClient(() => worker as unknown as Worker);
    const pending = client.request(job);
    worker.reply({ error: 'no route' });
    await expect(pending).rejects.toThrow('no route');
    client.dispose();
  });
});

describe('transferable routing input', () => {
  it('roundtrips all six Golden Plans without changing a path or its rendering', () => {
    for (const fixture of routingFixtures().filter((fixture) => fixture.id.startsWith('golden-'))) {
      const expected = [...routeAllCables(fixture.nodes, fixture.edges)];
      const snapshot = structuredClone(routingSnapshot(fixture.nodes, fixture.edges));
      const actual = runRoutingJob({ snapshot, optimize: false });
      expect(actual.routes, fixture.id).toEqual(expected);
    }
  });
  it('owns input coordinates, including absolute positions and measured port boxes', () => {
    const fixture = routingFixtures().find((fixture) => fixture.id === 'seed-7-10-sparse')!;
    const snapshot = routingSnapshot(fixture.nodes, fixture.edges);
    const oldX = snapshot.nodes[0]!.position.x;
    fixture.nodes[0]!.position.x += 100;
    expect(snapshot.nodes[0]!.position.x).toBe(oldX);
    expect(routingSnapshot(routingSnapshotNodes(snapshot), snapshot.edges)).toEqual(snapshot);
  });
});
