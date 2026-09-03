import { expect, test } from '@playwright/test';

/**
 * D-9: Visuelles Gate des Werft-Relaunchs.
 *
 * Kernrouten als Pixel-Baselines — hell + dunkel (System-Schema, siehe
 * SystemThemeSync), 375/768/1440 px (die drei AGENTS-Breakpoints; das
 * touch-pixel5-Projekt nimmt bewusst teil, da 375 x Touch die mobilste
 * Darstellung ist). Getestet wird der gebaute Static Export (./out).
 *
 * Schwelle: 2 % abweichende Pixel (maxDiffPixelRatio) — tolerant gegen
 * Anti-Aliasing, hart gegen Layout-/Farb-Brüche. Baselines liegen in
 * tests/e2e/visual.spec.ts-snapshots/; Refresh mit
 * `npx playwright test tests/e2e/visual.spec.ts --update-snapshots`.
 */

const SNAPSHOT = { maxDiffPixelRatio: 0.02, animations: 'disabled' as const };

const ROUTES: Array<{ path: string; name: string; fullPage: boolean }> = [
  { path: '/', name: 'start', fullPage: true },
  { path: '/tools/dach/', name: 'dach', fullPage: false },
  { path: '/tools/heizung/', name: 'heizung', fullPage: false },
  { path: '/impressum/', name: 'impressum', fullPage: true },
];

const SCHEMES = ['light', 'dark'] as const;

for (const scheme of SCHEMES) {
  test.describe(`D-9 visuelles Gate (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    for (const route of ROUTES) {
      test(`${route.name} hält die Baseline`, async ({ page }) => {
        await page.goto(route.path, { waitUntil: 'load' });
        // Onboarding-Dialoge sind Teil des Erstbesuchs-Erlebnisses und damit
        // deterministisch — sie werden NICHT weggeklickt. Gewartet wird nur
        // auf Zustände: fertiges DOM, gebündelte Schriften geladen.
        await expect(page.locator('body')).not.toBeEmpty();
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('body')).toBeVisible();
        await expect(page).toHaveScreenshot(`route-${route.name}-${scheme}.png`, {
          fullPage: route.fullPage,
          ...SNAPSHOT,
        });
      });
    }
  });
}
