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

test.describe('M10-2 Control-Überlappungen', () => {
  test('Statuszeile, MiniMap, FAB und Controls überlappen nicht', async ({ page }) => {
    await openPlanner(page);
    await showCanvas(page);
    await addComponent(page, 'battery');

    const named = [
      { name: 'controls', box: await boxOf(page.locator('.react-flow__controls')) },
      { name: 'minimap', box: await boxOf(page.locator('.react-flow__minimap')) },
      { name: 'statusbar', box: await boxOf(page.locator('.planner-statusbar')) },
      { name: 'expert-panel', box: await boxOf(page.getByTestId('expert-panel')) },
      { name: 'mobile-overview', box: await boxOf(page.getByTestId('mobile-overview')) },
      { name: 'mobile-undo', box: await boxOf(page.getByTestId('mobile-undo')) },
    ].filter((item): item is { name: string; box: NonNullable<(typeof item)['box']> } => item.box !== null);

    for (let i = 0; i < named.length; i++) {
      for (let j = i + 1; j < named.length; j++) {
        expect(overlap(named[i]!.box, named[j]!.box), `${named[i]!.name} überlappt ${named[j]!.name}`).toBe(
          false
        );
      }
    }
  });
});
