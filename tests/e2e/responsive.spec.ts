import { expect, test } from '@playwright/test';
import { addComponent, expectNoHorizontalOverflow, openPlanner, showCanvas } from './helpers';

/**
 * Pflichtszenario 2 (AGENTS.md K5):
 * Responsives Layout bei 375, 768 und 1440 px ohne horizontalen Overflow.
 *
 * Die Breakpoints sind die verbindlichen Entscheidungen aus Mission 1:
 *   < 768 px   Bottom-Tabs, ein Bereich sichtbar
 *   768–1279   Sidebar + Canvas, Inspector als Slide-over
 *   ≥ 1280 px  drei Spalten, Inspector angedockt
 */
test.describe('Responsives Layout', () => {
  test('kein horizontaler Overflow — leer und mit Plan', async ({ page }) => {
    await openPlanner(page);
    await expectNoHorizontalOverflow(page);

    await addComponent(page, 'battery');
    await addComponent(page, 'inverter');
    await addComponent(page, 'consumer230v');
    await expectNoHorizontalOverflow(page);
  });

  test('zeigt die für die Breite vorgesehenen Bereiche', async ({ page }) => {
    await openPlanner(page);
    const width = page.viewportSize()?.width ?? 0;

    const bottomNav = page.getByTestId('planner-bottom-nav');
    const sidebar = page.getByTestId('sidebar');

    if (width < 768) {
      // Handy: Bottom-Navigation sichtbar, Sidebar nur über ihren Tab.
      await expect(bottomNav).toBeVisible();
      await expect(sidebar).toBeHidden();
      await page.getByTestId('nav-tab-sidebar').click();
      await expect(sidebar).toBeVisible();
    } else {
      // Tablet und Desktop: Sidebar dauerhaft sichtbar, keine Bottom-Tabs.
      await expect(sidebar).toBeVisible();
      await expect(bottomNav).toBeHidden();
    }
  });

  test('der Canvas behält auf Tablet und Desktop genügend Breite', async ({ page }) => {
    await openPlanner(page);
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width < 768, 'Auf dem Handy ist der Canvas ein eigener Tab.');

    await showCanvas(page);
    const box = await page.getByTestId('planner-canvas-column').boundingBox();
    expect(box).not.toBeNull();
    // Mission-1-Entscheidung: der Canvas darf nie unter 600 px fallen, sobald
    // drei Spalten möglich sind. Auf dem Tablet ist der Inspector ein
    // Slide-over und nimmt keine Spaltenbreite weg.
    const minimum = width >= 1280 ? 600 : 400;
    expect(box!.width).toBeGreaterThanOrEqual(minimum);
  });

  test('Touch-Ziele der Navigation sind mindestens 44 px hoch', async ({ page }) => {
    await openPlanner(page);
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width >= 768, 'Bottom-Navigation existiert nur unter 768 px.');

    for (const id of ['nav-tab-sidebar', 'nav-tab-electric', 'nav-tab-water', 'nav-tab-inspector']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, `${id} nicht sichtbar`).not.toBeNull();
      expect(box!.height, `${id} zu klein`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${id} zu schmal`).toBeGreaterThanOrEqual(44);
    }
  });
});
