import { EDT_MAX_D2, EDT_MAX_DIM } from '@/lib/routing/geometry/edt';

/**
 * Stufe 4 (WebGPU) — GPU-EDT hinter Flag `ROUTING_GPU` (default off).
 *
 * Mission: GPU-Arbeit nur hinter `ROUTING_GPU=1`; nie in Regression/Golden/
 * E2E/Coverage (Ausschluss in `vitest.config.ts`, Policy §5′-3). Kein stiller
 * Fallback: Flag gesetzt, aber kein Device ⇒ **Fehler** (Anhang-B-Hinweis),
 * nie „still CPU". Parität CPU ≡ GPU ≡ Brute-Force-Orakel: `gpuEdt.test.ts`
 * (EDT-Parität = Pyramide #1, §5′-1).
 *
 * Backends (gemessen in §5′-4, Spike 2026-09-28):
 * - Browser: `navigator.gpu` (in dieser Sandbox-Konfiguration nicht verfügbar —
 *   sparticuz-Chromium ohne WebGPU-Compile), Code-Pfad existiert dennoch.
 * - Node/Dawn: `webgpu@0.4.0` (die letzte Version ohne GLIBCXX_3.4.31+,
 *   s. §5′-4) + SwiftShader-ICD aus `@sparticuz/chromium`.
 */

/** Env-Flag `ROUTING_GPU` — default off; Browser ohne `process` ⇒ false. */
export function routingGpuEnabled(): boolean {
  try {
    return typeof process !== 'undefined' && process.env?.ROUTING_GPU === '1';
  } catch {
    return false;
  }
}

/** Minimal-Strukturen (bewusst handgeschrieben — kein @webgpu/types-Dep). */
interface GpuBufferLike {
  mapAsync(mode: number): Promise<void>;
  getMappedRange(): ArrayBuffer;
  unmap(): void;
  /** Explizites Freigeben — GC-Finalizer nativer Buffer crasht SwiftShader/Dawn. */
  destroy?(): void;
}

interface GpuPassLike {
  setPipeline(pipeline: unknown): void;
  setBindGroup(index: number, group: unknown): void;
  dispatchWorkgroups(x: number, y?: number, z?: number): void;
  end(): void;
}

interface GpuEncoderLike {
  beginComputePass(): GpuPassLike;
  copyBufferToBuffer(
    src: GpuBufferLike,
    srcOffset: number,
    dst: GpuBufferLike,
    dstOffset: number,
    size: number
  ): void;
  finish(): unknown;
}

interface GpuDeviceLike {
  limits: { maxStorageBufferBindingSize: number };
  queue: {
    writeBuffer(buffer: GpuBufferLike, offset: number, data: ArrayBufferView): void;
    submit(commandBuffers: unknown[]): void;
  };
  createShaderModule(desc: { code: string }): unknown;
  createComputePipeline(desc: { layout: string; compute: { module: unknown; entryPoint: string } }): unknown;
  createBuffer(desc: { size: number; usage: number }): GpuBufferLike;
  createBindGroup(desc: {
    layout: unknown;
    entries: { binding: number; resource: { buffer: GpuBufferLike } }[];
  }): unknown;
  createCommandEncoder(): GpuEncoderLike;
}

interface GpuAdapterLike {
  requestDevice(): Promise<GpuDeviceLike>;
}

interface GpuLike {
  requestAdapter(): Promise<GpuAdapterLike | null>;
}

type GpuBackend = 'browser' | 'dawn-node';

type GpuRuntime = { device: GpuDeviceLike; backend: GpuBackend };

let runtimePromise: Promise<GpuRuntime> | null = null;

const WGSL_ENTRY_ROW = 'edtRowPass';
const WGSL_ENTRY_COL = 'edtColPass';
const WGSL_GROUP_SIZE = 8;
const DIMS_BUFFER_SIZE = 16; // struct Dims = 4×u32 (Uniform-Alignment 16 B)
/** WebGPU-Default `maxStorageBufferBindingSize` (gemessen: 128 MiB, §5′-4). */
const EDT_MAX_STORAGE_BYTES = 134_217_728;

/* ---------- WebGPU-Konstanten (Browser-Native bzw. Dawn-`globals`) ---------- */

function usageFlags(): {
  storage: number;
  copySrc: number;
  copyDst: number;
  uniform: number;
  mapRead: number;
} {
  const u = (globalThis as { GPUBufferUsage?: Record<string, number> }).GPUBufferUsage;
  return {
    storage: usageBit(u, 'STORAGE'),
    copySrc: usageBit(u, 'COPY_SRC'),
    copyDst: usageBit(u, 'COPY_DST'),
    uniform: usageBit(u, 'UNIFORM'),
    mapRead: usageBit(u, 'MAP_READ'),
  };
}

function usageBit(u: Record<string, number> | undefined, key: string): number {
  const v = u?.[key];
  if (typeof v !== 'number') {
    throw new Error(`ROUTING_GPU: GPUBufferUsage.${key} fehlt — Globals nicht initialisiert`);
  }
  return v;
}

function mapModeRead(): number {
  const v = (globalThis as { GPUMapMode?: Record<string, number> }).GPUMapMode?.['READ'];
  if (typeof v !== 'number') {
    throw new Error('ROUTING_GPU: GPUMapMode.READ fehlt — Globals nicht initialisiert');
  }
  return v;
}

/* ---------- Device-Provider ---------- */

async function importGpu(): Promise<{ gpu: GpuLike; backend: GpuBackend }> {
  const browserGpu = (globalThis as { navigator?: { gpu?: GpuLike } }).navigator?.gpu;
  if (browserGpu) return { gpu: browserGpu, backend: 'browser' };
  try {
    // Bewusst createRequire statt `await import('webgpu')`: Vite/Vitest
    // transformieren das native CJS-Binding und laden es instanzheterogen —
    // gemessener Worker-Segfault (§5′-4, Spike-Messlauf). createRequire lädt
    // dieselbe Instanz wie Plain-Node (dort über 3×100 Läufe stabil).
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const mod = require('webgpu') as {
      globals: Record<string, unknown>;
      create(flags?: readonly string[]): GpuLike;
    };
    Object.assign(globalThis, mod.globals);
    return { gpu: mod.create([]), backend: 'dawn-node' };
  } catch (cause) {
    throw new Error(
      'ROUTING_GPU=1, aber weder navigator.gpu noch das webgpu-Dawn-Binding verfügbar ' +
        '(npm ci incl. devDependency webgpu@0.4.0 ausführen; Gemessenes §5′-4).',
      { cause }
    );
  }
}

/**
 * Device-Provider (prozesslokal gecacht). Kein stiller Fallback: fehlt ein
 * Adapter, ⇒ Fehler mit Anhang-B-Hinweis (SwiftShader-ICD), nie „weiter ohne
 * GPU". Fehlschläge werden nicht gecacht (Retry möglich).
 */
export async function loadGpuDevice(): Promise<GpuDeviceLike> {
  if (!runtimePromise) {
    const attempt = (async (): Promise<GpuRuntime> => {
      // Reihenfolge exakt nach dem stabilen Referenz-Lauf (§5′-4): WGSL-Vorbereitung
      // (reines fs) VOR Device-Load; danach Modul+Pipelines+Dims ONCE, dann erst
      // Per-Call-Buffer — Lazy-Erzeugung mitten im ersten Call korrelierte mit
      // nativen pthread-Crashes (dawn0.4.0/SwiftShader).
      await loadEdtWgsl();
      const { gpu, backend } = await importGpu();
      const adapter = await gpu.requestAdapter();
      if (!adapter) {
        throw new Error(
          'ROUTING_GPU=1, aber requestAdapter() ⇒ null. Anhang B: SwiftShader-ICD ' +
            '(VK_ICD_FILENAMES auf vk_swiftshader_icd.json) und LD_LIBRARY_PATH auf ' +
            'libvulkan/libvk_swiftshader setzen; Gemessenes §5′-4.'
        );
      }
      const device = await adapter.requestDevice();
      await cachedPipelines(device);
      dimsBuffer(device);
      return { device, backend };
    })();
    attempt.catch(() => {
      runtimePromise = null;
    });
    runtimePromise = attempt;
  }
  return (await runtimePromise).device;
}

/* ---------- EDT-Lauf ---------- */

type PipelineCache = {
  pipeRow: unknown;
  pipeCol: unknown;
  layoutRow: unknown;
  layoutCol: unknown;
};

const pipelineCache = new WeakMap<GpuDeviceLike, Promise<PipelineCache>>();
const dimsCache = new WeakMap<GpuDeviceLike, GpuBufferLike>();

function dimsBuffer(device: GpuDeviceLike): GpuBufferLike {
  let b = dimsCache.get(device);
  if (!b) {
    b = device.createBuffer({ size: DIMS_BUFFER_SIZE, usage: usageFlags().uniform | usageFlags().copyDst });
    dimsCache.set(device, b);
  }
  return b;
}

/**
 * WGSL-Quelle als echte Datei (§5′-5) — lazy per fs statt `?raw`-Import:
 * der Paritäts-Lauf ist bewusst ein tsx-Skript (§5′-4: Vitest-Worker +
 * natives Dawn-Binding = gemessener Worker-Segfault), und fs läuft in
 * Plain-Node, tsx und Vitest identisch.
 */
let wgslSourceCache: string | null = null;

async function loadEdtWgsl(): Promise<string> {
  if (wgslSourceCache === null) {
    const { readFile } = await import('node:fs/promises');
    const candidates = [
      new URL('./edt.wgsl', import.meta.url), // Quellverzeichnis (vitest/tsx/dev)
      new URL('lib/routing/gpu/edt.wgsl', pathToFileUrl(process.cwd())), // Bundle-Lauf (test:gpu)
    ];
    let lastErrno: unknown = null;
    for (const candidate of candidates) {
      try {
        wgslSourceCache = await readFile(candidate, 'utf8');
        return wgslSourceCache;
      } catch (err) {
        lastErrno = err;
      }
    }
    throw new Error(
      `ROUTING_GPU: edt.wgsl nicht lesbar (${String(lastErrno)}) — Quelldatei muss ` +
        'neben gpuEdt.ts bzw. unter CWD/lib/routing/gpu/ liegen (§5′-5 echte Dateien).'
    );
  }
  return wgslSourceCache;
}

function pathToFileUrl(dir: string): URL {
  const base = dir.startsWith('/') ? dir : `/${dir}`;
  return new URL(base.endsWith('/') ? base : `${base}/`, 'file://');
}

async function cachedPipelines(device: GpuDeviceLike): Promise<PipelineCache> {
  let p = pipelineCache.get(device);
  if (!p) {
    p = (async (): Promise<PipelineCache> => {
      const module = device.createShaderModule({ code: await loadEdtWgsl() });
      const pipeRow = device.createComputePipeline({
        layout: 'auto',
        compute: { module, entryPoint: WGSL_ENTRY_ROW },
      });
      const pipeCol = device.createComputePipeline({
        layout: 'auto',
        compute: { module, entryPoint: WGSL_ENTRY_COL },
      });
      const layoutOf = (pipe: unknown): unknown =>
        (pipe as { getBindGroupLayout(index: number): unknown }).getBindGroupLayout(0);
      return {
        pipeRow,
        pipeCol,
        layoutRow: layoutOf(pipeRow),
        layoutCol: layoutOf(pipeCol),
      };
    })();
    pipelineCache.set(device, p);
  }
  return p;
}

/**
 * Exakte separierbare EDT auf dem GPU — Semantik identisch zu
 * `squaredEdt2D` (lib/routing/geometry/edt.ts): Init belegt ⇒ 0, frei ⇒
 * `EDT_MAX_D2`; Pass 1 je Zeile, Pass 2 je Spalte; INF-Clamp vor Addition;
 * `EDT_MAX_DIM`-Assertion (Fehler statt Wraparound).
 *
 * @throws Error wenn `ROUTING_GPU` nicht gesetzt ist (Flag-Pflicht) oder kein
 *   Device verfügbar ist (kein stiller CPU-Fallback).
 */
export async function gpuSquaredEdt2D(
  width: number,
  height: number,
  blocked: Uint8Array
): Promise<Uint32Array> {
  if (!routingGpuEnabled()) {
    throw new Error('ROUTING_GPU ist aus (default off) — GPU-Arbeit ohne Flag verboten.');
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError(`edt: Dimensionen ${width}×${height} ungültig`);
  }
  if (width > EDT_MAX_DIM || height > EDT_MAX_DIM) {
    throw new RangeError(`edt: ${width}×${height} übersteigt EDT_MAX_DIM ${EDT_MAX_DIM} (d² < 2³¹)`);
  }
  if (blocked.length !== width * height) {
    throw new RangeError(`edt: blocked.length ${blocked.length} ≠ ${width}×${height}`);
  }

  const device = await loadGpuDevice();
  const usage = usageFlags();
  const bytes = width * height * 4;
  // WebGPU-Default-Grenze (gemessen §5′-4: device.limits ⇒ 134217728 B).
  // Bewusst die Konstante statt des limits-Getters: der Getter korrelierte im
  // Spike-Messlauf mit nativen pthread-Crashes von dawn0.4.0/SwiftShader.
  if (bytes > EDT_MAX_STORAGE_BYTES) {
    throw new RangeError(
      `edt: ${bytes} B überschreitet maxStorageBufferBindingSize ${EDT_MAX_STORAGE_BYTES} B`
    );
  }

  const init = new Uint32Array(width * height);
  for (let i = 0; i < init.length; i++) init[i] = blocked[i] ? 0 : EDT_MAX_D2;

  const bufIn = device.createBuffer({ size: bytes, usage: usage.storage | usage.copyDst });
  const bufRow = device.createBuffer({ size: bytes, usage: usage.storage | usage.copyDst });
  const bufOut = device.createBuffer({ size: bytes, usage: usage.storage | usage.copySrc });
  const bufRead = device.createBuffer({ size: bytes, usage: usage.mapRead | usage.copyDst });

  const dims = dimsBuffer(device);
  device.queue.writeBuffer(dims, 0, new Uint32Array([width, height, 0, 0]));
  device.queue.writeBuffer(bufIn, 0, init);

  const runtime = await cachedPipelines(device);
  const bindRow = device.createBindGroup({
    layout: (runtime.pipeRow as { getBindGroupLayout(i: number): unknown }).getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: dims } },
      { binding: 1, resource: { buffer: bufIn } },
      { binding: 2, resource: { buffer: bufRow } },
    ],
  });
  const bindCol = device.createBindGroup({
    layout: (runtime.pipeCol as { getBindGroupLayout(i: number): unknown }).getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: dims } },
      { binding: 1, resource: { buffer: bufRow } },
      { binding: 2, resource: { buffer: bufOut } },
    ],
  });

  const gx = Math.ceil(width / WGSL_GROUP_SIZE);
  const gy = Math.ceil(height / WGSL_GROUP_SIZE);
  const enc = device.createCommandEncoder();
  const pass1 = enc.beginComputePass();
  pass1.setPipeline(runtime.pipeRow);
  pass1.setBindGroup(0, bindRow);
  pass1.dispatchWorkgroups(gx, gy, 1);
  pass1.end();
  const pass2 = enc.beginComputePass();
  pass2.setPipeline(runtime.pipeCol);
  pass2.setBindGroup(0, bindCol);
  pass2.dispatchWorkgroups(gx, gy, 1);
  pass2.end();
  enc.copyBufferToBuffer(bufOut, 0, bufRead, 0, bytes);
  device.queue.submit([enc.finish()]);

  await bufRead.mapAsync(mapModeRead());
  const out = new Uint32Array(bufRead.getMappedRange().slice(0));
  bufRead.unmap();
  return out;
}
