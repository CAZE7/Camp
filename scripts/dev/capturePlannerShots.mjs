#!/usr/bin/env node
/**
 * scripts/dev/capturePlannerShots.mjs
 *
 * Vorher/Nachher-Belege für Oberflächenänderungen: Startzustand (leerer Plan),
 * bestückter Plan mit Auswahl und der Prüfbericht — je in 375 / 768 / 1440 px,
 * jeweils als Aufnahme des Planer-Shells (nicht der ganzen Seite).
 *
 * Warum ein Skript im Repo? Die Bilder sind Abnahmebeleg („UI change ⇒
 * before/after shots 375/768/1440", docs/ai/TESTING-CONTEXT.md) und müssen
 * reproduzierbar sein; ein Harness außerhalb des Repos ging bei jedem
 * Umgebungswechsel verloren.
 *
 * Aufruf (der Static Export muss laufen, z. B.
 * `node scripts/e2e/static-server.mjs 4173 out`):
 *
 *   node scripts/dev/capturePlannerShots.mjs --out=/tmp/shots/after
 *   node scripts/dev/capturePlannerShots.mjs --out=/tmp/shots/before --base=http://127.0.0.1:4174
 *
 * Flags:
 *   --base  Basis-URL (Standard http://127.0.0.1:4173)
 *   --out   Zielordner (Standard /tmp/planner-shots)
 *   --only  empty | plan | validation (Standard: alle drei)
 *
 * Chromium: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` wird von Playwright selbst
 * gelesen; ohne Systembrowser genügt diese eine Variable.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((raw) => {
    const [key, ...rest] = raw.replace(/^--/, '').split('=');
    return [key, rest.join('=') || 'true'];
  })
);

const base = args.base ?? 'http://127.0.0.1:4173';
const outDir = args.out ?? '/tmp/planner-shots';
const only = args.only ?? '';
const plan = JSON.parse(readFileSync('knownPlans/complex.json', 'utf8')).autoWire;

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900, isMobile: false },
  { name: '768', width: 768, height: 1024, isMobile: true },
  { name: '375', width: 375, height: 812, isMobile: true },
];

mkdirSync(outDir, { recursive: true });

/** Spielt einen Planstand vor dem ersten Rendern ein (wie tests/e2e). */
async function seed(page, { withPlan }) {
  await page.addInitScript(
    ({ plannerState, preferences }) => {
      localStorage.clear();
      if (plannerState) {
        localStorage.setItem('werft-planner-v1', plannerState);
        localStorage.setItem('werft-app-preferences-v1', preferences);
      }
    },
    {
      plannerState: withPlan
        ? JSON.stringify({
            state: { nodes: plan.nodes, edges: plan.edges, viewMode: 'electric', backboneGrouping: true },
            version: 1,
          })
        : null,
      preferences: JSON.stringify({ state: { calculatedSolarWatts: 0, hasOnboarded: true }, version: 2 }),
    }
  );
}

/** Nur der Planer-Shell: die Seite ist eine eingebettete Anwendung. */
async function shotShell(page, path) {
  await page.evaluate(() => {
    const shell = document.querySelector('[data-testid="planner-shell"]');
    if (shell) window.scrollTo(0, shell.getBoundingClientRect().top + window.scrollY);
  });
  await page.waitForTimeout(400);
  const shell = page.locator('[data-testid="planner-shell"]');
  if ((await shell.count()) > 0) await shell.screenshot({ path });
  else await page.screenshot({ path });
}

// Wie playwright.config.ts: ohne Systembrowser zeigt die Variable auf ein
// eigenes Chromium (siehe docs/ai/TESTING-CONTEXT.md).
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    locale: 'de-DE',
  });
  const page = await context.newPage();
  const open = async (withPlan) => {
    await seed(page, { withPlan });
    await page.goto(`${base}/elektrik-planung/`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="planner-shell"]', { timeout: 30_000 });
    await page.waitForTimeout(1200);
  };

  if (!only || only === 'empty') {
    await open(false);
    await shotShell(page, join(outDir, `empty-${viewport.name}.png`));
  }

  if (!only || only === 'plan') {
    await open(true);
    const node = page.locator('.react-flow__node').first();
    if ((await node.count()) > 0) {
      await node.click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
    }
    if (viewport.name !== '1440') {
      const tab = page.getByTestId('nav-tab-inspector');
      if (await tab.isVisible().catch(() => false)) {
        await tab.tap().catch(() => {});
        await page.waitForTimeout(400);
      }
    }
    await shotShell(page, join(outDir, `plan-${viewport.name}.png`));
  }

  if (!only || only === 'validation') {
    await open(true);
    // Wie im E2E: Überlaufmenü ⋯ → Prüfen (öffnet die Planungsprüfung).
    await page.getByTestId('action-more').click();
    await page.getByTestId('action-check').click();
    await page.waitForTimeout(900);
    await shotShell(page, join(outDir, `validation-${viewport.name}.png`));
  }

  await context.close();
}

await browser.close();
console.log(`Screenshots in ${outDir}`);
