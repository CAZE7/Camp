import { describe, expect, it } from 'vitest';
import { EDT_MAX_D2 } from '@/lib/routing/geometry/edt';
import { gpuSquaredEdt2D, routingGpuEnabled } from './gpuEdt';
import edtWgslSource from './edt.wgsl?raw';

/**
 * Mission Stufe 4 — GPU-EDT Flag-/Token-Disziplin (immer aktiv, Flag aus).
 *
 * Die Paritäts-/Determinismus-Läufe (§5′-1 Pyramide #1) liegen bewusst NICHT
 * in Vitest: `npm run test:gpu` = `scripts/routing/gpuEdtParity.ts` (tsx).
 * Spike-Messlauf §5′-4: Vitest-Worker + natives Dawn-Binding = worker-
 * Segfault-Race (~30 %), Plain-Node/tsx = über 3×100 Läufe stabil. Policy
 * §5′-3 verbietet GPU ohnehin in CI/E2E/Coverage — hier nur, was ohne Device
 * entscheidbar ist:
 *
 * 1. Flag-Disziplin (default off; ohne Flag ⇒ harter Fehler, kein stiller
 *    CPU-Fallback — Rule M).
 * 2. WGSL-Token-Drift-Guard (§5′-5): `.wgsl` als echte Datei, INF-Literale ≡
 *    `EDT_MAX_D2` aus `edt.ts`.
 */

const gpuMode = routingGpuEnabled();

describe('Stufe 4 GPU-EDT: Flag- & Token-Disziplin (immer aktiv)', () => {
  it('routingGpuEnabled() spiegelt exakt das Env (default off)', () => {
    expect(routingGpuEnabled()).toBe(process.env.ROUTING_GPU === '1');
  });

  it('WGSL TOKEN-SLOT: INF-Literale ≡ EDT_MAX_D2 aus edt.ts (§5′-5 Drift-Guard)', () => {
    expect(edtWgslSource).toContain(`TOKEN-SLOT: EDT_MAX_D2=${EDT_MAX_D2}`);
    // Alle großen u32-Literale im Kernel sind die INF-Marke — Token-Drift ⇒ Fehler.
    const largeLiterals = [...edtWgslSource.matchAll(/(\d+)u\b/g)]
      .map((m) => Number(m[1]))
      .filter((v) => v > 1_000_000);
    expect(largeLiterals.length).toBeGreaterThanOrEqual(6);
    for (const v of largeLiterals) expect(v).toBe(EDT_MAX_D2);
  });

  it('GPU-Modul exportiert den Flag-Gate-Kontrakt (API stabil)', () => {
    expect(typeof gpuSquaredEdt2D).toBe('function');
    expect(typeof routingGpuEnabled).toBe('function');
  });
});

describe.runIf(!gpuMode)('Stufe 4 GPU-EDT: Flag aus ⇒ harte Verweigerung', () => {
  it('gpuSquaredEdt2D wirft ohne ROUTING_GPU (kein stiller CPU-Fallback)', async () => {
    await expect(gpuSquaredEdt2D(4, 4, new Uint8Array(16))).rejects.toThrow(/ROUTING_GPU/);
  });
});

// Parität GPU ≡ CPU ≡ Orakel + Doppel-Lauf-Determinismus + Zeitmessung:
// `npm run test:gpu` (ROUTING_GPU=1, ICD-Umgebung s. Anhang B der MULTIPHYSICS).
// Ohne Flag bewusst nicht Teil von `npm run check` (§5′-3).
