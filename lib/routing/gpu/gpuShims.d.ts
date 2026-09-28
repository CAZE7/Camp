/**
 * Type-Shims für Stufe 4 (WebGPU): echte `.wgsl`-Dateien als Vite-Raw-Import
 * (§5′-5 „WGSL als echte Dateien") und das optionale `webgpu`-Dawn-Binding
 * (nur devDependency, pin `0.4.0` — s. GPU-ROUTING-ARCH §5′-4 Gemessenes).
 */

declare module '*.wgsl?raw' {
  const source: string;
  export default source;
}

declare module 'webgpu' {
  export const globals: Record<string, unknown>;
  export function create(flags?: readonly string[]): unknown;
}
