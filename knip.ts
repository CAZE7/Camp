import type { KnipConfig } from 'knip';

/**
 * Dead-Code-/Dependency-Audit (Review-Befund #12).
 *
 * Einstiegspunkte sind bewusst breit (Next-App-Router-Konventionen,
 * Playwright, Benchmarks, Skripte) — ein knip-Fund heißt NICHT automatisch
 * 'löschen', sondern 'prüfen'. Deshalb Script, kein hartes CI-Gate:
 * Befundliste regelmäßig reviewen, nicht build-blockend.
 */
const config: KnipConfig = {
  entry: [
    'app/**/page.tsx',
    'app/**/layout.tsx',
    'app/globals.css',
    'tests/e2e/**/*.spec.ts',
    'benchmarks/**/*.ts',
    'scripts/**/*.mjs',
    'scripts/**/*.ts',
  ],
  project: ['**/*.{ts,tsx,mjs}'],

  // @types/js-yaml: Typen für js-yaml (Bench), knip erkennt den Typ-Import
  // über js-yaml, hält das types-Paket aber separat für ungenutzt.
  ignoreDependencies: ['@types/js-yaml'],
  ignoreExportsUsedInFile: true,
};

export default config;
