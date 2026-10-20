import { expect, test, type Locator, type Page } from '@playwright/test';
import { openMenubar } from './helpers';

/**
 * Geometrie auf einem frischen Beispielplan.
 * Der Assistent wird mit ✕ geschlossen — „Mit leerem Plan beginnen“ würde
 * den Plan verwerfen.
 *
 * Die Maße laufen einmal, im Projekt `mobile-375`. Die drei Fenster sind
 * die gemessenen Fundstellen (375×667, 393×852, 852×393).
 */

async function openFreshExample(page: Page): Promise<void> {
  await page.goto('/planer/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await expect(page.getByTestId('planner-shell')).toBeVisible({ timeout: 30_000 });
  const dialog = page.getByRole('dialog');
  await dialog
    .first()
    .waitFor({ state: 'visible', timeout: 8_000 })
    .catch(() => undefined);
  if ((await dialog.count()) > 0) {
    await dialog.getByRole('button', { name: 'Dialog schließen' }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(page.locator('[data-designator]').first()).toBeAttached({ timeout: 15_000 });
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

function insideViewport(
  box: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number }
): boolean {
  return (
    box.x >= -1 &&
    box.y >= -1 &&
    box.x + box.width <= viewport.width + 1 &&
    box.y + box.height <= viewport.height + 1
  );
}

async function settledCritical(page: Page): Promise<number> {
  let previous = -1;
  let hits = 0;
  let value = 0;
  await expect
    .poll(
      async () => {
        value = await criticalCount(page);
        hits = value === previous ? hits + 1 : 0;
        previous = value;
        return hits;
      },
      { timeout: 12_000, intervals: [200] }
    )
    .toBeGreaterThanOrEqual(5);
  return value;
}

async function criticalCount(page: Page): Promise<number> {
  const text = await page.locator('.planner-statusbar').innerText();
  const match = text.match(/(\d+)\s+kritisch/);
  return match ? Number(match[1]) : 0;
}

async function zoomPercent(page: Page): Promise<number> {
  const text = await page.locator('.planner-statusbar').innerText();
  const match = text.match(/Zoom\s+(\d+)/);
  return match ? Number(match[1]) : Number.NaN;
}

/** Die Gruppenfläche liegt als erstes `.react-flow__node` über dem Plan und
 *  wählt kein Bauteil. Ein Strompfad entsteht nur auf einer sichtbaren Karte. */
async function clickVisiblePart(page: Page, viewport: { width: number; height: number }): Promise<void> {
  const nodes = page.locator('.react-flow__node:not(.planner-backbone-group-node)');
  const nodeCount = await nodes.count();
  for (let index = 0; index < nodeCount; index += 1) {
    const candidate = nodes.nth(index);
    const nodeId = await candidate.getAttribute('data-id');
    const box = await candidate.boundingBox();
    if (!nodeId || !box || box.width < 40 || box.height < 24 || box.width > 320) continue;
    const x = box.x + Math.min(36, box.width / 2);
    const y = box.y + Math.min(22, box.height / 3);
    if (x < 8 || y < 8 || x > viewport.width - 8 || y > viewport.height - 8) continue;
    const hitsSelf = await page.evaluate(
      ({ pointX, pointY, id }) => {
        const top = document.elementFromPoint(pointX, pointY);
        return top?.closest('.react-flow__node')?.getAttribute('data-id') === id;
      },
      { pointX: x, pointY: y, id: nodeId }
    );
    if (!hitsSelf) continue;
    await page.mouse.click(x, y);
    return;
  }
  throw new Error('kein sichtbares Bauteil zum Anklicken');
}

test.describe('Frischstart nach geleertem Speicher', () => {
  test('ein fremder Plan kommt nicht zurück und der Assistent erscheint', async ({ page }) => {
    await page.goto('/planer/');
    await page.evaluate(() => {
      localStorage.setItem(
        'elektroplaner-planner-v1',
        JSON.stringify({
          state: {
            nodes: [
              {
                id: 'fremd',
                type: 'battery',
                position: { x: 40, y: 40 },
                data: { label: 'QA-FREMD' },
              },
            ],
            edges: [],
            waterNodes: [],
            waterEdges: [],
          },
          version: 1,
        })
      );
      localStorage.setItem(
        'elektroplaner-preferences-v1',
        JSON.stringify({ state: { hasOnboarded: true, calculatedSolarWatts: 0 }, version: 2 })
      );
    });
    await page.reload();
    await expect(page.getByText('QA-FREMD')).toBeVisible({ timeout: 15_000 });

    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      if (window.caches) {
        for (const name of await window.caches.keys()) await window.caches.delete(name);
      }
      if (typeof indexedDB.databases === 'function') {
        for (const database of await indexedDB.databases()) {
          if (database.name) indexedDB.deleteDatabase(database.name);
        }
      }
      const registrations = await navigator.serviceWorker?.getRegistrations();
      await Promise.all((registrations ?? []).map((registration) => registration.unregister()));
    });
    await page.reload();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('QA-FREMD')).toHaveCount(0);
  });
});

for (const viewport of [
  { name: '375x667', width: 375, height: 667 },
  { name: '393x852', width: 393, height: 852 },
  { name: '852x393', width: 852, height: 393 },
]) {
  test.describe(`Handy-Geometrie ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    test.beforeEach(({ browserName: _browserName }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-375', 'einmal je Fenster, im Projekt mobile-375');
    });

    test('Menü, Übersicht, Zoom und Strompfad liegen frei', async ({ page }) => {
      await openFreshExample(page);

      const phoneChrome = viewport.width < 768 || viewport.height <= 500;
      if (phoneChrome) {
        await expect(page.locator('.cad-menubar')).toBeHidden();
        const phone = page.getByTestId('phone-menu');
        const toolbar = page.getByTestId('planner-toolbar');
        await expect(phone).toBeVisible();
        const phoneBox = await boxOf(phone);
        const toolbarBox = await boxOf(toolbar);
        expect(phoneBox.y).toBeGreaterThanOrEqual(toolbarBox.y - 1);
        expect(phoneBox.y + phoneBox.height).toBeLessThanOrEqual(toolbarBox.y + toolbarBox.height + 1);
        expect(toolbarBox.height).toBeLessThanOrEqual(56);
        const rail = page.getByTestId('guided-rail');
        if (await rail.isVisible()) {
          const railBox = await boxOf(rail);
          expect(railBox.y - toolbarBox.y).toBeLessThanOrEqual(toolbarBox.height + 4);
        }
      } else {
        for (const id of ['ansicht', 'hilfe']) {
          const item = page.getByTestId(`menubar-${id}`);
          await expect(item).toBeVisible();
          const box = await boxOf(item);
          expect(insideViewport(box, viewport)).toBe(true);
          const clipped = await item.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
          expect(clipped).toBe(false);
        }
      }

      const caption = page.getByTestId('planner-mode-caption');
      if ((await caption.isVisible()) && viewport.width >= 768 && viewport.height > 500) {
        expect(boxesOverlap(await boxOf(caption), await boxOf(page.getByTestId('menubar-ansicht')))).toBe(
          false
        );
      }

      await expect(page.getByTestId('mobile-overview')).toHaveCount(1);
      const overview = page.getByTestId('mobile-overview');
      const undo = page.getByTestId('mobile-undo');
      const overviewBox = await boxOf(overview);
      expect(insideViewport(overviewBox, viewport)).toBe(true);
      expect(boxesOverlap(overviewBox, await boxOf(undo))).toBe(false);
      const nav = page.getByTestId('planner-bottom-nav');
      if (await nav.isVisible()) {
        expect(boxesOverlap(overviewBox, await boxOf(nav))).toBe(false);
      }
      const overviewHit = await overview.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return element.contains(top);
      });
      expect(overviewHit).toBe(true);

      const zoomIn = page.locator('.react-flow__controls-zoomin');
      await expect(zoomIn).toBeVisible();
      expect(insideViewport(await boxOf(zoomIn), viewport)).toBe(true);
      expect(boxesOverlap(await boxOf(overview), await boxOf(zoomIn))).toBe(false);
      const hit = await zoomIn.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return element.contains(top);
      });
      expect(hit).toBe(true);

      const status = page.locator('.planner-statusbar');
      const shown = await status.evaluate((element) => getComputedStyle(element).display !== 'none');
      expect(shown).toBe(true);
      const statusBox = await boxOf(status);
      expect(statusBox.height).toBeGreaterThan(8);
      expect(insideViewport(statusBox, viewport)).toBe(true);

      const canvas = page.getByTestId('planner-canvas-column');
      const canvasBox = await boxOf(canvas);
      expect(canvasBox.height).toBeGreaterThan(150);

      await clickVisiblePart(page, viewport);
      const trace = page.getByTestId('circuit-trace-info');
      await expect(trace).toBeVisible({ timeout: 8_000 });
      const traceBox = await boxOf(trace);
      expect(traceBox.height).toBeLessThanOrEqual(72);
      expect(boxesOverlap(traceBox, await boxOf(overview))).toBe(false);
      expect(boxesOverlap(traceBox, await boxOf(zoomIn))).toBe(false);
    });

    test('Modus-Wörter bleiben ganz und liegen nicht übereinander', async ({ page }) => {
      await openFreshExample(page);
      const ids = ['planner-mode-planung', 'planner-mode-physisch', 'planner-mode-pruefung'] as const;
      const boxes = [];
      const labelClass =
        viewport.width < 768 || viewport.height <= 500 ? '.planner-mode-short' : '.planner-mode-label';
      for (const id of ids) {
        const button = page.getByTestId(id);
        await expect(button).toBeVisible();
        const label = button.locator(labelClass);
        await expect(label).toBeVisible();
        const clipped = await label.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
        expect(clipped, id).toBe(false);
        const buttonClipped = await button.evaluate(
          (element) => element.scrollWidth > element.clientWidth + 1
        );
        expect(buttonClipped, id).toBe(false);
        boxes.push(await boxOf(button));
      }
      expect(boxesOverlap(boxes[0]!, boxes[1]!)).toBe(false);
      expect(boxesOverlap(boxes[1]!, boxes[2]!)).toBe(false);
      const ansicht = page.getByTestId('canvas-display-options');
      if (await ansicht.isVisible()) {
        const ansichtBox = await boxOf(ansicht);
        for (const box of boxes) expect(boxesOverlap(box!, ansichtBox)).toBe(false);
      }
    });

    test('Auto-verbinden-Symbol unter 480 px liegt frei in der Leiste', async ({ page }) => {
      test.skip(viewport.width >= 480, 'nur die schmale Leiste');
      await openFreshExample(page);
      const wire = page.getByTestId('action-autowire');
      await expect(wire).toBeVisible();
      const wireBox = await boxOf(wire);
      expect(insideViewport(wireBox, viewport)).toBe(true);
      for (const id of ['action-more', 'action-templates', 'save-indicator']) {
        const other = page.getByTestId(id);
        if (!(await other.isVisible())) continue;
        expect(boxesOverlap(wireBox, await boxOf(other)), id).toBe(false);
      }
    });

    test('Auto-verbinden bleibt im Menü vollständig lesbar', async ({ page }) => {
      await openFreshExample(page);

      await openMenubar(page, 'werkzeuge');
      const menuItem = page.getByTestId('action-autowire-menu');
      await expect(menuItem).toBeVisible();
      await expect(menuItem).toContainText('Auto-verbinden');
      const menuClipped = await menuItem.evaluate((element) => element.scrollWidth > element.clientWidth + 2);
      expect(menuClipped).toBe(false);
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
      const overflowItem = page.getByRole('menuitem', { name: /Auto-verbinden/ });
      await expect(overflowItem).toBeVisible();
      const overflowClipped = await overflowItem.evaluate(
        (element) => element.scrollWidth > element.clientWidth + 2
      );
      expect(overflowClipped).toBe(false);
    });

    test('zweiter Zoom-Tipp vergrößert, die Karte lässt sich am Körper ziehen', async ({ page }) => {
      await openFreshExample(page);
      const zoomIn = page.locator('.react-flow__controls-zoomin');
      const before = await zoomPercent(page);
      expect(before).toBeGreaterThan(0);
      await zoomIn.click();
      await expect.poll(() => zoomPercent(page)).toBeGreaterThan(before);
      const afterFirst = await zoomPercent(page);
      await zoomIn.click();
      await expect.poll(() => zoomPercent(page)).toBeGreaterThan(afterFirst);

      const nodes = page.locator('.react-flow__node:not(.planner-backbone-group-node)');
      const nodeCount = await nodes.count();
      let node = nodes.first();
      let fromX = 0;
      let fromY = 0;
      let found = false;
      for (let index = 0; index < nodeCount; index += 1) {
        const candidate = nodes.nth(index);
        const nodeId = await candidate.getAttribute('data-id');
        const startBox = await candidate.boundingBox();
        if (!nodeId || !startBox || startBox.width < 40 || startBox.height < 24 || startBox.width > 280)
          continue;
        const x = startBox.x + Math.min(36, startBox.width / 2);
        const y = startBox.y + Math.min(22, startBox.height / 3);
        if (x < 8 || y < 8 || x > viewport.width - 8 || y > viewport.height - 8) continue;
        const hitsSelf = await page.evaluate(
          ({ pointX, pointY, id }) => {
            const top = document.elementFromPoint(pointX, pointY);
            return top?.closest('.react-flow__node')?.getAttribute('data-id') === id;
          },
          { pointX: x, pointY: y, id: nodeId }
        );
        if (!hitsSelf) continue;
        node = candidate;
        fromX = x;
        fromY = y;
        found = true;
        break;
      }
      expect(found).toBe(true);
      const start = await boxOf(node);
      await page.mouse.move(fromX, fromY);
      await page.mouse.down();
      await page.mouse.move(fromX + 64, fromY + 40, { steps: 12 });
      await page.mouse.up();
      const end = await boxOf(node);
      expect(Math.abs(end.x - start.x) + Math.abs(end.y - start.y)).toBeGreaterThan(8);
    });

    test('Kabel optimieren meldet sich und erhöht die kritischen Befunde nicht', async ({ page }) => {
      await openFreshExample(page);
      const before = await settledCritical(page);
      await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
      const optimize = page.getByTestId('action-optimize-routing');
      await expect(optimize).toBeEnabled({ timeout: 20_000 });
      await optimize.click();
      const toast = page.getByTestId('action-feedback');
      await expect(toast).toBeVisible({ timeout: 20_000 });
      await expect(toast).toContainText(/Kabelführung verbessert|bleibt unverändert|verschlechtern/);
      expect(await criticalCount(page)).toBeLessThanOrEqual(before);
    });

    test('Stückliste, Prüfbericht und Fachwissen bleiben im Bild', async ({ page }) => {
      await openFreshExample(page);

      await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
      await page.getByRole('menuitem', { name: /^Stückliste/ }).click();
      const bom = page.getByRole('dialog', { name: 'Stückliste' });
      await expect(bom).toBeVisible();
      const subtitle = bom.locator('.planner-dialog__description');
      const subtitleClipped = await subtitle.evaluate(
        (element) => element.scrollHeight > element.clientHeight + 1
      );
      expect(subtitleClipped).toBe(false);
      const release = bom.getByTestId('bom-release-status');
      await expect(release).toBeVisible();
      const releaseBox = await boxOf(release);
      expect(releaseBox.x + releaseBox.width).toBeLessThanOrEqual(viewport.width + 1);
      const scrollHeight = await bom
        .getByTestId('bom-scroll-body')
        .evaluate((element) => element.clientHeight);
      expect(scrollHeight).toBeGreaterThan(120);
      await bom.getByRole('button', { name: 'Dialog schließen' }).click();

      await clickVisiblePart(page, viewport);
      await openMenubar(page, 'hilfe');
      await page.getByRole('menuitem', { name: /Hilfe & Fachwissen/ }).click();
      const expert = page.getByTestId('expert-panel-open');
      await expect(expert).toBeVisible();
      const expertBox = await boxOf(expert);
      expect(expertBox.height).toBeGreaterThan(160);
      expect(insideViewport(expertBox, viewport) || expertBox.height > 160).toBe(true);
      const title = expert.locator('h3');
      const titleBox = await boxOf(title);
      expect(titleBox.y).toBeGreaterThanOrEqual(0);
      expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(viewport.height + 1);
      await expect(expert).toContainText('Tipps zur ausgewählten Komponente.');
      await expect(expert).not.toContainText('Wähle eine Komponente für passende Tipps.');
      await page.getByTestId('expert-panel-close').click();

      const seal = page.getByTestId('verification-seal-toggle');
      if (await seal.isVisible()) {
        await seal.click();
      } else {
        await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
        await page.getByRole('menuitem', { name: /Prüfbericht/ }).click();
      }
      const report = page.getByTestId('verification-seal-panel');
      await expect(report).toBeVisible();
      const reportHeader = report.locator('p').first();
      await page.getByRole('button', { name: /Planungsprüfung öffnen/ }).click();
      const hints = page.getByRole('dialog', { name: 'Planungsprüfung' });
      await expect(hints).toBeVisible();
      expect(boxesOverlap(await boxOf(hints), await boxOf(reportHeader))).toBe(false);
    });

    test('Prüfbericht und Hilfe liegen frei und haben eine nutzbare Höhe', async ({ page }) => {
      await openFreshExample(page);
      const minBody = viewport.height < 500 ? 100 : viewport.height < 750 ? 180 : 240;

      const ansicht = page.getByTestId('canvas-display-options');
      const caption = page.getByTestId('planner-mode-caption');
      if ((await ansicht.isVisible()) && (await caption.isVisible())) {
        expect(boxesOverlap(await boxOf(ansicht), await boxOf(caption))).toBe(false);
      }
      const trace = page.getByTestId('circuit-trace-info');
      if (await trace.isVisible()) {
        if (await ansicht.isVisible())
          expect(boxesOverlap(await boxOf(trace), await boxOf(ansicht))).toBe(false);
        if (await caption.isVisible())
          expect(boxesOverlap(await boxOf(trace), await boxOf(caption))).toBe(false);
      }

      const template = page.getByTestId('action-templates');
      await expect(template).toBeVisible();
      const templateClipped = await template.evaluate(
        (element) => element.scrollWidth > element.clientWidth + 2
      );
      expect(templateClipped).toBe(false);
      expect(boxesOverlap(await boxOf(template), await boxOf(page.getByTestId('save-indicator')))).toBe(
        false
      );
      const autowire = page.getByTestId('action-autowire');
      if ((await autowire.count()) > 0 && (await autowire.isVisible())) {
        expect(boxesOverlap(await boxOf(autowire), await boxOf(page.getByTestId('action-more')))).toBe(false);
      }

      await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
      const overflowLabel = page
        .getByRole('menuitem', { name: /Auto-verbinden/ })
        .locator('span')
        .first();
      await expect(overflowLabel).toBeVisible();
      const labelLines = await overflowLabel.evaluate((element) => {
        const line = parseFloat(getComputedStyle(element).lineHeight);
        const linePx = Number.isFinite(line) ? line : 18;
        return element.getBoundingClientRect().height / linePx;
      });
      expect(labelLines).toBeLessThanOrEqual(2.2);
      await page.keyboard.press('Escape');

      await openMenubar(page, 'ansicht');
      await page.getByRole('menuitem', { name: /Expertenmodus/ }).click();
      const autoBtn = page.getByTestId('action-autowire');
      await expect(autoBtn).toBeVisible();
      expect(boxesOverlap(await boxOf(autoBtn), await boxOf(page.getByTestId('action-more')))).toBe(false);

      await openMenubar(page, 'hilfe');
      const hilfe = page.getByRole('menuitem', { name: /Hilfe & Fachwissen/ });
      await expect(hilfe).toBeVisible();
      const hilfeBox = await boxOf(hilfe);
      expect(hilfeBox.y).toBeGreaterThanOrEqual(0);
      expect(insideViewport(hilfeBox, viewport)).toBe(true);
      await hilfe.click();

      const expert = page.getByTestId('expert-panel-open');
      await expect(expert).toBeVisible();
      const expertBody = page.getByTestId('expert-sheet-body');
      expect(await expertBody.evaluate((element) => element.clientHeight)).toBeGreaterThan(minBody);
      await assertClearOfChrome(page, expert);
      const headerHit = await expert.locator('h3').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return element.contains(top);
      });
      expect(headerHit).toBe(true);
      await page.getByTestId('expert-panel-close').click();

      const seal = page.getByTestId('verification-seal-toggle');
      if (await seal.isVisible()) await seal.click();
      else {
        await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
        await page.getByRole('menuitem', { name: /Prüfbericht/ }).click();
      }
      const report = page.getByTestId('verification-seal-panel');
      await expect(report).toBeVisible();
      const reportBody = page.getByTestId('verification-sheet-body');
      expect(await reportBody.evaluate((element) => element.clientHeight)).toBeGreaterThan(minBody);
      await assertClearOfChrome(page, report);
      const reportHeader = report.locator('.planner-sheet-header');
      const reportHeaderHit = await reportHeader.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + 12, rect.top + rect.height / 2);
        return element.contains(top);
      });
      expect(reportHeaderHit).toBe(true);
    });

    test('Menü-Abschnitte bleiben im Blatt und die Seite rutscht nicht seitlich', async ({ page }) => {
      test.skip(viewport.width >= 768 && viewport.height > 500, 'nur der kompakte Kopf');
      await openFreshExample(page);
      const metrics = () =>
        page.evaluate(() => ({
          x: document.documentElement.scrollLeft,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }));
      expect((await metrics()).overflow).toBeLessThanOrEqual(1);

      await page.getByTestId('phone-menu').click();
      const sheet = page.getByTestId('phone-menu-sheet');
      await expect(sheet).toBeVisible();
      await page.getByTestId('menubar-planung').click();
      const menu = page.getByRole('menu', { name: 'Planung' });
      await expect(menu).toBeVisible();
      const sheetBox = await boxOf(sheet);
      const item = page.getByRole('menuitem', { name: /Prüfbericht öffnen/ });
      await expect(item).toBeVisible();
      const itemBox = await boxOf(item);
      expect(itemBox.x).toBeGreaterThanOrEqual(sheetBox.x - 1);
      expect(itemBox.y).toBeGreaterThanOrEqual(sheetBox.y - 1);
      expect(itemBox.x + itemBox.width).toBeLessThanOrEqual(sheetBox.x + sheetBox.width + 1);
      expect(itemBox.y + itemBox.height).toBeLessThanOrEqual(sheetBox.y + sheetBox.height + 1);
      expect(boxesOverlap(await boxOf(page.getByTestId('menubar-planung')), itemBox)).toBe(false);
      const opaque = await menu.evaluate((element) => {
        const bg = getComputedStyle(element).backgroundColor;
        const match = bg.match(/rgba?\(([^)]+)\)/);
        const body = match?.[1];
        if (!body) return bg !== 'transparent';
        const parts = body.split(',').map((part) => part.trim());
        const alpha = parts.length === 4 ? Number(parts[3]) : 1;
        return alpha > 0.9;
      });
      expect(opaque).toBe(true);

      const shift = await metrics();
      expect(shift.x).toBeLessThanOrEqual(1);
      expect(shift.overflow).toBeLessThanOrEqual(1);
      expect((await boxOf(page.getByTestId('phone-menu'))).x).toBeGreaterThanOrEqual(-1);

      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(sheet).toBeHidden();
    });

    test('Übersicht blendet im Querformat die Miniaturkarte ein', async ({ page }) => {
      test.skip(!(viewport.width >= 768 && viewport.height <= 500), 'kurzes Querformat');
      await openFreshExample(page);
      const minimap = page.locator('.react-flow__minimap');
      await expect(minimap).toBeHidden();
      await page.getByTestId('mobile-overview').click();
      await expect(minimap).toBeVisible();
      expect(insideViewport(await boxOf(minimap), viewport)).toBe(true);
    });
  });
}

async function assertClearOfChrome(page: Page, panel: Locator): Promise<void> {
  const panelBox = await boxOf(panel);
  for (const id of ['mobile-overview', 'mobile-undo', 'canvas-display-options']) {
    const control = page.getByTestId(id);
    if (!(await control.isVisible())) continue;
    expect(boxesOverlap(panelBox, await boxOf(control))).toBe(false);
  }
}

test.describe('Assistent im kurzen Fenster', () => {
  test.use({ viewport: { width: 852, height: 393 } });
  test.beforeEach(({ browserName: _browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-375', 'einmal, im Projekt mobile-375');
  });

  test('Weiter liegt im Bild', async ({ page }) => {
    await page.goto('/planer/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    const weiter = page
      .getByTestId('onboarding-actions')
      .getByRole('button', { name: 'Weiter', exact: true });
    await expect(weiter).toBeVisible({ timeout: 15_000 });
    const box = await boxOf(weiter);
    expect(insideViewport(box, { width: 852, height: 393 })).toBe(true);
  });
});

test.describe('Bauteil aus der Bibliothek im Querformat', () => {
  test.use({ viewport: { width: 852, height: 393 } });
  test.beforeEach(({ browserName: _browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-375', 'einmal, im Projekt mobile-375');
  });

  test('das neue Bauteil wird angezeigt und angesagt', async ({ page }) => {
    await openFreshExample(page);
    await page.getByTestId('nav-tab-sidebar').click();
    const tile = page.getByTestId('sidebar-item').first();
    await expect(tile).toBeVisible();
    const label = (await tile.getAttribute('data-component-label')) ?? '';
    const before = await page.locator('.react-flow__node').count();
    await tile.click();
    const toast = page.locator('.planner-mobile-feedback');
    await expect(toast).toContainText('hinzugefügt', { timeout: 8_000 });
    const toastBox = await boxOf(toast.locator('span').last());
    expect(insideViewport(toastBox, { width: 852, height: 393 })).toBe(true);
    await expect(page.locator('.react-flow__node')).toHaveCount(before + 1);
    const added = page.locator('.react-flow__node', { hasText: label }).last();
    await expect(added).toBeVisible();
    const addedBox = await boxOf(added);
    expect(addedBox.y + addedBox.height).toBeGreaterThan(0);
    expect(addedBox.y).toBeLessThan(393);
    expect(addedBox.x + addedBox.width).toBeGreaterThan(0);
    expect(addedBox.x).toBeLessThan(852);
    const ansicht = page.getByTestId('canvas-display-options');
    if (await ansicht.isVisible()) {
      expect(boxesOverlap(addedBox, await boxOf(ansicht))).toBe(false);
    }
  });
});

test.describe('Hilfe-Menü bei knapp 910 px', () => {
  test.use({ viewport: { width: 910, height: 700 } });
  test.beforeEach(({ browserName: _browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-375', 'einmal, im Projekt mobile-375');
  });

  test('Hilfe & Fachwissen beginnt unter der Titelleiste', async ({ page }) => {
    await openFreshExample(page);
    await page.getByTestId('menubar-hilfe').click();
    const item = page.getByRole('menuitem', { name: /Hilfe & Fachwissen/ });
    await expect(item).toBeVisible();
    const box = await boxOf(item);
    expect(box.y).toBeGreaterThanOrEqual(32);
    expect(insideViewport(box, { width: 910, height: 700 })).toBe(true);
  });
});

test.describe('Hilfe-Menü bei 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeEach(({ browserName: _browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'einmal, im Projekt desktop-1440');
  });

  test('Hilfe & Fachwissen liegt unter der Werkzeugleiste', async ({ page }) => {
    await openFreshExample(page);
    const toolbar = page.getByTestId('planner-toolbar');
    await page.getByTestId('menubar-hilfe').click();
    const item = page.getByRole('menuitem', { name: /Hilfe & Fachwissen/ });
    await expect(item).toBeVisible();
    const itemBox = await boxOf(item);
    const toolbarBox = await boxOf(toolbar);
    expect(itemBox.y).toBeGreaterThanOrEqual(toolbarBox.y + toolbarBox.height - 1);
    expect(insideViewport(itemBox, { width: 1440, height: 900 })).toBe(true);
    const hit = await item.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const top = document.elementFromPoint(rect.left + 16, rect.top + Math.min(12, rect.height / 2));
      return element.contains(top);
    });
    expect(hit).toBe(true);
  });
});

test.describe('Auto-verbinden abbrechen', () => {
  test.use({ viewport: { width: 393, height: 852 } });
  test.beforeEach(({ browserName: _browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-375', 'einmal, im Projekt mobile-375');
  });

  test('der Dialog spricht Klartext und Abbrechen ändert die Befunde nicht', async ({ page }) => {
    await openFreshExample(page);
    const probe = page.getByRole('button', { name: /Planungsprüfung öffnen/ });
    await expect(probe).toBeVisible();
    const before = await probe.getAttribute('aria-label');
    await page.getByTestId('action-more').click();
    await page.getByTestId('action-autowire-menu').click();
    const dialog = page.getByRole('dialog', { name: /Vorschlag prüfen/ });
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    const text = await dialog.innerText();
    expect(text).not.toMatch(/AUTO-[A-Z0-9-]+|%20|auto-node:|ul248-classT|\bi2A\b/);
    await dialog.getByRole('button', { name: 'Vorschlag verwerfen' }).click();
    await expect(dialog).toBeHidden();
    await expect(probe).toHaveAttribute('aria-label', before ?? '');
  });
});
