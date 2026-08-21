import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
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
      provider: 'v8'
    }
  },
})
