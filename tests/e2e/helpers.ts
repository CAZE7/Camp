import { expect, type Locator, type Page } from '@playwright/test';

/**
 * tests/e2e/helpers.ts
 *
 * Gemeinsame Bausteine der E2E-Tests. Zwei Regeln aus AGENTS.md K5 werden
 * hier eingehalten und nicht in jedem Test wiederholt:
 *
 *   - Keine festen Wartezeiten. Gewartet wird ausschließlich auf Zustände
 *     (Locator-Assertions, expect.poll auf echte Anwendungszustände).
 *   - Stabile Selektoren: `data-testid` oder Rollen/Beschriftungen, niemals
 *     CSS-Klassen aus dem Styling. Ausnahme sind die von React Flow selbst
 *     vergebenen, dokumentierten Klassen (`.react-flow__node-*`), die Teil
 *     seiner öffentlichen API sind.
 */

/**
 * Adresse der Zeichenanwendung.
 *
 * Der Planer liegt auf einer eigenen Route und füllt dort das ganze
 * Browserfenster; `/elektrik-planung/` ist die Wissens- und Rechnerseite, die
 * dorthin verweist. Alle Szenarien, die die Anwendung bedienen, starten hier.
 */
export const PLANNER_URL = '/planer/';

/** Öffnet den Planer und wartet, bis der Canvas montiert ist. */
export async function openPlanner(page: Page): Promise<void> {
  await page.goto(PLANNER_URL);
  // The planner is dynamically imported. Waiting for its shell first prevents
  // a race where the onboarding dialog mounts just after a zero-count check.
  await expect(page.getByTestId('planner-shell')).toBeVisible({ timeout: 30000 });
  await dismissOnboarding(page);
}

/**
 * Das Onboarding erscheint beim ersten Besuch und liegt über allem.
 * Es wird geschlossen, wenn es da ist — ohne Timeout-Warterei.
 */
export async function dismissOnboarding(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog');
  if ((await dialog.count()) === 0) return;
  const close = dialog.getByRole('button', { name: /schließen|los geht|starten|überspringen/i });
  if ((await close.count()) > 0) {
    await close.first().click();
    await expect(dialog).toBeHidden();
  }
}

/** Auf dem Handy liegt die Sidebar hinter einem eigenen Tab. */
export async function showSidebar(page: Page): Promise<void> {
  const tab = page.getByTestId('nav-tab-sidebar');
  if (await tab.isVisible()) {
    await tab.click();
  }
  await expect(page.getByTestId('sidebar')).toBeVisible();
}

export async function showCanvas(page: Page): Promise<void> {
  const tab = page.getByTestId('nav-tab-electric');
  if (await tab.isVisible()) {
    await tab.click();
  }
  await expect(page.getByTestId('planner-canvas-column')).toBeVisible();
}

/** Kachel eines Bauteiltyps in der Sidebar. */
export function sidebarItem(page: Page, componentType: string): Locator {
  return page
    .locator(`[data-testid="sidebar-item"][data-component-type="${componentType}"][data-accent="default"]`)
    .first();
}

/**
 * Klappt alle Kategorien der Sidebar auf.
 *
 * Standardmäßig ist nur eine Kategorie offen ("Strom speichern"). Ohne diesen
 * Schritt wäre z. B. die Kachel „Sicherungskasten“ gar nicht im DOM — der Test
 * würde an der UI scheitern statt an der Sache.
 */
export async function expandAllCategories(page: Page): Promise<void> {
  const sidebar = page.getByTestId('sidebar');
  const headers = sidebar.locator('button[aria-expanded]');
  const count = await headers.count();
  for (let index = 0; index < count; index++) {
    const header = headers.nth(index);
    if ((await header.getAttribute('aria-expanded')) === 'false') {
      await header.click();
      await expect(header).toHaveAttribute('aria-expanded', 'true');
    }
  }
}

/**
 * Fügt ein Bauteil hinzu.
 *
 * Der Planer kennt zwei Wege (siehe components/Sidebar.tsx):
 *   - unter 1024 px Fensterbreite: Antippen fügt in der Mitte ein,
 *   - ab 1024 px: Ziehen mit der Maus ODER Enter/Leertaste auf der Kachel.
 *
 * Getestet wird bewusst der Tastaturweg — er ist derselbe Codepfad wie der
 * Klick auf dem Handy und ist ohne Zeitannahmen automatisierbar.
 */
export async function addComponent(page: Page, componentType: string): Promise<void> {
  await showSidebar(page);
  await expandAllCategories(page);
  const before = await nodeCount(page);
  const wide = await page.evaluate(() => window.innerWidth >= 1024);
  const tile = sidebarItem(page, componentType);

  await expect(tile).toBeVisible();

  if (wide) {
    await tile.focus();
    await tile.press('Enter');
  } else {
    await tile.click();
  }

  await showCanvas(page);
  await expect
    .poll(async () => nodeCount(page), { message: `${componentType} wurde nicht hinzugefügt` })
    .toBe(before + 1);
}

/** Anzahl der Knoten im Plan — aus dem DOM, nicht aus dem Store. */
export async function nodeCount(page: Page): Promise<number> {
  return page.locator('.react-flow__node:not(.react-flow__node-backboneGroup)').count();
}

/** Anzahl der Kanten im Plan. */
export async function edgeCount(page: Page): Promise<number> {
  return page.locator('.react-flow__edge').count();
}

/**
 * Startet Auto-Wire über den sichtbaren Expertenknopf oder — im geführten
 * Modus — über das Mehr-Menü, und wartet auf die entstandenen Kanten.
 */
export async function autoWire(page: Page): Promise<void> {
  await showCanvas(page);
  const toolbarButton = page.getByTestId('action-autowire');
  if ((await toolbarButton.count()) > 0) {
    await expect(toolbarButton).toBeEnabled();
    await toolbarButton.click();
  } else {
    await openMoreMenuItem(page, 'action-autowire-menu');
  }
  // Nachtest Bug 20: Auto-verbinden zeigt zuerst eine Vorschau und wendet
  // erst nach Bestätigung an. Der Helper bestätigt sie — ohne diesen
  // Schritt wartete er vergeblich auf Kanten (Altlast seit Einführung der
  // Vorschau, alle autoWire-Specs waren rot).
  const preview = page.getByRole('dialog', { name: /Automatisch verbinden/ });
  await expect(preview).toBeVisible();
  await page.getByRole('button', { name: 'Vorschlag auf den Plan anwenden' }).click();
  await expect(preview).toBeHidden();
  await expect
    .poll(async () => edgeCount(page), { message: 'Auto-Wire erzeugte keine Kanten' })
    .toBeGreaterThan(0);
}

/** Öffnet einen Eintrag aus dem „Mehr“-Menü der Kopfzeile. */
export async function openMoreMenuItem(page: Page, testId: string): Promise<void> {
  await showCanvas(page);
  await page.getByTestId('action-more').click();
  const item = page.getByTestId(testId);
  await expect(item).toBeVisible();
  await item.click();
}

/** Prüft, dass die Seite nicht horizontal scrollt. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const element = document.documentElement;
    return {
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
    };
  });
  // 1 px Toleranz für subpixel-gerundete Layouts.
  expect(overflow.scrollWidth, 'html scrollt horizontal').toBeLessThanOrEqual(overflow.clientWidth + 1);
  expect(overflow.bodyScrollWidth, 'body scrollt horizontal').toBeLessThanOrEqual(overflow.clientWidth + 1);
}
