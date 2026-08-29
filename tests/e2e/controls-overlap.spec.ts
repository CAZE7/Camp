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

test.describe('M10-2 Control-Überlappungen', () => {
  test('Statuszeile, MiniMap, FAB und Controls überlappen nicht', async ({ page }) => {
    await openPlanner(page);
    await showCanvas(page);
    await addComponent(page, 'battery');

    const boxes = (
      await Promise.all([
        boxOf(page.locator('.react-flow__controls')),
        boxOf(page.locator('.react-flow__minimap')),
        boxOf(page.locator('.planner-statusbar')),
        boxOf(page.getByTestId('expert-panel')),
        boxOf(page.getByTestId('mobile-overview')),
        boxOf(page.getByTestId('mobile-undo')),
      ])
    ).filter((box): box is NonNullable<typeof box> => box !== null);

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlap(boxes[i]!, boxes[j]!), 'zwei Canvas-Controls überlappen').toBe(false);
      }
    }
  });
});
