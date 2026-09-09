/**
 * CAD-Beleg: Kabelliste (Recherche A4 — Tabellenansicht für Leitungen).
 *
 * Baut über die echte UI einen Auto-Wire-Referenzplan und fotografiert das
 * geöffnete Kabelliste-Modal bei 1440/375 px in hell/dunkel. „Vorher“ gibt es
 * für dieses neue Feature nicht — die Bilder belegen die Nachher-Zustände
 * (Desktop-Tabelle, Sortierkopf, Status-Badges; Mobil mit horizontalem
 * Scrollen).
 *
 * Ausgabe: docs/design/cable-list-evidence/cable-list-<vp>-<theme>.png
 *
 * Aufruf:
 *   npm run build
 *   node scripts/e2e/static-server.mjs 4173 out &
 *   LD_LIBRARY_PATH=/tmp/al2023/lib CHROMIUM_EXECUTABLE_PATH=/tmp/chromium \
 *     node scripts/design/capture-cable-list.mjs
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = resolve(root, 'docs/design/cable-list-evidence');
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4173';
const EXECUTABLE = process.env.CHROMIUM_EXECUTABLE_PATH;

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '375', width: 375, height: 720 },
];
const THEMES = ['light', 'dark'];

// Komponenten in derselben Reihenfolge wie im CAD-Evidence-Skript (Referenz-
// Plan mit Busbar, AC- und DC-Kreisen → viele Leitungen in der Liste).
const PLAN_COMPONENTS = [
  'battery',
  'solar',
  'mpptController',
  'shorePower',
  'inverter',
  'consumer',
  'consumer230v',
  'fuse',
];

async function nodeCount(page) {
  return page.locator('.react-flow__node:not(.react-flow__node-backboneGroup)').count();
}

async function waitForTrue(page, condition, message, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await condition()) return;
    await page.waitForTimeout(120);
  }
  throw new Error(`Zeitüberschreitung: ${message}`);
}

async function buildPlan(page) {
  await page.goto(`${BASE_URL}/elektrik-planung/`, { waitUntil: 'load', timeout: 60000 });
  await page.getByTestId('planner-shell').waitFor({ state: 'visible', timeout: 45000 });

  const dialog = page.getByRole('dialog');
  if ((await dialog.count()) > 0) {
    const close = dialog.getByRole('button', { name: /schließen|los geht|starten|überspringen/i });
    if ((await close.count()) > 0) await close.first().click();
    await dialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  }

  const tab = page.getByTestId('nav-tab-sidebar');
  if (await tab.isVisible()) await tab.click();
  await page.getByTestId('sidebar').waitFor({ state: 'visible' });
  const headers = page.getByTestId('sidebar').locator('button[aria-expanded]');
  const headerCount = await headers.count();
  for (let index = 0; index < headerCount; index++) {
    const header = headers.nth(index);
    if ((await header.getAttribute('aria-expanded')) === 'false') {
      await header.click();
    }
  }

  for (const type of PLAN_COMPONENTS) {
    const openTab = page.getByTestId('nav-tab-sidebar');
    if (await openTab.isVisible()) {
      await openTab.click();
      await page.getByTestId('sidebar').waitFor({ state: 'visible' });
    }
    const tile = page
      .locator(`[data-testid="sidebar-item"][data-component-type="${type}"][data-accent="default"]`)
      .first();
    await tile.waitFor({ state: 'visible' });
    const wide = await page.evaluate(() => window.innerWidth >= 1024);
    const before = await nodeCount(page);
    if (wide) {
      await tile.focus();
      await tile.press('Enter');
    } else {
      await tile.click();
    }
    const canvasTab = page.getByTestId('nav-tab-electric');
    if (await canvasTab.isVisible()) await canvasTab.click();
    await waitForTrue(
      page,
      async () => (await nodeCount(page)) === before + 1,
      `${type} wurde nicht hinzugefügt`
    );
  }

  const autowire = page.getByTestId('action-autowire');
  await autowire.waitFor({ state: 'visible' });
  await autowire.click();
  await waitForTrue(
    page,
    async () => (await page.locator('.react-flow__edge').count()) > 0,
    'Auto-Wire ohne Kanten'
  );

  const layout = page.getByTestId('action-layout-v2');
  if (await layout.isVisible()) {
    await layout.click();
  }
  await page.waitForTimeout(900);

  const expertClose = page.getByTestId('expert-panel-close');
  if ((await expertClose.count()) > 0 && (await expertClose.isVisible())) {
    await expertClose.click();
    await expertClose.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
  await page.evaluate(() => document.fonts.ready);
}

async function openCableList(page) {
  // Aktionen-Menü öffnen und „Kabelliste“ wählen (echte UI-Schritte).
  const menuButton = page.getByRole('button', { name: 'Weitere Aktionen' });
  await menuButton.waitFor({ state: 'visible' });
  await menuButton.click();
  const item = page.getByTestId('action-cable-list');
  await item.waitFor({ state: 'visible' });
  await item.click();
  const dialog = page.getByRole('dialog', { name: /Kabelliste/ });
  await dialog.waitFor({ state: 'visible', timeout: 15000 });
  await dialog
    .getByRole('row')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => {});
  await page.waitForTimeout(350); // Einblendung ausklingen lassen
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const baseArgs = ['--no-sandbox', '--disable-dev-shm-usage'];
  let done = 0;
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const browser = await chromium.launch({ executablePath: EXECUTABLE, args: baseArgs });
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin',
        colorScheme: theme,
        reducedMotion: 'reduce',
      });
      try {
        await buildPlan(page);
        // Die schwebende Kennzahlen-Karte kann das Modal überlagern — sie
        // gehört nicht zum Prüfgegenstand (wie im CAD-Evidence-Skript).
        await page.addStyleTag({
          content: 'aside[aria-label="Aktuelle Kennzahlen des Elektrikplans"]{display:none!important}',
        });
        await openCableList(page);
        const file = resolve(OUT_DIR, `cable-list-${vp.name}-${theme}.png`);
        await page.screenshot({ path: file });
        done += 1;
        console.log(`OK ${file}`);
      } finally {
        await browser.close();
      }
    }
  }
  console.log(`Fertig. ${done} Dateien nach ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
