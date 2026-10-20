import { expect, test, type Page } from '@playwright/test';

/**
 * Nachtest auf einem frischen Beispielplan (Seitendaten leer).
 * Der Assistent wird mit ✕ geschlossen — „Mit leerem Plan beginnen“ würde
 * den Plan verwerfen, den diese Prüfung gerade braucht.
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

test.describe('Frischstart: Beispielplan', () => {
  test.beforeEach(async ({ page }) => {
    await openFreshExample(page);
  });

  test('Kennungen sind eindeutig und der Prüfbericht fällt nicht durch', async ({ page }) => {
    const designators = await page
      .locator('[data-designator]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-designator')));
    expect(designators.length).toBeGreaterThan(8);
    expect(new Set(designators).size).toBe(designators.length);
    expect(designators.filter((value) => value === 'G1')).toHaveLength(1);
    expect(designators.filter((value) => value === 'G2')).toHaveLength(1);
    expect(designators.filter((value) => value === 'W1')).toHaveLength(1);
    expect(designators.filter((value) => value === 'E1')).toHaveLength(1);
    expect(designators).toEqual(expect.arrayContaining(['G1.2', 'G2.2', 'W1.2', 'E1.2', 'E1.3']));

    const canvasText = await page
      .locator('.react-flow__node')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? '').join('\n'));
    expect(canvasText).not.toMatch(/Sicherung:\s*0(?!\d)/);
    expect(canvasText).toMatch(/Sicherung:\s*[1-9]\d*\s*A/);

    await page.getByRole('button', { name: /Planungsprüfung öffnen/ }).click();
    const warnings = page.getByRole('dialog', { name: 'Planungsprüfung' });
    await expect(warnings).toBeVisible();
    const warningText = await warnings.innerText();
    expect(warningText).not.toMatch(/I_[bnz2]|AMP-\d{3}|\(In\s*[≤≥]/);
    await warnings.getByRole('button', { name: 'Prüfhinweise schließen' }).click();

    await page.getByTestId('verification-seal-toggle').click();
    const panel = page.getByTestId('verification-seal-panel');
    await expect(panel).toBeVisible();
    await expect(panel).not.toContainText('Nicht bestanden');
    // Die Kennzahl „nicht erfüllt“ steht immer im Bericht. Durchgefallen ist
    // der Plan erst, wenn ihr Wert > 0 ist oder ein Durchgang so markiert ist.
    const failedStat = panel.locator('div.rounded', {
      has: page.getByText('nicht erfüllt', { exact: true }),
    });
    await expect(failedStat.locator('div').first()).toHaveText('0');
    await expect(panel.locator('li', { hasText: 'nicht erfüllt' })).toHaveCount(0);
    const limitations = await page.getByTestId('verification-limitations').innerText();
    expect(limitations).not.toMatch(/I_[bnz2]|AMP-\d{3}|In\s*[≤≥]/);
  });
});

test.describe('Frischstart: Handy-Hochformat', () => {
  test.use({ viewport: { width: 393, height: 852 } });

  test('Undo-Leiste überdeckt die Übersicht nicht', async ({ page }) => {
    await openFreshExample(page);
    await expect(page.getByTestId('mobile-overview')).toHaveCount(1);
    const overview = page.getByTestId('mobile-overview');
    const undo = page.getByTestId('mobile-undo');
    await expect(overview).toBeVisible();
    await expect(overview).toHaveAccessibleName(/Planübersicht/);
    await expect(overview).toContainText('Übersicht');

    const overviewBox = await overview.boundingBox();
    const undoBox = await undo.boundingBox();
    expect(overviewBox).not.toBeNull();
    expect(undoBox).not.toBeNull();
    expect(boxesOverlap(overviewBox!, undoBox!)).toBe(false);

    const clipped = await overview.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
    expect(clipped).toBe(false);
  });
});

test.describe('Frischstart: Klicks auf den Prüfbericht', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('der Schalter liegt nicht unter dem Eigenschaften-Blatt', async ({ page }) => {
    await openFreshExample(page);
    const toggle = page.getByTestId('verification-seal-toggle');
    await expect(toggle).toBeVisible();
    const hit = await toggle.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return element.contains(top);
    });
    expect(hit).toBe(true);
    await toggle.click();
    await expect(page.getByTestId('verification-seal-panel')).toBeVisible();
  });
});
