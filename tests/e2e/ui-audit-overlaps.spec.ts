import { expect, test, type Locator, type Page } from '@playwright/test';
import { openMenubar } from './helpers';

/**
 * Regressionen zum UI-Audit 2026-10-24.
 *
 * Gemessen wurde der gebaute Static Export mit einem echten Klickpfad:
 * Vorlagenmenü, Hauptmenüs, Planbereichswechsel, Einstiegsmeldung und
 * Aktionsmeldung. Jeder Test hält eine der damals gefundenen Überlagerungen
 * bzw. Abschneidungen fest.
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

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
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

async function clearPlan(page: Page): Promise<void> {
  await openMenubar(page, 'datei');
  await page.getByRole('menuitem', { name: /Neuen leeren Plan starten/ }).click();
  await page.getByRole('button', { name: 'Plan leeren' }).click();
}

test.describe('UI-Audit: Überlagerungen und abgeschnittener Text', () => {
  test('Vorlagenmenü liegt frei im Bild und lädt eine Vorlage', async ({ page }) => {
    await openFreshExample(page);
    await page.getByTestId('action-templates').click();

    const menu = page.getByRole('menu', { name: 'Vorlage laden' });
    await expect(menu).toBeVisible();
    // Das Menü hängt am Body: In der Werkzeugleiste würde es abgeschnitten.
    expect(await menu.evaluate((element) => element.parentElement === document.body)).toBe(true);
    const viewport = page.viewportSize()!;
    expect(insideViewport(await boxOf(menu), viewport)).toBe(true);

    const item = page.getByTestId('toolbar-template-kastenwagen');
    await expect(item).toBeVisible();
    const itemBox = await boxOf(item);
    expect(insideViewport(itemBox, viewport)).toBe(true);
    expect(await item.evaluate((element) => element.scrollWidth <= element.clientWidth + 2)).toBe(true);
    const hit = await item.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return element.contains(top);
    });
    expect(hit).toBe(true);

    await item.click();
    await expect(menu).toBeHidden();
    await expect(page.getByTestId('action-feedback')).toContainText(/Vorlage .* geladen/);
  });

  test('Hauptmenüs bleiben im Bild und ihre Einträge im Rahmen', async ({ page }) => {
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width < 768, 'Am Handy liegt das Menü als Blatt, siehe nächster Test.');
    await openFreshExample(page);

    const viewport = page.viewportSize()!;
    for (const id of ['datei', 'bearbeiten', 'ansicht', 'werkzeuge', 'planung', 'hilfe'] as const) {
      await page.getByTestId(`menubar-${id}`).click();
      const menu = page.locator('.planner-menubar-sheet').first();
      await expect(menu).toBeVisible();
      expect(insideViewport(await boxOf(menu), viewport), id).toBe(true);
      const items = menu.getByRole('menuitem');
      const count = await items.count();
      for (let index = 0; index < count; index += 1) {
        const entry = items.nth(index);
        const clipped = await entry.evaluate((element) => element.scrollWidth > element.clientWidth + 2);
        expect(clipped, `${id} Eintrag ${index}`).toBe(false);
      }
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
    }
  });

  test('Handy-Menü stapelt Hinweise unter das Label, statt es zu überdecken', async ({ page }) => {
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width >= 768, 'Gilt nur für das Menü-Blatt unter 768 px.');
    await openFreshExample(page);

    await page.getByTestId('phone-menu').click();
    const sheet = page.getByTestId('phone-menu-sheet');
    await expect(sheet).toBeVisible();
    await page.getByTestId('menubar-werkzeuge').click();

    const item = page.getByTestId('action-autowire-menu');
    await expect(item).toBeVisible();
    const label = item.locator('span').first();
    const hint = item.locator('.cad-menu__hint');
    await expect(hint).toBeVisible();
    const itemBox = await boxOf(item);
    const labelBox = await boxOf(label);
    const hintBox = await boxOf(hint);
    // Der Hinweis steht in der nächsten Zeile und bleibt im Eintrag.
    expect(hintBox.y).toBeGreaterThanOrEqual(labelBox.y + labelBox.height - 1);
    expect(hintBox.x).toBeGreaterThanOrEqual(itemBox.x - 1);
    expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(itemBox.x + itemBox.width + 1);

    // Die Undo-Leiste darf nicht unter dem offenen Blatt hervorschauen.
    const history = page.locator('.planner-mobile-history');
    if ((await history.count()) > 0) await expect(history).toBeHidden();
  });

  test('Tablet: Wasser-Tab liegt neben dem Speicherzustand, Modus und Ansicht überlappen nicht', async ({
    page,
  }) => {
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width !== 768, 'Gemessene Fundstelle bei 768 px.');
    await openFreshExample(page);

    const water = page.getByTestId('viewmode-water');
    await expect(water).toBeVisible();
    const waterBox = await boxOf(water);
    const saveBox = await boxOf(page.getByTestId('save-indicator'));
    expect(overlaps(waterBox, saveBox)).toBe(false);
    const reachable = await water.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return element.contains(top);
    });
    expect(reachable).toBe(true);

    await water.click();
    await expect(page.getByTestId('sidebar')).toHaveAttribute('aria-label', 'Wasser-Komponenten');

    const mode = page.getByTestId('planner-mode-planung').locator('xpath=..');
    const display = page.getByTestId('canvas-display-options');
    if (await display.isVisible()) {
      expect(overlaps(await boxOf(mode), await boxOf(display))).toBe(false);
    }
  });

  test('Einstiegsmeldung verschwindet mit dem Plan und deckt den leeren Zustand nicht', async ({ page }) => {
    await openFreshExample(page);
    const notice = page.locator('.planner-entry-notice');
    await expect(notice).toBeVisible();

    // Auf Tablet/Desktop sitzt die HUD-Karte direkt unter der Meldung.
    const hud = page.locator('.de-hud-card');
    if (await hud.isVisible()) {
      expect(overlaps(await boxOf(notice), await boxOf(hud))).toBe(false);
    }

    await clearPlan(page);

    await expect(notice).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Fang mit deiner Batterie an' })).toBeVisible();
    await expect(page.locator('.react-flow__node')).toHaveCount(0);
  });

  test('Aktionsmeldung erscheint unten und deckt Werkzeugleiste und Modus nicht ab', async ({ page }) => {
    await openFreshExample(page);
    await clearPlan(page);

    const toast = page.getByTestId('action-feedback');
    await expect(toast).toBeVisible();
    const viewport = page.viewportSize()!;
    const toastBox = await boxOf(toast);
    expect(insideViewport(toastBox, viewport)).toBe(true);
    expect(toastBox.y).toBeGreaterThan(viewport.height / 2);

    for (const id of ['planner-toolbar', 'planner-mode-planung', 'canvas-display-options']) {
      const control = page.getByTestId(id);
      if ((await control.count()) === 0 || !(await control.isVisible())) continue;
      expect(overlaps(toastBox, await boxOf(control)), id).toBe(false);
    }
  });
});
