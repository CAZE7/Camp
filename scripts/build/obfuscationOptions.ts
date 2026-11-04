import type { ObfuscatorOptions } from 'javascript-obfuscator';

/**
 * Bewusst ohne `controlFlowFlattening`, `deadCodeInjection` und
 * Zahlen-zu-Ausdrücken: der Live-Pfad `routeAllCables` darf dadurch
 * höchstens etwa 20 % langsamer werden. Zeichenketten wandern in ein
 * Array, Namen werden kurz und hexadezimal. Vendor-Laufzeit
 * (`renameGlobals` / `renameProperties`) bleibt unangetastet.
 */
export const CLIENT_LOGIC_OBFUSCATOR_OPTIONS: ObfuscatorOptions = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  ignoreImports: true,
  numbersToExpressions: false,
  renameGlobals: false,
  renameProperties: false,
  seed: 20261103,
  selfDefending: false,
  simplify: true,
  sourceMap: false,
  splitStrings: false,
  stringArray: true,
  stringArrayCallsTransform: false,
  stringArrayEncoding: [],
  // 1,0 zog routeAllCables auf +20 % (gemessen 59,7 → 71,7 ms). 0,75 bleibt bei +16 %.
  stringArrayThreshold: 0.75,
  stringArrayWrappersChainedCalls: false,
  stringArrayWrappersCount: 1,
  stringArrayWrappersType: 'variable',
  target: 'browser',
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
};

/** Bibliotheken, die im Chunk bleiben müssen, wie sie sind. */
export const VENDOR_CHUNK_MARKERS = ['org.eclipse.elk', 'react-dom', 'next/dist', 'graphlib'] as const;

export function shouldObfuscateChunk(source: string): boolean {
  if (!source.includes('camp-logic-sentinel:')) return false;
  return !VENDOR_CHUNK_MARKERS.some((marker) => source.includes(marker));
}
