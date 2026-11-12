import { expect, test, type Locator, type Page } from '@playwright/test';
import { isPhoneShell, openMenubar, openMoreMenuItem } from './helpers';

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

/**
 * Die Vorlage ersetzt den aktuellen Plan — vorher fragt der Planer nach
 * („Bitte bestätigen“). Den Dialog gibt es auf beiden Wegen, am Desktop wie in
 * der Handy-Hülle; ohne Antwort bliebe die Vorlage ungeladen und die
 * Erfolgsmeldung aus (im Lauf gemessen: Dialog blieb offen).
 */
async function confirmReplace(page: Page): Promise<void> {
  const confirm = page.getByRole('button', { name: 'Fortfahren' });
  if ((await confirm.count()) === 0) return;
  await confirm.click();
  await expect(page.getByRole('dialog')).toBeHidden();
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
  // Handy: Die Aktion ist eine Zeile in „Mehr“ (Spec §6.4), am Desktop ein
  // Menüeintrag. Die Bestätigung bleibt in beiden Fällen derselbe Dialog.
  if (await isPhoneShell(page)) {
    await page.getByTestId('nav-tab-mehr').click();
    await page.getByTestId('action-reset').click();
    await page.getByRole('button', { name: 'Plan leeren' }).click();
    return;
  }
  await openMenubar(page, 'datei');
  await page.getByRole('menuitem', { name: /Neuen leeren Plan starten/ }).click();
  await page.getByRole('button', { name: 'Plan leeren' }).click();
}

test.describe('UI-Audit: Überlagerungen und abgeschnittener Text', () => {
  test('Vorlagenmenü liegt frei im Bild und lädt eine Vorlage', async ({ page }) => {
    await openFreshExample(page);
    if (await isPhoneShell(page)) {
      // Handy: Die Vorlagen stehen als Liste in „Mehr“ (Spec §6.4) — kein
      // Menü, das über den Plan klappt.
      await page.getByTestId('nav-tab-mehr').click();
      const template = page.getByTestId('action-template-kastenwagen');
      await expect(template).toBeVisible();
      const viewport = page.viewportSize()!;
      expect(insideViewport(await boxOf(template), viewport)).toBe(true);
      expect(await template.evaluate((element) => element.scrollWidth <= element.clientWidth + 2)).toBe(true);
      await template.click();
      await confirmReplace(page);
      await expect(page.getByTestId('action-feedback')).toContainText(/Vorlage .* geladen/);
      return;
    }
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
    await confirmReplace(page);
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

  test('Handy: Hinweise stehen unter dem Label, statt es zu überdecken', async ({ page }) => {
    test.skip(!(await isPhoneShell(page)), 'Gilt nur für die Handy-Hülle.');
    await openFreshExample(page);

    await page.getByTestId('nav-tab-mehr').click();
    await expect(page.getByTestId('planner-phone-view')).toHaveAttribute('data-phone-view', 'mehr');

    const item = page.getByTestId('action-autowire');
    await expect(item).toBeVisible();
    const label = item.locator('span > span').first();
    const hint = label.locator('xpath=following-sibling::span').first();
    await expect(label).toHaveText('Automatisch verbinden');
    await expect(hint).toBeVisible();
    const itemBox = await boxOf(item);
    const labelBox = await boxOf(label);
    const hintBox = await boxOf(hint);
    // Der Hinweis steht in der nächsten Zeile und bleibt im Eintrag.
    expect(hintBox.y).toBeGreaterThanOrEqual(labelBox.y + labelBox.height - 1);
    expect(hintBox.x).toBeGreaterThanOrEqual(itemBox.x - 1);
    expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(itemBox.x + itemBox.width + 1);

    // Die Undo-Leiste der alten Hülle gibt es nicht mehr.
    await expect(page.locator('.planner-mobile-history')).toHaveCount(0);
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

  test('Einstiegsmeldung steht im Meldungsplatz und deckt den leeren Zustand nicht', async ({ page }) => {
    await openFreshExample(page);
    // Spezifikation §5.3: EINE Meldung im Fluss. Die frühere absolute Karte
    // (`.planner-entry-notice`) ist ersatzlos ersetzt — auf allen Breiten.
    await expect(page.locator('.planner-entry-notice')).toHaveCount(0);
    const slot = page.getByTestId('planner-message-slot');
    await expect(slot).toBeVisible();
    await expect(slot).toHaveAttribute('data-empty', 'false');

    // Die HUD-Karte sitzt darunter, nicht darin.
    const hud = page.locator('.de-hud-card');
    if (await hud.isVisible()) {
      expect(overlaps(await boxOf(slot), await boxOf(hud))).toBe(false);
    }

    await clearPlan(page);

    await expect(slot).toHaveAttribute('data-empty', 'false');
    await expect(page.getByTestId('action-feedback')).toContainText(/Leerer Plan gestartet/);
    // Handy: Der leere Zustand liegt in der Ansicht „Schaltplan“.
    if (await isPhoneShell(page)) await page.getByTestId('nav-tab-schaltplan').click();
    await expect(page.getByRole('heading', { name: 'Fang mit deiner Batterie an' })).toBeVisible();
    await expect(page.locator('.react-flow__node')).toHaveCount(0);
  });

  test('Aktionsmeldung liegt im Fluss und deckt Werkzeugleiste und Modus nicht ab', async ({ page }) => {
    await openFreshExample(page);
    await clearPlan(page);

    const toast = page.getByTestId('action-feedback');
    await expect(toast).toBeVisible();
    const viewport = page.viewportSize()!;
    const toastBox = await boxOf(toast);
    expect(insideViewport(toastBox, viewport)).toBe(true);
    // Der Platz schiebt den Inhalt nach oben, statt ihn zu überdecken
    // (Spec §5.3). Wo er sitzt, hängt von der Ansicht ab: Am Desktop oben unter
    // der Menüleiste, in der Handy-Hülle zwischen Ansicht und Fußleiste („Der
    // Meldungsplatz steht dann im Fluss darunter“). Beides ist ein Platz im
    // Fluss — gemessen wird deshalb, dass er die Fläche nicht überlagert.
    if (await isPhoneShell(page)) {
      const surface = page.getByTestId('planner-canvas-surface');
      if ((await surface.count()) > 0) {
        expect(overlaps(toastBox, await boxOf(surface)), 'fläche').toBe(false);
      }
      expect(toastBox.y).toBeGreaterThan(0);
    } else {
      expect(toastBox.y).toBeLessThan(viewport.height / 2);
    }

    for (const id of [
      'planner-toolbar',
      'planner-mode-planung',
      'canvas-display-options',
      'phone-canvas-toolbar',
      'planner-bottom-nav',
    ]) {
      const control = page.getByTestId(id);
      if ((await control.count()) === 0 || !(await control.isVisible())) continue;
      expect(overlaps(toastBox, await boxOf(control)), id).toBe(false);
    }
  });

  test('Aktionsmeldung weicht einem geöffneten Dialog', async ({ page }) => {
    await openFreshExample(page);
    await clearPlan(page);
    const toast = page.getByTestId('action-feedback');
    await expect(toast).toBeVisible();

    await openMoreMenuItem(page, 'action-bom');
    const dialog = page.getByRole('dialog', { name: 'Stückliste' });
    await expect(dialog).toBeVisible();
    // Der Dialog ist die aktive Ebene; die Meldung darf ihn nicht verdecken.
    await expect(toast).toBeHidden();

    await dialog.getByRole('button', { name: 'Dialog schließen' }).click();
    await expect(dialog).toBeHidden();
  });
});
