/**
 * Mission Stufe 4 — GPU-EDT-Parität (§5′-1: EDT-Parität = Pyramide #1).
 *
 * Lauf: `npm run test:gpu` (= ROUTING_GPU=1 tsx …) plus SwiftShader-ICD-Umgebung
 * (Anhang B, MULTIPHYSICS). Bewusst ein tsx-Skript statt Vitest-Test: der
 * Spike-Messlauf (§5′-4) zeigte einen nativen Segfault-Race in der
 * Vitest-Worker-Kombination (~30 %), während Plain-Node/tsx über 3×100 Läufe
 * stabil blieb. Flag gesetzt, aber kein Device ⇒ harter Fehler (Rule M).
 *
 * Vergleiche: CPU `squaredEdt2D` ist selbst orakelbewiesen
 * (lib/routing/geometry/edt.test.ts ≡ Brute-Force).
 */
import { squaredEdt2D } from '@/lib/routing/geometry/edt';
import { gpuSquaredEdt2D, routingGpuEnabled } from '@/lib/routing/gpu/gpuEdt';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`GPU-EDT-Parität FEHLGESCHLAGEN: ${msg}`);
}

/** Deterministischer PRNG (mulberry32) — fixer Seed, kein Math.random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function equalFields(gpu: Uint32Array, cpu: Uint32Array, label: string): void {
  assert(gpu.length === cpu.length, `${label}: Länge ${gpu.length} ≠ ${cpu.length}`);
  for (let i = 0; i < gpu.length; i++) {
    if (gpu[i] !== cpu[i]) {
      throw new Error(`GPU-EDT-Parität FEHLGESCHLAGEN: ${label} @${i} GPU=${gpu[i]} CPU=${cpu[i]}`);
    }
  }
}

async function main(): Promise<void> {
  if (!routingGpuEnabled()) {
    throw new Error('test:gpu erwartet ROUTING_GPU=1 (Flag-Pflicht, §5′-3 default off)');
  }

  // 1 — Degenerierte Felder.
  const degenerate: Array<[number, number, Uint8Array]> = [];
  for (const [w, h] of [
    [1, 1],
    [8, 1],
    [1, 8],
    [17, 9],
    [32, 32],
    [65, 33],
  ] as Array<[number, number]>) {
    degenerate.push([w, h, new Uint8Array(w * h)]);
    degenerate.push([w, h, new Uint8Array(w * h).fill(1)]);
    const odd = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) if (y % 2 === 0) odd[y * w] = 1;
    degenerate.push([w, h, odd]);
  }
  for (const [w, h, blocked] of degenerate) {
    const cpu = squaredEdt2D(w, h, blocked);
    const gpu = await gpuSquaredEdt2D(w, h, blocked);
    equalFields(gpu, cpu, `degeneriert ${w}×${h}`);
  }
  console.log(`Degenerierte: ${degenerate.length} Felder ✓`);

  // 2 — Seeded Zufallsfelder (mulberry32), drei Dichten × vier Formate.
  const rnd = mulberry32(20_260_928);
  const dims: Array<[number, number]> = [
    [64, 64],
    [100, 37],
    [37, 100],
    [256, 128],
  ];
  let zufallCount = 0;
  for (const density of [0.05, 0.3, 0.75]) {
    for (const [w, h] of dims) {
      const blocked = new Uint8Array(w * h);
      for (let i = 0; i < blocked.length; i++) blocked[i] = rnd() < density ? 1 : 0;
      const cpu = squaredEdt2D(w, h, blocked);
      const gpu = await gpuSquaredEdt2D(w, h, blocked);
      equalFields(gpu, cpu, `zufall d=${density} ${w}×${h}`);
      zufallCount++;
    }
  }
  console.log(`Zufallsfelder: ${zufallCount} Felder ✓ (Seed 20260928)`);

  // 3 — Determinismus (R5): zwei GPU-Läufe bitidentisch + Zeitmessung.
  const r2 = mulberry32(42);
  const w = 512;
  const h = 256;
  const blocked = new Uint8Array(w * h);
  for (let i = 0; i < blocked.length; i++) blocked[i] = r2() < 0.25 ? 1 : 0;

  const t0 = performance.now();
  const gpu1 = await gpuSquaredEdt2D(w, h, blocked);
  const t1 = performance.now();
  const gpu2 = await gpuSquaredEdt2D(w, h, blocked);
  const t2 = performance.now();
  const tc0 = performance.now();
  const cpu = squaredEdt2D(w, h, blocked);
  const tc1 = performance.now();

  equalFields(gpu2, gpu1, 'determinismus-lauf2≡lauf1');
  equalFields(gpu1, cpu, `determinismus512×256`);
  console.log(`Determinismus: bitidentisch ✓`);
  console.log(
    `[Stufe 4 EDT]512×256 GPU-Lauf1 ${(t1 - t0).toFixed(2)} ms, ` +
      `GPU-Lauf2 ${(t2 - t1).toFixed(2)} ms, CPU ${(tc1 - tc0).toFixed(2)} ms ` +
      `(SwiftShader-Emulation, inkl. Upload/Readback)`
  );

  console.log('GPU-EDT-Parität: ALLE PRÜFUNGEN GRÜN');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
