import { expect, test } from '@playwright/test';

import { PIXEL_MARKER } from './pixelMarker';

/**
 * Pixel-Baselines des Dark-Engineering-Design-Systems (Modul 5).
 *
 * Eingefroren werden die /design-system-Schaukastenansicht in light/dark über
 * die drei AGENTS-Breakpoints und die Node-Card-Zustände. Diese Vergleiche
 * gehören in den meldenden Job (`visual` in `.github/workflows/quality.yml`)
 * und laufen deshalb über den Titel — ein Baseline-Diff meldet UI-Drift, statt
 * den Deploy zu stoppen. Verhalten derselben Ansicht (CLS, Schriftgröße) prüft
 * `visual-de.spec.ts` blockierend.
 *
 * Baselines: `tests/e2e/visual-de-pixel.spec.ts-snapshots/`. Neu aufnehmen nach
 * optischer Freigabe mit
 * `npx playwright test tests/e2e/visual-de-pixel.spec.ts --update-snapshots`.
 */

const SNAPSHOT = { maxDiffPixelRatio: 0.02, animations: 'disabled' as const };

test.describe('Dark Engineering Pixel', () => {
  const viewports = [
    { name: 'mobile-375', width: 375, height: 812 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'desktop-1440', width: 1440, height: 900 },
  ] as const;

  const themes = ['light', 'dark'] as const;

  for (const theme of themes) {
    for (const vp of viewports) {
      test(`design-system ${theme} ${vp.name} ${PIXEL_MARKER}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        // Theme via class — layout.tsx setzt .dark via SystemThemeSync
        await page.emulateMedia({ colorScheme: theme === 'dark' ? 'dark' : 'light' });
        await page.goto('/design-system');
        await page.waitForSelector('text=DARK ENGINEERING DESIGN SYSTEM');
        // Ohne wartende Schrift wäre das eingefrorene Bild eine Momentaufnahme
        // mitten im Webfont-Swap.
        await page.evaluate(() => document.fonts.ready);

        await expect(page).toHaveScreenshot(`de-design-system-${theme}-${vp.name}.png`, {
          ...SNAPSHOT,
          fullPage: true,
        });
      });
    }
  }

  test(`node-card states — 9-State Matrix ${PIXEL_MARKER}`, async ({ page }) => {
    await page.goto('/design-system');
    await page.waitForSelector('.de-node-card');
    await page.evaluate(() => document.fonts.ready);

    const node = page.locator('.de-node-card').first();

    // Default
    await expect(node).toHaveScreenshot('de-node-default.png', SNAPSHOT);

    // Hover
    await node.hover();
    await expect(node).toHaveScreenshot('de-node-hover.png', SNAPSHOT);

    // Focus-Visible
    await page.keyboard.press('Tab');
    await expect(node).toHaveScreenshot('de-node-focus.png', SNAPSHOT);

    // Selected
    await node.click();
    await expect(node).toHaveScreenshot('de-node-selected.png', SNAPSHOT);
  });
});
