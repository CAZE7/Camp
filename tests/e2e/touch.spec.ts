import { expect, test, type Locator, type Page } from '@playwright/test';
import { addComponent, autoWire, edgeCount, nodeCount, openPlanner, showCanvas } from './helpers';

/**
 * React Flow platziert das 60-px-Touchziel außerhalb der Karte, damit es nicht
 * von ihr verdeckt wird. Am Viewportrand liegt der Mittelpunkt dieses Ziels
 * manchmal außerhalb des Bildschirms; reale Finger treffen den sichtbaren
 * Teil. Der Helper tippt deshalb in die sichtbare Schnittmenge statt Playwrights
 * Standard-Mittelpunkt zu verwenden, der die Zeichenfläche erst wegschwenkt.
 */
async function tapVisibleHandle(page: Page, handle: Locator) {
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  const bounds = box!;
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const left = Math.max(0, bounds.x);
  const right = Math.min(viewport.width, bounds.x + bounds.width);
  const top = Math.max(0, bounds.y);
  const bottom = Math.min(viewport.height, bounds.y + bounds.height);

  expect(right).toBeGreaterThan(left);
  expect(bottom).toBeGreaterThan(top);
  await handle.tap({
    position: {
      x: (left + right) / 2 - bounds.x,
      y: (top + bottom) / 2 - bounds.y,
    },
  });
}

/**
 * Pflichtszenario 4 (AGENTS.md K5):
 * Touch-/Tap-Interaktion, soweit im Browser automatisierbar.
 *
 * Grenzen der Emulation sind in docs/E2E-TESTS.md dokumentiert: Chromium
 * emuliert Touch-Events und `hasTouch`, aber weder echte Fingergrößen noch
 * Betriebssystem-Gesten (Pinch-Zoom, Scroll-Momentum, Haptik).
 */
test.describe('Touch-Bedienung', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'Nur in Touch-Projekten sinnvoll.');

  test('Antippen einer Kachel fügt ein Bauteil hinzu', async ({ page }) => {
    await openPlanner(page);
    await addComponent(page, 'battery');
    expect(await nodeCount(page)).toBe(1);
  });

  test('die Bottom-Tabs wechseln zwischen den Bereichen', async ({ page }) => {
    await openPlanner(page);

    await page.getByTestId('nav-tab-sidebar').tap();
    await expect(page.getByTestId('sidebar')).toBeVisible();

    await page.getByTestId('nav-tab-electric').tap();
    await expect(page.getByTestId('planner-canvas-column')).toBeVisible();

    await page.getByTestId('nav-tab-inspector').tap();
    await expect(page.getByTestId('inspector-panel')).toBeVisible();
  });

  test('Tap-to-Connect verbindet zwei Anschlüsse', async ({ page }) => {
    await openPlanner(page);
    await addComponent(page, 'battery');
    await addComponent(page, 'busbar');
    await showCanvas(page);

    const before = await edgeCount(page);

    // React Flow vergibt an jedem Anschluss `data-nodeid` und `data-handleid`
    // — beides Teil seiner öffentlichen API und damit stabile Selektoren.
    const batteryPlus = page
      .locator('.react-flow__node-battery .react-flow__handle[data-handleid="plus"]')
      .first();
    const busbarPlus = page
      .locator('.react-flow__node-busbar .react-flow__handle[data-handleid="plus"]')
      .first();

    await expect(batteryPlus).toBeVisible();
    await expect(busbarPlus).toBeVisible();

    await tapVisibleHandle(page, batteryPlus);
    // Nach dem ersten Tap meldet der Planer den gewählten Anschluss.
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: /Anschluss/i })
        .first()
    ).toBeVisible();

    await tapVisibleHandle(page, busbarPlus);
    await expect.poll(async () => edgeCount(page)).toBeGreaterThan(before);
  });

  test('ein zweiter Tap auf denselben Anschluss bricht ab', async ({ page }) => {
    await openPlanner(page);
    await addComponent(page, 'battery');
    await showCanvas(page);

    const before = await edgeCount(page);
    const handle = page
      .locator('.react-flow__node-battery .react-flow__handle[data-handleid="plus"]')
      .first();

    await tapVisibleHandle(page, handle);
    await tapVisibleHandle(page, handle);

    await expect(
      page
        .getByRole('status')
        .filter({ hasText: /abgebrochen/i })
        .first()
    ).toBeVisible();
    expect(await edgeCount(page)).toBe(before);
  });

  test('M3.4: Long-Press öffnet auf Touch dasselbe Kontextmenü', async ({ page }) => {
    await openPlanner(page);
    await addComponent(page, 'battery');
    await showCanvas(page);
    const card = page.locator('.react-flow__node-battery [role="group"]').first();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    await card.dispatchEvent('pointerdown', {
      pointerType: 'touch',
      isPrimary: true,
      clientX: box!.x + box!.width / 2,
      clientY: box!.y + box!.height / 2,
    });
    await expect(page.getByRole('menu', { name: 'Kontextmenü der Arbeitsfläche' })).toBeVisible();
    await card.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true });
  });

  test('M3.1: Undo und Redo funktionieren auf 375 px ohne Tastatur', async ({ page }) => {
    await openPlanner(page);
    await addComponent(page, 'battery');
    await showCanvas(page);
    expect(await nodeCount(page)).toBe(1);

    const undo = page.getByTestId('mobile-undo');
    const redo = page.getByTestId('mobile-redo');
    await expect(undo).toBeVisible();
    await expect(undo).toBeEnabled();
    await undo.tap();
    await expect.poll(async () => nodeCount(page)).toBe(0);

    await expect(redo).toBeEnabled();
    await redo.tap();
    await expect.poll(async () => nodeCount(page)).toBe(1);
  });

  test('Auto-Wire funktioniert auch mit Touch', async ({ page }) => {
    await openPlanner(page);
    await addComponent(page, 'battery');
    await addComponent(page, 'consumer');
    await autoWire(page);
    expect(await edgeCount(page)).toBeGreaterThan(0);
  });
});
