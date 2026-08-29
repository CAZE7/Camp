import { expect, test } from '@playwright/test';
import { addComponent, autoWire, openPlanner, showCanvas } from './helpers';

/**
 * M10-3: Screenshot-Baseline des Referenzplans.
 * 375 + 1280 px, hell + dunkel. Schwelle 2 % (maxDiffPixelRatio).
 *
 * Solange keine eingecheckten PNG-Baselines existieren, bleibt die Suite
 * übersprungen — sonst blockiert das erste CI den Merge. Erzeugen mit
 * `npx playwright test tests/e2e/visual.spec.ts --update-snapshots`.
 */
const SNAPSHOT = { maxDiffPixelRatio: 0.02, animations: 'disabled' as const };

test.describe.skip('M10-3 visuelles Gate', () => {
  test('Referenzplan hell', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'touch-pixel5' || testInfo.project.name === 'tablet-768',
      'Baselines nur 375 und 1280'
    );
    const mobile = testInfo.project.name === 'mobile-375';
    if (!mobile) await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: 'light' });
    await openPlanner(page);
    await showCanvas(page);
    await addComponent(page, 'battery');
    await addComponent(page, 'inverter');
    await addComponent(page, 'fuse');
    await autoWire(page);
    await expect(page.getByTestId('planner-shell')).toHaveScreenshot(
      `planer-${mobile ? '375' : '1280'}-hell.png`,
      SNAPSHOT
    );
  });

  test('Referenzplan dunkel', async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile-375';
    if (!mobile) await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await openPlanner(page);
    await showCanvas(page);
    await addComponent(page, 'battery');
    await addComponent(page, 'inverter');
    await addComponent(page, 'fuse');
    await autoWire(page);
    await expect(page.getByTestId('planner-shell')).toHaveScreenshot(
      `planer-${mobile ? '375' : '1280'}-dunkel.png`,
      SNAPSHOT
    );
  });
});
