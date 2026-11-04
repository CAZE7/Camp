/**
 * Misst `routeAllCables` vor und nach denselben Obfuscator-Einstellungen,
 * die der Post-Build auf die Client-Chunks anwendet.
 *
 * Der Produktions-Benchmark (`npm run perf:edge-routing`) läuft auf dem
 * TypeScript-Quelltext. Die ausgelieferte Datei ist das verschleierte
 * Bundle — deshalb wird hier genau dieser Unterschied gemessen.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import * as esbuild from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';

import { CLIENT_LOGIC_OBFUSCATOR_OPTIONS } from './obfuscationOptions';

const NODE_COUNT = 36;
const EDGES_PER_NODE = 4;
const REVOLUTIONS = 15;

function buildPlan() {
  const nodes = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.push({
      id: `n${i}`,
      type: i % 4 === 0 ? 'battery' : i % 4 === 1 ? 'shunt' : i % 4 === 2 ? 'fuse' : 'consumer',
      position: { x: (i % 8) * 220, y: Math.floor(i / 8) * 160 },
      width: 192,
      height: 120,
      data: { label: `Node ${i}` },
    });
  }
  const edges = [];
  for (let i = 1; i < NODE_COUNT; i++) {
    for (let j = 0; j < EDGES_PER_NODE; j++) {
      const target = i - 1 - j;
      if (target < 0) break;
      edges.push({
        id: `e${edges.length}`,
        source: `n${target}`,
        target: `n${i}`,
        sourceHandle: 'plus',
        targetHandle: 'plus',
        data: {},
      });
    }
  }
  return { nodes, edges };
}

async function timeRouteAll(modulePath: string): Promise<{ median: number; p90: number }> {
  const loaded = await import(pathToFileURL(modulePath).href);
  const routeAllCables = loaded.routeAllCables as (nodes: unknown[], edges: unknown[]) => unknown;
  const { nodes, edges } = buildPlan();
  routeAllCables(nodes, edges);
  const samples: number[] = [];
  for (let revolution = 0; revolution < REVOLUTIONS; revolution++) {
    const start = performance.now();
    routeAllCables(nodes, edges);
    samples.push(performance.now() - start);
  }
  samples.sort((left, right) => left - right);
  return {
    median: samples[Math.floor(samples.length / 2)]!,
    p90: samples[Math.floor(samples.length * 0.9)]!,
  };
}

async function main(): Promise<void> {
  const directory = join(process.cwd(), '.tmp-route-obfuscation');
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory);
  const plainPath = join(directory, 'plain.js');
  const hiddenPath = join(directory, 'hidden.js');

  await esbuild.build({
    entryPoints: [join(process.cwd(), 'components/edges/utils/routeAll.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: plainPath,
    external: ['@xyflow/react'],
    alias: { '@': process.cwd() },
    logLevel: 'silent',
  });

  const plainSource = readFileSync(plainPath, 'utf8');
  const hiddenSource = JavaScriptObfuscator.obfuscate(plainSource, {
    ...CLIENT_LOGIC_OBFUSCATOR_OPTIONS,
    target: 'node',
  }).getObfuscatedCode();
  writeFileSync(hiddenPath, hiddenSource);

  let before: { median: number; p90: number };
  let after: { median: number; p90: number };
  try {
    before = await timeRouteAll(plainPath);
    after = await timeRouteAll(hiddenPath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  const ratio = before.median === 0 ? 0 : after.median / before.median;

  console.log(
    `routeAllCables N=${NODE_COUNT} E≈134  ` +
      `vorher Median ${before.median.toFixed(1)} ms (p90 ${before.p90.toFixed(1)})  ` +
      `nachher Median ${after.median.toFixed(1)} ms (p90 ${after.p90.toFixed(1)})  ` +
      `Faktor ${ratio.toFixed(2)}`
  );
  console.log(
    `Bundle ${plainSource.length} → ${hiddenSource.length} Bytes ` +
      `(${(((hiddenSource.length - plainSource.length) / plainSource.length) * 100).toFixed(1)} %)`
  );

  if (ratio > 1.2) {
    console.error('Verschleierung macht routeAllCables um mehr als 20 % langsamer.');
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1]?.includes('measureRouteObfuscation');
if (isDirectRun) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
