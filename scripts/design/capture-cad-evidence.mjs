#!/usr/bin/env node
/**
 * CAD-Evidence-Screenshots (M11-1-Lückenpaket B3/B2, agent.md „Routing-Qualität“-Konvention):
 * baut im Planner über die echte UI einen Referenzplan (alle fünf Funktionsstufen)
 * und fotografiert ihn als „Vorher“ (Zonen aus, Labels Voll) und „Nachher“
 * (Zonen an, Labels Kern) — 375/768/1440 px, hell + dunkel.
 *
 *   node scripts/design/capture-cad-evidence.mjs [--base-url http://127.0.0.1:4173]
 *
 * Der Plan wird einmal pro Viewport frisch über Sidebar/Enter aufgebaut
 * (deterministisch, wie tests/e2e/helpers.ts) und mit Auto-Wire + ELK-Layout
 * in Flussrichtung angeordnet. Das „Vorher“-Bild entsteht NICHT aus einem
 * alten Commit, sondern aus demselben Stand mit ausgeschalteten neuen
 * Optionen — dadurch unterscheiden sich die Bilder pixelgenau nur durch die
 * Features (gleiche Geometrie, gleiche Daten).
 *
 * Ausgabe: docs/design/cad-evidence/<name>-<viewport>-<theme>-[vorher|nachher].png
 *
 * Umgebungsvariablen für nicht von Playwright bezogene Browser:
 *   CHROMIUM_EXECUTABLE_PATH  Pfad zur Chromium-Binärdatei
 *   CHROMIUM_LD_LIBRARY_PATH  Zusätzlicher LD_LIBRARY_PATH
 */
import { chromium } from '@playwright/test';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const OUT = argValue('--out', 'docs/design/cad-evidence');
const BASE_URL = argValue('--base-url', process.env.DESIGN_BASE_URL ?? 'http://127.0.0.1:4173');
const EXECUTABLE = process.env.CHROMIUM_EXECUTABLE_PATH;

/** Bauteile für einen Plan mit allen fünf Funktionsstufen. */
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

/** Pollt eine Bedingung ohne feste Gesamtdauer (helpers.ts-Konvention). */
async function waitForTrue(page, condition, message, timeoutMs = 20000) {
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

  // Sidebar öffnen (mobil hinter Tab), alle Kategorien aufklappen.
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
    // Sidebar je Bauteil öffnen (mobil liegt sie hinter eigenem Tab und der
    // Canvas-Tab schließt sie nach jedem Hinzufügen).
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
    // Zurück zum Canvas (mobil eigener Tab).
    const canvasTab = page.getByTestId('nav-tab-electric');
    if (await canvasTab.isVisible()) await canvasTab.click();
    await waitForTrue(
      page,
      async () => (await nodeCount(page)) === before + 1,
      `${type} wurde nicht hinzugefügt`
    );
  }

  // Auto-Wire ergänzt Busbars/Shunt und verdrahtet; ELK legt in Flussrichtung an.
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
  await page.waitForTimeout(900); // Layout-Animation ausklingen lassen

  // Auto-Wire klappt das Expert-Panel auf — es würde die Canvas-Chips
  // überdecken. Schließen wie im E2E (expert-panel-close).
  const expertClose = page.getByTestId('expert-panel-close');
  if ((await expertClose.count()) > 0 && (await expertClose.isVisible())) {
    await expertClose.click();
    await expertClose.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
  await page.evaluate(() => document.fonts.ready);
}

/**
 * Stellt die Anzeige-Optionen über die echten UI-Schalter um (Chips im
 * „Ansicht“-Popover bzw. direkt in der Chip-Reihe). Schwebende Karten, die
 * bei 768 px den Chip-Bereich überlagern (Kennzahlen-Karte), werden für den
 * Screenshot ausgeblendet — sie gehören nicht zum Vergleichsgegenstand.
 */
async function setDisplayOptions(page, { zones, density }) {
  await page.addStyleTag({
    content: '[aria-label="Aktuelle Kennzahlen des Elektrikplans"]{display:none!important}',
  });

  const trigger = page.getByTestId('canvas-display-options');
  let scope = page;
  let popover = false;
  if (await trigger.isVisible()) {
    popover = true;
    await trigger.click();
    const panel = page.locator('#canvas-display-options-panel');
    await panel.waitFor({ state: 'visible', timeout: 10000 });
    scope = panel;
  }

  const zonesChip = scope.getByRole('button', { name: 'Zonen' });
  const pressed = (await zonesChip.getAttribute('aria-pressed')) === 'true';
  if (pressed !== zones) await zonesChip.click({ force: true });

  const group = scope.getByRole('group', { name: 'Kabel-Label-Dichte' });
  const label = density === 'Voll' ? 'Voll' : density === 'Kern' ? 'Kern' : 'Aus';
  await group.getByRole('button', { name: label }).click({ force: true });

  if (popover) {
    await scope.getByRole('button', { name: 'Ansichtsoptionen schließen' }).click({ force: true });
  }
  await page.waitForTimeout(250);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  for (const vp of [
    { name: '375', width: 375, height: 812 },
    { name: '768', width: 768, height: 1024 },
    { name: '1440', width: 1440, height: 900 },
  ]) {
    for (const theme of ['light', 'dark']) {
      // Pro Kombination ein frischer Browser: der eingebettete Chromium-Build
      // läuft im Single-Process-Modus und überlebt viele Kontexte nicht.
      const browser = await chromium.launch({
        executablePath: EXECUTABLE,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
        colorScheme: theme,
        locale: 'de-DE',
      });
      const page = await context.newPage();
      console.log(`→ Plan aufbauen (${vp.name}/${theme})`);
      await buildPlan(page);

      // „Vorher“: neue Features aus — exakt das Alt-Verhalten (keine Zonen,
      // alle Labels dauerhaft). Gleiche Geometrie wie „Nachher“.
      await setDisplayOptions(page, { zones: false, density: 'Voll' });
      await page.waitForTimeout(300);
      const before = path.join(OUT, `plan-${vp.name}-${theme}-vorher.png`);
      await page.screenshot({ path: before });
      console.log(`✓ ${before} (${Math.round((await stat(before)).size / 1024)} KB)`);

      // „Nachher“: Defaults — Zonen-Bänder an, Label-Dichte Kern.
      await setDisplayOptions(page, { zones: true, density: 'Kern' });
      await page.waitForTimeout(300);
      const after = path.join(OUT, `plan-${vp.name}-${theme}-nachher.png`);
      await page.screenshot({ path: after });
      console.log(`✓ ${after} (${Math.round((await stat(after)).size / 1024)} KB)`);

      await browser.close();
    }
  }

  console.log('Fertig.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
