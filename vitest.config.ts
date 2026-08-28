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
