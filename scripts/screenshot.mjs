// Headless screenshot helper using a bundled Chromium (@sparticuz/chromium).
// Run: node scripts/screenshot.mjs <outputDir> [width:height:theme:label ...]
// Example: node scripts/screenshot.mjs docs/screenshots 375:812:light,768:1024:light,1440:900:light
import Chromium from '@sparticuz/chromium';
import { createRequire } from 'node:module';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const BASE = process.env.PLANNER_URL || 'http://localhost:3000/Camp/elektrik-planung/';

function parseSpec(spec) {
  const [wh, theme = 'light'] = spec.split(':');
  const [w, h] = wh.split('x').map(Number);
  return { w, h, theme };
}

async function main() {
  const outDir = process.argv[2] || 'docs/screenshots';
  const specs = (process.argv[3] || '375x812:light,768x1024:light,1440x900:light').split(',');
  await mkdir(outDir, { recursive: true });

  const executablePath = await Chromium.executablePath();
  console.log('Chromium executable:', executablePath);

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process', '--no-zygote', '--font-render-hinting=none'],
    defaultViewport: null,
  });
  const page = await browser.newPage();

  // Navigate once to establish the origin, then persist the theme so the
  // pre-hydration layout script picks it up on the next load.
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });

  for (const spec of specs) {
    const { w, h, theme } = parseSpec(spec);
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.evaluate((t) => localStorage.setItem('camp-theme', t), theme);
    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });

    await page.waitForSelector('.react-flow__node', { timeout: 30000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 900));

    if (process.env.ZOOM_WHICH === 'battery') {
      const box = await page.evaluate(() => {
        const t = Array.from(document.querySelectorAll('.planner-node__title')).find((c) =>
          c.textContent?.includes('Batterie'),
        );
        const card = t ? t.closest('.planner-node') : document.querySelector('.planner-node');
        const r = card.getBoundingClientRect();
        return { x: Math.max(0, r.x - 30), y: Math.max(0, r.y - 30), width: r.width + 60, height: r.height + 60 };
      });
      await page.screenshot({ path: path.join(outDir, `zoom-battery-${theme}.png`), clip: box });
      console.log('Saved zoom', theme);
      continue;
    }

    if (process.env.MODE === 'water') {
      const sw = await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('Wasser'));
        if (b) b.click();
        return true;
      });
      if (sw) await new Promise((r) => setTimeout(r, 500));
    }

    if (process.env.SELECT === 'battery') {
      // Real mouse click on the Battery node to open the Inspector.
      const rect = await page.evaluate(() => {
        const t = Array.from(document.querySelectorAll('.planner-node__title')).find((c) => c.textContent?.includes('Batterie'));
        const card = t ? t.closest('.planner-node') : null;
        const r = card.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      if (rect) {
        await page.mouse.click(rect.x, rect.y);
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    const file = path.join(outDir, `planner-${w}x${h}-${theme}${process.env.MODE === 'water' ? '-water' : ''}${process.env.SELECT === 'battery' ? '-inspector' : ''}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log('Saved', file);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
