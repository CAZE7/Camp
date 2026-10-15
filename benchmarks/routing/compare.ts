/** npm run routing:compare -- [--quick] [--plan=substring] [--candidate=name] [--output=path] */
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { cpus } from 'node:os';
import { execFileSync } from 'node:child_process';
import { clearPathfindingCache } from '../../components/edges/utils/pathfinding';
import { candidates, runCandidate, assess } from './candidates';
import { routingFixtures } from './fixtures';
import { nodeLayoutSignature, edgeTopologySignature } from '../../components/edges/utils/cableRouteStore';

const arg = (name: string) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
const serialize = (routes: Awaited<ReturnType<typeof runCandidate>>) =>
  JSON.stringify(
    [...routes].sort(([a], [b]) => (a < b ? -1 : 1)).map(([id, route]) => [id, route.waypoints])
  );
async function main() {
  const runs = process.argv.includes('--quick') ? 1 : 3;
  const rows = [];
  for (const fixture of routingFixtures().filter(
    (fixture) => !arg('plan') || fixture.id.includes(arg('plan')!)
  )) {
    const signature = `${nodeLayoutSignature(fixture.nodes)}\n${edgeTopologySignature(fixture.edges)}`;
    const inputHash = createHash('sha256').update(signature).digest('hex');
    let baseline: Awaited<ReturnType<typeof runCandidate>> | undefined;
    for (const candidate of candidates.filter(
      (candidate) => !arg('candidate') || candidate === arg('candidate')
    )) {
      const times = [];
      const heaps = [];
      const outputs: string[] = [];
      let last: Awaited<ReturnType<typeof runCandidate>> | undefined;
      let error: string | undefined;
      for (let run = 0; run < runs; run++) {
        clearPathfindingCache();
        const heap = process.memoryUsage().heapUsed;
        const started = performance.now();
        try {
          last = await runCandidate(candidate, structuredClone(fixture));
        } catch (caught) {
          error = String(caught);
          break;
        }
        times.push(performance.now() - started);
        heaps.push(process.memoryUsage().heapUsed - heap);
        outputs.push(serialize(last));
      }
      if (!last) {
        rows.push({ plan: fixture.id, candidate, inputHash, error });
        continue;
      }
      if (candidate === 'legacy' || (candidate === 'baseline' && !baseline)) baseline = last;
      const { report, quality } = assess(fixture, last);
      let translationInvariant: boolean | null = null;
      let permutationInvariant: boolean | null = null;
      if (!process.argv.includes('--quick')) {
        const shifted = structuredClone(fixture);
        const dx = 137,
          dy = -83;
        for (const node of shifted.nodes) {
          node.position.x += dx;
          node.position.y += dy;
        }
        for (const edge of shifted.edges)
          for (const point of edge.data?.lockedWaypoints ?? []) {
            point.x += dx;
            point.y += dy;
          }
        const translated = await runCandidate(candidate, shifted);
        translationInvariant = [...last].every(([id, route]) => {
          const points = translated.get(id)?.waypoints;
          return (
            points?.length === route.waypoints.length &&
            route.waypoints.every(
              (point, i) =>
                Math.abs(points[i]!.x - dx - point.x) < 1e-6 && Math.abs(points[i]!.y - dy - point.y) < 1e-6
            )
          );
        });
        const reversed = structuredClone(fixture);
        reversed.nodes.reverse();
        reversed.edges.reverse();
        permutationInvariant = serialize(await runCandidate(candidate, reversed)) === serialize(last);
      }
      const ids = new Set<string>();
      for (const edge of fixture.edges) {
        ids.add(`${edge.source}:${edge.sourceHandle}`);
        ids.add(`${edge.target}:${edge.targetHandle}`);
      }
      const sorted = [...times].sort((a, b) => a - b);
      const row = {
        plan: fixture.id,
        candidate,
        inputHash,
        seed: fixture.seed,
        nodes: fixture.nodes.length,
        ports: ids.size,
        cables: fixture.edges.length,
        ...quality,
        counts: report.counts,
        fallbacks: [...last.values()].filter((route) => route.usedSearch === 'fallback').length,
        changedRoutes: baseline
          ? [...last].filter(
              ([id, route]) =>
                JSON.stringify(route.waypoints) !== JSON.stringify(baseline!.get(id)?.waypoints)
            ).length
          : null,
        timesMs: times,
        medianMs: sorted[Math.floor(sorted.length / 2)],
        maxMs: sorted[sorted.length - 1],
        heapDeltaBytes: heaps,
        deterministic: runs > 1 ? outputs.every((output) => output === outputs[0]) : null,
        translationInvariant,
        permutationInvariant,
        // Partial metric coverage is explicit; no synthetic zeros for unmeasured criteria.
        corridorOverload: null,
        labelCollisions: null,
        peakMemoryBytes: null,
        outputHash: createHash('sha256').update(serialize(last)).digest('hex'),
        diagnostics: [
          ...report.violations,
          ...(report.contractViolations ?? []),
          ...(report.lockedRouteViolations ?? []),
        ].slice(0, 5),
        error,
      };
      rows.push(row);
      console.error(
        `${fixture.id} ${candidate}: ${report.status}, ${quality.hardViolations} violations, ${quality.crossings} X, ${quality.bends} bends, ${quality.lengthPx.toFixed(1)}px, ${row.medianMs!.toFixed(1)}ms`
      );
      if (`${nodeLayoutSignature(fixture.nodes)}\n${edgeTopologySignature(fixture.edges)}` !== signature)
        throw new Error('Input mutated');
    }
  }
  const output = arg('output') ?? 'benchmarks/routing/results.json';
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    JSON.stringify(
      {
        schemaVersion: 1,
        algorithmVersion: 'routing-global-2',
        date: '2026-10-14',
        commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        node: process.version,
        cpu: cpus()[0]?.model,
        runs,
        note: 'Fixed positions. No layout per candidate. Cold path cache per run; JS/WASM JIT persists. Heap deltas exclude WASM and are NOT peak memory. Validation excluded from baseline/library timing but included in optimizing candidates.',
        rows,
      },
      null,
      2
    ) + '\n'
  );
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
