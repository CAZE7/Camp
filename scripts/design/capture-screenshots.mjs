#!/usr/bin/env node
/**
 * Design-Dokumentation: Screenshots der Kernrouten für Vorher/Nachher-Vergleiche
 * (Design-Relaunch „Werft", agent.md D-1 bis D-9).
 *
 * Nutzung:
 *   node scripts/design/capture-screenshots.mjs --out docs/design/relaunch/before [--base-url http://127.0.0.1:3000]
 *
 * Umgebungsvariablen für nicht von Playwright bezogene Browser:
 *   CHROMIUM_EXECUTABLE_PATH  Pfad zur Chromium-Binärdatei
 *   CHROMIUM_LD_LIBRARY_PATH  Zusätzlicher LD_LIBRARY_PATH (z. B. gebündelte .so-Dateien)
 *
 * Erzeugt pro Route und Viewport (375/768/1440) je ein Bild in hell und dunkel.
 * Dunkel wird über prefers-color-scheme emuliert; die Website folgt dem System-
 * Schema (siehe ThemeToggle / `.dark`-Variante in app/globals.css).
 */

import { chromium } from '@playwright/test';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const OUT = argValue('--out', 'docs/design/relaunch/before');
const BASE_URL = argValue('--base-url', process.env.DESIGN_BASE_URL ?? 'http://127.0.0.1:3000');

/** Kernrouten des Relaunchs (agent.md D-3/D-9). */
const ROUTES = [
  { name: 'start', path: '/' },
  { name: 'planer', path: '/elektrik-planung' },
  { name: 'dach', path: '/tools/dach' },
  { name: 'heizung', path: '/tools/heizung' },
  { name: 'guide-fahrplan', path: '/guides/ausbau-fahrplan' },
  { name: 'impressum', path: '/impressum' },
];

const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1440', width: 1440, height: 900 },
];

const EXECUTABLE = process.env.CHROMIUM_EXECUTABLE_PATH;

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
  });

  for (const theme of ['light', 'dark']) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
        colorScheme: theme,
        locale: 'de-DE',
      });
      const page = await context.newPage();

      for (const route of ROUTES) {
        const file = path.join(OUT, `${route.name}-${vp.name}-${theme}.png`);
        try {
          // 'load' statt 'networkidle': im Dev-Modus hält der HMR-WebSocket
          // die Verbindung offen, networkidle würde dort nie feuern.
          await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'load', timeout: 45000 });
        } catch {
          await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        }
        await page.evaluate(() => document.fonts.ready);
        if (route.name === 'planer') {
          // Planer ist ein dynamischer Import: erst auf den Shell warten,
          // dann ggf. das Onboarding schließen (wie tests/e2e/helpers.ts).
          await page
            .getByTestId('planner-shell')
            .waitFor({ state: 'visible', timeout: 45000 })
            .catch(() => {});
          const dialog = page.getByRole('dialog');
          if ((await dialog.count()) > 0) {
            const close = dialog.getByRole('button', { name: /schließen|los geht|starten|überspringen/i });
            if ((await close.count()) > 0) await close.first().click();
            await dialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
          }
        }
        await page.waitForTimeout(600);
        await page.screenshot({ path: file, fullPage: route.name !== 'planer' });
        const size = (await stat(file)).size;
        console.log(`✓ ${file} (${Math.round(size / 1024)} KB)`);
      }

      await context.close();
    }
  }

  await browser.close();
  console.log('Fertig.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
