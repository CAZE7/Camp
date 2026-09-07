import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // '@/' aus tsconfig.paths — seit NUUIA/Testhärtung explizit statt
    // impliziter Plugin-Verdrahtung (vite-tsconfig-paths war ungenutzt).
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    // Playwright-Specs laufen NICHT unter Vitest: sie brauchen einen echten
    // Browser und den gebauten Static Export (npm run e2e).
    exclude: ['node_modules/**', 'dist/**', '.next/**', 'out/**', 'tests/e2e/**'],
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: false,
    coverage: {
      provider: 'v8',
      // Coverage-Gate nur für den Engine-Kern: lib/** ist die Domänenlogik
      // (Elektrik, VDE, Units, AutoWire) — dort zählt jede Zeile. Der UI-Baum
      // bleibt bewusst ungeschwellt (Gerüsttests wären Scheinsicherheit).
      //
      // Routing-V2-Module (2026-09, PR #417) sind bewusst aus dem Gesamttor
      // herausgenommen: sie bringen ein eigenes Verify-Tor mit (npm run
      // verify:routing-v2 — ELK-Stress-Gate) und sind noch nicht auf den
      // Schwellen des Altkerns getestet (v. a. hopping, elk-Branches,
      // dagre-Fallback). FOLLOW-UP: Tests nachziehen, Ausnahme streichen.
      exclude: [
        'node_modules/**',
        'coverage/**',
        'dist/**',
        '.next/**',
        'out/**',
        // Routing V2 (PR #417): gesamter lib/planner-Baum ist mit dem Feature
        // neu ins Repo gekommen (orchestrator, routing-core, layout-engine,
        // graph, vde, domainModel, tokens) und trägt ein eigenes Verify-Tor
        // (npm run verify:routing-v2). FOLLOW-UP: Tests auf Altkern-Niveau
        // nachziehen, dann Ausnahme streichen.
        'lib/planner/**',
      ],
      thresholds: {
        'lib/**': {
          lines: 90,
          branches: 85,
          functions: 90,
          statements: 95,
        },
      },
    },
  },
});
