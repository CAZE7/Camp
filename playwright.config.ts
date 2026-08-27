import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright-Konfiguration (AGENTS.md K5).
 *
 * Getestet wird der **gebaute Static Export** (`./out`), nicht der Dev-Server:
 * genau die Dateien, die auf GitHub Pages landen. Der Server dafür ist
 * `scripts/e2e/static-server.mjs` — ohne Rewrite-Magie, die es dort nicht gibt.
 *
 * Regeln aus AGENTS.md, die hier festgeschrieben sind:
 *   - keine Retries lokal (ein Test ist grün oder er ist kaputt);
 *     in CI genau 1 Retry, ausschließlich zur Diagnose von Flakiness.
 *   - Screenshots/Traces nur als Artefakt bei Fehlschlag, nie als Assertion.
 *   - isolierte Browser-Kontexte (Playwright-Standard, `storageState` bleibt leer).
 *   - `expect`-Timeout großzügig genug für React-Flow-Layout, ohne
 *     `waitForTimeout` in den Tests selbst.
 */

const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const CHROMIUM_EXECUTABLE_PATH = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['list']]
    : [['list']],
  outputDir: 'test-results',

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // Deterministische Darstellung: keine Systemsprache, keine Zeitzone aus
    // der Umgebung, keine Animationen in Screenshots.
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    launchOptions: CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },

  projects: [
    {
      name: 'desktop-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'tablet-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'mobile-375',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } },
    },
    {
      // Echte Touch-Emulation (hasTouch + Mobile-User-Agent).
      name: 'touch-pixel5',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: `node scripts/e2e/static-server.mjs ${PORT} out`,
    url: `${BASE_URL}/elektrik-planung/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
