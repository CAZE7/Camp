import { expect, test, type Locator } from '@playwright/test';
import { addComponent, openPlanner, showCanvas } from './helpers';

function overlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  const pad = 1;
  return (
    a.x + pad < b.x + b.width &&
    a.x + a.width - pad > b.x &&
    a.y + pad < b.y + b.height &&
    a.y + a.height - pad > b.y
  );
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
      { name: 'minimap', box: await boxOf(page.locator('.react-flow__minimap')) },
      { name: 'statusbar', box: await boxOf(page.locator('.planner-statusbar')) },
      { name: 'mobile-overview', box: await boxOf(page.getByTestId('mobile-overview')) },
    ];
    for (const neighbor of neighbors) {
      if (!neighbor.box) continue;
      expect(overlap(panel!, neighbor.box), `Fachwissen-Panel überlappt ${neighbor.name}`).toBe(false);
    }

    await close.click();
    await expect(page.getByTestId('expert-panel-open')).toHaveCount(0);
  });
});
