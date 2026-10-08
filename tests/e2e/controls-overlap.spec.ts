import { expect, test, type Locator } from '@playwright/test';
import { addComponent, autoWire, openPlanner, showCanvas } from './helpers';

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

/**
 * Der Prüfbericht liegt auf schmalen Geräten als Blatt am Fenster (über der
 * Navigation), ab `md` als Popover unter dem Abzeichen. Zuvor war er am
 * Abzeichen verankert und rutschte auf 375 px links aus dem Bild
 * (gemessen: linke Kante −68 px) — dieser Test hält die Kante fest.
 */
test.describe('M10-2 Prüfbericht bleibt im Bild', () => {
  test('das Blatt liegt vollständig im Fenster', async ({ page }) => {
    await openPlanner(page);
    await showCanvas(page);
    await addComponent(page, 'battery');
    await autoWire(page);

    const badge = page.getByRole('button', { name: /Planungsprüfung öffnen/ });
    await badge.scrollIntoViewIfNeeded();
    await badge.click();

    const panel = page.getByRole('dialog', { name: 'Planungsprüfung' });
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box, 'Prüfbericht ohne Bounding-Box').not.toBeNull();
    expect(box!.x, 'linke Kante außerhalb').toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width, 'rechte Kante außerhalb').toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y, 'obere Kante außerhalb').toBeGreaterThanOrEqual(-1);
    expect(box!.y + box!.height, 'untere Kante außerhalb').toBeLessThanOrEqual(viewport.height + 1);
  });
});

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
