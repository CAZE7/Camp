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
  // Das Onboarding mountet nach dem Planer-Shell; ohne Warten würde ein
  // sofortiger count()-Check es übersehen und der Starter-Plan bliebe stehen.
  await dialog
    .first()
    .waitFor({ state: 'visible', timeout: 5000 })
    .catch(() => undefined);
  if ((await dialog.count()) === 0) return;
  // Der Knopf, der das Onboarding schließt UND den Starter-Plan leert. Das
  // ✕ („Dialog schließen“) darf nicht gewählt werden: Es lässt den Starter
  // stehen. „Mit leerem Plan beginnen“ (QA B-06) ersetzt „Leeren Plan starten“.
  const close = dialog.getByRole('button', {
    name: /leerem Plan|Leeren Plan|los geht|überspringen/i,
  });
  if ((await close.count()) > 0) {
    await close.first().click();
    await expect(dialog).toBeHidden();
  }
}

/**
 * Öffnet den Bauteilkatalog.
 *
 * Seit der Handy-Hülle (Spezifikation §5.2, PR #610) gibt es keinen eigenen
 * Katalog-Reiter mehr: Die Ansicht **Bauteile** ist die Startansicht, und ihr
 * Knopf „Hinzufügen“ öffnet denselben Katalog als volle Ebene. Ab 768 px ist
 * der Katalog ohnehin eine Spalte und braucht keinen Klick.
 */
export async function showSidebar(page: Page): Promise<void> {
  const nav = page.getByTestId('nav-tab-bauteile');
  if (await nav.isVisible()) {
    await nav.click();
    const add = page.getByTestId('phone-add');
    if (await add.isVisible()) await add.click();
  }
  await expect(page.getByTestId('sidebar')).toBeVisible();
}

/** Wechselt auf die Ansicht **Schaltplan** (dort liegt die Zeichenfläche). */
export async function showCanvas(page: Page): Promise<void> {
  const tab = page.getByTestId('nav-tab-schaltplan');
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
 * Öffnet den gemeinsamen Prüf-Einstieg (früher: zwei getrennte Zahl-Plaketten
 * für Planungsprüfung und Kabeltrassen).
 *
 * Seit 2026-10-26 hängen die Kennungen `routing-status-*` am Berichtsteil
 * „Kabeltrassen“ INNERHALB dieses Berichts — ein Blick auf den zugeklappten
 * Chip zeigt sie nicht mehr. Wer den Routing-Zustand prüfen will, öffnet ihn
 * hierüber. Gibt `false` zurück, wenn der Einstieg gar nicht da ist (alles
 * sauber: dann gibt es auch keinen Routing-Befund zu sehen).
 */
export async function openCheckEntry(page: Page): Promise<boolean> {
  // Handy: Der Bericht ist eine eigene Ansicht, kein Blatt (Spec §6.3).
  const checkTab = page.getByTestId('nav-tab-pruefung');
  if (await checkTab.isVisible().catch(() => false)) {
    await checkTab.click();
    await expect(page.getByTestId('planner-phone-view')).toHaveAttribute('data-phone-view', 'pruefung');
    return true;
  }
  const chip = page.getByRole('button', { name: /Planungsprüfung öffnen/ });
  if ((await chip.count()) === 0 || !(await chip.isVisible())) return false;
  await chip.click();
  await expect(page.getByRole('dialog', { name: 'Planungsprüfung' })).toBeVisible();
  return true;
}

/**
 * Startet Auto-Wire über den Werkzeugleisten-Knopf und wartet auf die
 * entstandenen Kanten. Der Ausweg über das Mehr-Menü bleibt als Rückfallebene.
 *
 * 2026-11-06: Der Knopf war im geführten Modus per `.cad-autowire-phone` über
 * 480 px per CSS unsichtbar; die Schrittleiste war der einzige Zugang. Die
 * Leiste ist entfallen und der Knopf steht jetzt in jeder Breite direkt in der
 * Leiste. Die Sichtbarkeitsprüfung bleibt, weil sie robust gegen künftige
 * Umbauten ist — `count()` allein würde auf ein verstecktes Element klicken.
 */
export async function autoWire(page: Page): Promise<void> {
  await showCanvas(page);
  const toolbarButton = page.getByTestId('action-autowire').first();
  if ((await toolbarButton.count()) > 0 && (await toolbarButton.isVisible())) {
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

/**
 * Öffnet ein Hauptmenü. Unter 768 px liegt es im Blatt hinter „Menü“,
 * darüber direkt in der Menüleiste.
 */
/**
 * Macht die Aktionen erreichbar.
 *
 * Am Desktop ist das die Menüleiste; auf dem Handy gibt es sie nicht mehr —
 * dort ist die Ansicht **Mehr** die einzige Stelle für Plan-Aktionen
 * (Spezifikation §6.4). Der Helper stellt in beiden Fällen nur sicher, dass
 * die Ziele im DOM und sichtbar sind.
 */
export async function revealMainMenus(page: Page): Promise<void> {
  const moreView = page.getByTestId('nav-tab-mehr');
  if (await moreView.isVisible().catch(() => false)) {
    await moreView.click();
    await expect(page.getByTestId('planner-phone-view')).toHaveAttribute('data-phone-view', 'mehr');
  }
}

export async function openMenubar(page: Page, menu: string): Promise<void> {
  const trigger = page.getByTestId(`menubar-${menu}`);
  if (!(await trigger.isVisible().catch(() => false))) {
    // Handy: „Mehr“ enthält dieselben Einträge. Die Menügruppe wird nicht
    // nachgebaut — der Aufrufer klickt danach die Kennung (z. B. `action-bom`).
    await revealMainMenus(page);
    return;
  }
  await expect(trigger).toBeVisible();
  await trigger.click();
}

/**
 * Öffnet einen Eintrag aus dem „Mehr“-Menü der Kopfzeile.
 *
 * Am Desktop ist das der `⋯`-Überlauf; auf dem Handy gibt es ihn nicht mehr —
 * die Ansicht **Mehr** enthält dieselben Aktionen mit denselben Kennungen
 * (Spezifikation §6.4). Der Helper führt beide Wege.
 */
export async function openMoreMenuItem(page: Page, testId: string): Promise<void> {
  const moreView = page.getByTestId('nav-tab-mehr');
  if (await moreView.isVisible().catch(() => false)) {
    await moreView.click();
    const item = page.getByTestId(testId);
    await expect(item).toBeVisible();
    await item.click();
    return;
  }
  await showCanvas(page);
  await page.getByTestId('action-more').click();
  const item = page.getByTestId(testId);
  await expect(item).toBeVisible();
  await item.click();
}

/**
 * Ist der Planer gerade in der Handy-Hülle? (Grenze `(max-width: 767px),
 * (max-height: 500px)` — dieselbe Abfrage wie in der Anwendung.)
 */
export async function isPhoneShell(page: Page): Promise<boolean> {
  return page
    .getByTestId('planner-phone-header')
    .isVisible()
    .catch(() => false);
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
