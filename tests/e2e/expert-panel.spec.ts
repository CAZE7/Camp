import { expect, test, type Locator } from '@playwright/test';
import { addComponent, openPlanner, showCanvas } from './helpers';

function overlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function boxOf(locator: Locator) {
  if ((await locator.count()) === 0) return null;
  if (!(await locator.first().isVisible())) return null;
  return locator.first().boundingBox();
}

test.describe('M8-2 Fachwissen-Panel', () => {
  test('X ist sichtbar/klickbar und überlappt MiniMap/Status/Übersicht nicht', async ({ page }) => {
    await openPlanner(page);
    await showCanvas(page);
    await addComponent(page, 'battery');

    const openFab = page.getByRole('button', { name: /hilfe und fachwissen öffnen/i });
    await expect(openFab).toBeVisible();
    await openFab.click();

    const close = page.getByTestId('expert-panel-close');
    await expect(close).toBeVisible();
    await expect(close).toBeEnabled();
    const closeBox = await close.boundingBox();
    expect(closeBox, 'Schließen-Button ohne Box').not.toBeNull();
    expect(closeBox!.width).toBeGreaterThanOrEqual(44);
    expect(closeBox!.height).toBeGreaterThanOrEqual(44);

    const panel = await boxOf(page.getByTestId('expert-panel-open'));
    expect(panel).not.toBeNull();

    const neighbors = [
      await boxOf(page.locator('.react-flow__minimap')),
      await boxOf(page.locator('.planner-statusbar')),
      await boxOf(page.getByTestId('mobile-overview')),
    ];
    for (const neighbor of neighbors) {
      if (!neighbor) continue;
      expect(overlap(panel!, neighbor), 'Fachwissen-Panel überlappt ein Canvas-Control').toBe(false);
    }

    await close.click();
    await expect(page.getByTestId('expert-panel-open')).toHaveCount(0);
  });
});
