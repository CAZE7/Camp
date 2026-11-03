/**
 * Verschleiert nach `next build` die Client-Chunks, die eigene
 * Planungslogik enthalten (Router, AutoWire, Prüfung, Elektrik).
 *
 * Vendor-Chunks (React, Next, ELK, dagre/graphlib) bleiben lesbar.
 * Source-Maps schreibt dieses Skript nicht; der Deploy löscht `.map`
 * zusätzlich.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import JavaScriptObfuscator from 'javascript-obfuscator';

import { CLIENT_LOGIC_OBFUSCATOR_OPTIONS, shouldObfuscateChunk } from './obfuscationOptions';

const CHUNK_ROOT = join(process.cwd(), 'out', '_next', 'static');

function javascriptFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const info = statSync(path);
    if (info.isDirectory()) found.push(...javascriptFiles(path));
    else if (entry.endsWith('.js')) found.push(path);
  }
  return found.sort();
}

function bytesOf(paths: string[]): number {
  return paths.reduce((sum, path) => sum + statSync(path).size, 0);
}

export function obfuscateClientChunks(root = CHUNK_ROOT): {
  obfuscated: string[];
  beforeBytes: number;
  afterBytes: number;
} {
  const files = javascriptFiles(root);
  const beforeBytes = bytesOf(files);
  const obfuscated: string[] = [];

  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    if (!shouldObfuscateChunk(source)) continue;
    const result = JavaScriptObfuscator.obfuscate(source, CLIENT_LOGIC_OBFUSCATOR_OPTIONS);
    writeFileSync(path, result.getObfuscatedCode());
    obfuscated.push(path);
  }

  const afterBytes = bytesOf(files);
  return { obfuscated, beforeBytes, afterBytes };
}

const isDirectRun = process.argv[1]?.includes('obfuscateClientChunks');

if (isDirectRun) {
  const { obfuscated, beforeBytes, afterBytes } = obfuscateClientChunks();
  const delta = afterBytes - beforeBytes;
  const percent = beforeBytes === 0 ? 0 : (delta / beforeBytes) * 100;
  console.log(
    `Verschleiert: ${obfuscated.length} Chunk(s). ` +
      `JS gesamt ${beforeBytes} → ${afterBytes} Bytes (${percent >= 0 ? '+' : ''}${percent.toFixed(1)} %).`
  );
  for (const path of obfuscated) console.log(`  ${path.replace(`${process.cwd()}/`, '')}`);
  if (obfuscated.length === 0) {
    console.error('Kein Chunk mit Planungslogik gefunden — die Sentinels fehlen im Export.');
    process.exitCode = 1;
  }
}
