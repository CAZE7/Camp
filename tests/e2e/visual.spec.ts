import { expect, test } from '@playwright/test';

import { PIXEL_MARKER } from './pixelMarker';

/**
 * D-9 / UI-BASELINE: Visuelles Gate des Werft-Relaunchs.
 *
 * Kernrouten als Pixel-Baselines — hell + dunkel (System-Schema, siehe
 * SystemThemeSync), 375/768/1440 px (die drei AGENTS-Breakpoints; das
 * touch-pixel5-Projekt nimmt bewusst teil, da 375 x Touch die mobilste
 * Darstellung ist). Getestet wird der gebaute Static Export (./out).
 *
 * Der Freeze-Punkt ist in docs/UI-BASELINE.md dokumentiert. Geschützt sind
 * Homepage, Planner, Sidebar/Canvas/Inspector-Chrome, WarningCenter-Zustand,
 * Mobile und Dark Mode. V2-Architekturarbeit darf diese Baseline nicht als
 * Nebenwirkung verschieben.
 *
 * Schwelle: 2 % abweichende Pixel (maxDiffPixelRatio) — tolerant gegen
 * Anti-Aliasing, hart gegen Layout-/Farb-Brüche. Baselines liegen in
 * tests/e2e/visual.spec.ts-snapshots/; Refresh nur nach UI-Freigabe mit
 * `npx playwright test tests/e2e/visual.spec.ts --update-snapshots`.
 *
 * Eingefroren wird der **hydratisierte** Zustand (s. `ready` unten). Für die
 * Planner-Route ist das der Normalfall: Erstbesuch, Onboarding-Dialog offen,
 * Schrittleiste und Hinweis-Abzeichen sichtbar (docs/UI-BASELINE.md §2).
 */

const SNAPSHOT = { maxDiffPixelRatio: 0.02, animations: 'disabled' as const };

/**
 * `ready` benennt das `data-testid`, auf das zusätzlich gewartet wird, bevor
 * fotografiert wird — dieselbe Kennung, die `tests/e2e/helpers.ts`
 * (`openPlanner`) benutzt und die `components/e2eSelectors.test.tsx` als
 * Vertrag festhält. Der Planner wird dynamisch importiert; ohne dieses Warten
 * ist der eingefrorene Frame eine Momentaufnahme des halb montierten
 * Dashboards (gemessen 2026-09-28: die Baselines aus der Tablet-Breite
 * zeigten genau das — fehlende Schrittleiste und Hinweis-Abzeichen —, was den
 * Lauf auf beiden Schemata um 2,4–4,1 % abweichen ließ).
 */
const ROUTES: Array<{ path: string; name: string; fullPage: boolean; ready?: string }> = [
  { path: '/', name: 'start', fullPage: true },
  { path: '/tools/dach/', name: 'dach', fullPage: false },
  { path: '/tools/heizung/', name: 'heizung', fullPage: false },
  { path: '/elektrik-planung/', name: 'planung', fullPage: false, ready: 'planner-shell' },
  { path: '/impressum/', name: 'impressum', fullPage: true },
];

const SCHEMES = ['light', 'dark'] as const;

for (const scheme of SCHEMES) {
  test.describe(`D-9 visuelles Gate (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    for (const route of ROUTES) {
      test(`${route.name} ${PIXEL_MARKER}`, async ({ page }) => {
        await page.goto(route.path, { waitUntil: 'load' });
        // Onboarding-Dialoge sind Teil des Erstbesuchs-Erlebnisses und damit
        // deterministisch — sie werden NICHT weggeklickt. Gewartet wird nur
        // auf Zustände: fertiges DOM, montierte App-Shell, gebündelte
        // Schriften geladen.
        await expect(page.locator('body')).not.toBeEmpty();
        await expect(page.locator('body')).toBeVisible();
        if (route.ready) {
          await expect(page.getByTestId(route.ready)).toBeVisible({ timeout: 30_000 });
          // Zwei Frames Ruhe: React Flow/Layout schreiben nach der Montage
          // noch eine Runde an den Stil-Attributen.
          await page.evaluate(
            () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          );
        }
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot(`route-${route.name}-${scheme}.png`, {
          fullPage: route.fullPage,
          ...SNAPSHOT,
        });
      });
    }
  });
}
