import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Computed Styles am html-Element — die Kaskaden-Wahrheit.
 *
 * globals.css erklärt sein Fundament in `@layer base`, dark-engineering.css
 * liegt unlayered darüber. Unlayered gewinnt unabhängig von der Reihenfolge,
 * deshalb ist ein Wert aus der Datei keine Aussage darüber, was malt. Dieser
 * Lauf misst genau das: was nach Layer- undthemenspezifischem Überschreiben
 * übrig bleibt.
 *
 * Nutzung:  node scripts/design-audit/mess-computed-styles.mjs <name>
 * Output:   scripts/design-audit/ergebnis/computed-styles-<name>.json
 */

const name = process.argv[2];
if (!name) {
  console.error('Usage: node scripts/design-audit/mess-computed-styles.mjs <name>');
  process.exit(1);
}
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3123';
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ergebnis');

const NAMEN = [
  '--ok',
  '--warn',
  '--error',
  '--oxide',
  '--info',
  '--rule',
  '--rule-strong',
  '--text-high',
  '--text-med',
  '--text-low',
  '--surface-canvas',
  '--surface-panel',
  '--surface-raised',
  '--surface-page',
  '--surface-drawing',
  '--canvas-bg',
  '--canvas-grid',
  '--edge-glow',
  '--font-display',
  '--font-sans',
  '--font-mono',
  '--radius',
  '--wire-dc',
  '--wire-dc-minus',
  '--wire-ac',
  '--wire-solar',
  '--wire-error',
  '--de-surface-0',
  '--de-ok',
  '--de-error',
];

const SEITEN = [
  ['/', 'Startseite'],
  ['/planer/?template=kastenwagen', 'Planer'],
];

const browser = await chromium.launch();
const erg = {};

for (const schema of ['light', 'dark']) {
  const zeilen = {};
  for (const [pfad, label] of SEITEN) {
    const ctx = await browser.newContext({ colorScheme: schema, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + pfad, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    zeilen[label] = await page.evaluate(async (namen) => {
      await document.fonts.ready;
      const tokens = {};
      for (const n of namen)
        tokens[n] = getComputedStyle(document.documentElement).getPropertyValue(n).trim();

      // document.fonts.check() allein reicht nicht als Schrift-Nachweis: die
      // System-Schrift liegt bei gleicher Fontgröße nur wenige Pixel daneben.
      // Verglichen wird deshalb die gerenderte Breite gegen jede Kandidaten-
      // familie, gemessen am selben String in derselben Größe und Schärke.
      const proben = (selektor) => {
        const el = document.querySelector(selektor);
        if (!el) return null;
        const s = getComputedStyle(el);
        const breite = (familie) => {
          const k = document.createElement('span');
          k.textContent = 'Hamburgefonstus 1234567890';
          k.style.cssText =
            'position:absolute;visibility:hidden;white-space:nowrap;font-size:' +
            s.fontSize +
            ';font-weight:' +
            s.fontWeight +
            ';font-family:' +
            familie;
          document.body.appendChild(k);
          const b = Math.round(k.getBoundingClientRect().width * 100) / 100;
          k.remove();
          return b;
        };
        return {
          selektor,
          groesse: s.fontSize,
          familie: s.fontFamily.split(',')[0],
          gemalt: breite(s.fontFamily),
          outfit: breite('"Outfit Variable"'),
          inter: breite('"Inter Variable"'),
          system: breite('system-ui'),
        };
      };
      return { tokens, schriften: [proben('h1'), proben('h2'), proben('body')].filter(Boolean) };
    }, NAMEN);
    await ctx.close();
  }
  erg[schema] = zeilen;
}
await browser.close();

fs.mkdirSync(OUT_DIR, { recursive: true });
const datei = path.join(OUT_DIR, `computed-styles-${name}.json`);
fs.writeFileSync(datei, JSON.stringify({ erfasst: new Date().toISOString(), base: BASE, erg }, null, 1));

console.log(`Token\thell\t\tdunkel\t\tPlaner hell`);
for (const n of NAMEN) {
  const h = erg.light['Startseite'].tokens[n];
  const d = erg.dark['Startseite'].tokens[n];
  const p = erg.light['Planer'].tokens[n];
  console.log(`${n.padEnd(18)}${String(h).slice(0, 18).padEnd(16)}${String(d).slice(0, 18).padEnd(16)}${p}`);
}
console.log(`\ngeschrieben: ${path.relative(process.cwd(), datei)}`);
