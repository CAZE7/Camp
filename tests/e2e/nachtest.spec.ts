import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  addComponent,
  edgeCount,
  expandAllCategories,
  nodeCount,
  openMenubar,
  openMoreMenuItem,
  openPlanner,
  revealMainMenus,
  PLANNER_URL,
  showCanvas,
  showSidebar,
  sidebarItem,
} from './helpers';

/**
 * Nachtest 16.10.2026 — Regressionsschutz für die Befunde des Berichts
 * (docs/qa/NACHTEST-2026-10-16.md).
 *
 * Desktop: Komma-Eingabe, Klick-Hinzufügen, Wizard-Schließen ohne
 * Planänderung, Wasser-Guard (N1), Kopfzahlen, Kürzel-Menü, Modi.
 *
 * Mobil (Handy-Audit §5): Bei 393×852 und 375×667, hoch und quer, muss
 * jedes geprüfte Bedienelement (a) im Viewport liegen, (b) mindestens
 * 44 px hoch sein und (c) an seiner Mitte auch wirklich das oberste
 * Element sein (nicht verdeckt).
 */

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator, label: string): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, `${label}: kein BoundingBox (nicht gerendert?)`).not.toBeNull();
  return box as Box;
}

async function expectWithinViewport(page: Page, locator: Locator, label: string): Promise<Box> {
  const box = await boxOf(locator, label);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const { width: vw, height: vh } = viewport as { width: number; height: number };
  expect(box.x, `${label}: linke Kante ${box.x} < 0`).toBeGreaterThanOrEqual(-1);
  expect(box.y, `${label}: obere Kante ${box.y} < 0`).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, `${label}: rechte Kante außerhalb (${vw})`).toBeLessThanOrEqual(vw + 1);
  expect(box.y + box.height, `${label}: untere Kante außerhalb (${vh})`).toBeLessThanOrEqual(vh + 1);
  return box;
}

async function expectTapTarget(locator: Locator, label: string): Promise<void> {
  const box = await boxOf(locator, label);
  expect(box.height, `${label}: Höhe ${box.height}px < 44px`).toBeGreaterThanOrEqual(43.5);
}

/** Die Mitte des Elements muss von ihm selbst (oder einem Kind) getroffen werden. */
async function expectNotCovered(locator: Locator, label: string): Promise<void> {
  const covered = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    if (!hit) return 'kein Element an der Mitte';
    if (element === hit || element.contains(hit)) return null;
    return `verdeckt von <${hit.tagName.toLowerCase()} class="${hit.getAttribute('class') ?? ''}">`;
  });
  expect(covered, `${label}: ${covered ?? ''}`).toBeNull();
}

async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, `${label}: horizontaler Overflow ${overflow}px`).toBeLessThanOrEqual(1);
}

const isDesktopProject = (name: string) => name.startsWith('desktop');
const isMobileProject = (name: string) => name.startsWith('mobile') || name.startsWith('touch');

test.describe('Nachtest Desktop', () => {
  test.beforeEach(({ browserName: _browserName }, testInfo) => {
    test.skip(!isDesktopProject(testInfo.project.name), 'nur Desktop-Projekt');
  });

  test('Bug 5: Klick auf eine Kachel fügt das Bauteil hinzu (ohne Ziehen)', async ({ page }) => {
    await openPlanner(page);
    await showSidebar(page);
    await expandAllCategories(page);
    const before = await nodeCount(page);
    const tile = sidebarItem(page, 'battery');
    await expect(tile).toBeVisible();
    // Echter Mausklick ohne Bewegung — vorher startete jeder pointerdown
    // einen Ghost-Drag und der Klick verpuffte.
    await tile.click();
    await showCanvas(page);
    await expect.poll(async () => nodeCount(page)).toBe(before + 1);
  });

  test('Bug 1: Komma-Dezimalzahl bleibt beim Tippen erhalten (12,5 statt 125)', async ({ page }) => {
    await openPlanner(page);
    await addComponent(page, 'consumer');
    // Bauteil auswählen → Inspektor mit Watt-Feld.
    await page.locator('.react-flow__node').first().click();
    const watts = page.locator('input[id$="-watts"]').first();
    await expect(watts).toBeVisible();
    await watts.click();
    await watts.press('Control+a');
    await watts.pressSequentially('12,5');
    // Während der Eingabe darf nichts umgeschrieben werden.
    await expect(watts).toHaveValue('12,5');
    await watts.blur();
    await expect(watts).toHaveValue('12,5');
    // Und der Wert ist als 12.5 angekommen, nicht als 125.
    await watts.click();
    await watts.press('Control+a');
    await watts.pressSequentially('7,25');
    await watts.blur();
    await expect(watts).toHaveValue('7,25');
  });

  test('Bug 6: Einführung lässt sich mit Esc schließen, ohne den Plan zu ändern', async ({ page }) => {
    await page.goto(PLANNER_URL);
    await expect(page.getByTestId('planner-shell')).toBeVisible({ timeout: 30000 });
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // Kein Bestätigungsdialog, kein geleerter Plan: Canvas ist bedienbar.
    await expect(page.getByTestId('planner-canvas-column')).toBeVisible();
  });

  test('N1+Bug 10: Auto-verbinden im Wasser-Tab lässt den Elektroplan unverändert; Kopf zählt Wasser', async ({
    page,
  }) => {
    await openPlanner(page);
    await addComponent(page, 'battery');
    await addComponent(page, 'consumer');
    const electricEdges = await edgeCount(page);

    // In den Wasser-Tab wechseln (Desktop: Umschalter in der Werkzeugleiste;
    // die untere Navigation gibt es nur mobil).
    await page.getByRole('tab', { name: 'Wasserplan anzeigen' }).click();
    // Kopfzeile zählt die aktive (leere) Wasseransicht, nicht die Elektrik.
    await expect(page.locator('.cad-menubar__status')).toContainText('0 Bauteile');

    const autoWire = page.getByTestId('action-autowire');
    if ((await autoWire.count()) > 0 && (await autoWire.isVisible())) {
      await autoWire.click();
      // Eine erklärende Rückmeldung statt einer stillen Elektro-Änderung.
      await expect(page.locator('body')).toContainText(/Wasser|Elektrik/);
    }

    await page.getByRole('tab', { name: 'Elektrikplan anzeigen' }).click();
    await expect.poll(async () => edgeCount(page)).toBe(electricEdges);
  });

  test('Bug 15: Hilfe → Tastaturkürzel öffnet die Übersicht', async ({ page }) => {
    await openPlanner(page);
    await openMenubar(page, 'hilfe');
    await page.getByTestId('action-shortcuts').click();
    const overlay = page.getByRole('dialog', { name: 'Tastaturkürzel' });
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('Rückgängig');
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
  });

  test('Bug 16: Modi Physisch/Prüfung unterscheiden sich sichtbar', async ({ page }) => {
    await openPlanner(page);
    await addComponent(page, 'battery');
    await page.getByTestId('planner-mode-physisch').click();
    const caption = page.getByTestId('planner-mode-caption');
    await expect(caption).toContainText('Physisch');
    await expect(page.locator('.de-canvas')).toHaveAttribute('data-planner-mode', 'physisch');
    await page.getByTestId('planner-mode-pruefung').click();
    await expect(caption).toContainText('Prüfung');
    await expect(page.locator('.de-canvas')).toHaveAttribute('data-planner-mode', 'pruefung');
    await page.getByTestId('planner-mode-planung').click();
    await expect(page.locator('.de-canvas')).toHaveAttribute('data-planner-mode', 'planung');
  });

  test('Bug 9/N6: Menüs sprechen Klartext (Speichern bestätigen, kein „Plan leeren“ in Hilfe)', async ({
    page,
  }) => {
    await openPlanner(page);
    await openMenubar(page, 'bearbeiten');
    await expect(page.getByRole('menuitem', { name: 'Speichern bestätigen' })).toBeVisible();
    await page.keyboard.press('Escape');
    await openMenubar(page, 'hilfe');
    await expect(page.getByRole('menuitem', { name: /Plan leeren/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await openMenubar(page, 'datei');
    await expect(page.getByRole('menuitem', { name: /Stückliste/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /BOM|ELK/ })).toHaveCount(0);
  });
});

const MOBILE_VIEWPORTS = [
  { label: 'iPhone 16 hoch', width: 393, height: 852 },
  { label: 'iPhone SE hoch', width: 375, height: 667 },
  { label: 'iPhone 16 quer', width: 852, height: 393 },
  { label: 'iPhone SE quer', width: 667, height: 375 },
] as const;

for (const viewport of MOBILE_VIEWPORTS) {
  test.describe(`Nachtest Mobil ${viewport.label} (${viewport.width}×${viewport.height})`, () => {
    test.beforeEach(async ({ page }, testInfo) => {
      test.skip(!isMobileProject(testInfo.project.name), 'nur Mobil-Projekte');
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
    });

    test('Grundgerüst: kein Overflow, Navigation erreichbar und ≥44px', async ({ page }) => {
      await openPlanner(page);
      await expectNoHorizontalOverflow(page, 'Planer');

      for (const testId of ['nav-tab-sidebar', 'nav-tab-electric', 'nav-tab-water', 'nav-tab-inspector']) {
        const tab = page.getByTestId(testId);
        if ((await tab.count()) === 0 || !(await tab.isVisible())) continue;
        await expectWithinViewport(page, tab, testId);
        await expectTapTarget(tab, testId);
        await expectNotCovered(tab, testId);
      }

      // Menüleisten-Knöpfe müssen erreichbar sein. Auf dem Telefon liegen sie
      // im Blatt hinter „Menü“, nicht in einer zweiten Kopfzeile.
      await revealMainMenus(page);
      for (const menu of ['datei', 'hilfe']) {
        const trigger = page.getByTestId(`menubar-${menu}`);
        await expect(trigger).toBeVisible();
        await expectTapTarget(trigger, `menubar-${menu}`);
      }
    });

    test('Menüs, Mehr-Menü und Panels bleiben im Viewport und unverdeckt', async ({ page }) => {
      await openPlanner(page);
      await addComponent(page, 'battery');
      await addComponent(page, 'consumer');
      await showCanvas(page);

      // Jedes Menü öffnen: Dropdown muss im Bild liegen.
      await revealMainMenus(page);
      for (const menu of ['datei', 'bearbeiten', 'ansicht', 'werkzeuge', 'planung', 'hilfe']) {
        const trigger = page.getByTestId(`menubar-${menu}`);
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();
        const dropdown = page.locator('[role="menu"]').first();
        await expect(dropdown).toBeVisible();
        await expectWithinViewport(page, dropdown, `Menü ${menu}`);
        await page.keyboard.press('Escape');
        await expect(dropdown).toBeHidden();
      }

      // N3: „Weitere Aktionen“-Menü darf nicht aus dem Bild laufen.
      const more = page.getByTestId('action-more');
      if ((await more.count()) > 0 && (await more.isVisible())) {
        await more.click();
        const moreMenu = page.locator('[role="menu"]').first();
        await expect(moreMenu).toBeVisible();
        await expectWithinViewport(page, moreMenu, 'Weitere Aktionen');
        await page.keyboard.press('Escape');
      }

      // N5: Prüfsiegel-Panel muss sichtbar aufgehen (nicht nur Pfeil drehen).
      const seal = page.getByTestId('verification-seal-toggle');
      if ((await seal.count()) > 0) {
        await seal.scrollIntoViewIfNeeded();
        await seal.click();
        const panel = page.getByTestId('verification-seal-panel');
        await expect(panel).toBeVisible();
        await expectWithinViewport(page, panel, 'Prüfbericht-Panel');
        await expectNotCovered(panel, 'Prüfbericht-Panel');
        await seal.click();
      }

      // Ansicht-Popover (N8): im Bild und schließt nach Detail-Wahl.
      const displayOptions = page.getByTestId('canvas-display-options');
      if ((await displayOptions.count()) > 0 && (await displayOptions.isVisible())) {
        await displayOptions.click();
        const panel = page.locator('#canvas-display-options-panel');
        await expect(panel).toBeVisible();
        await expectWithinViewport(page, panel, 'Ansicht-Popover');
        await page.getByTestId('detail-level-overview').click();
        await expect(panel).toBeHidden();
      }
    });

    test('Stückliste öffnet ohne Horizontal-Scroll; Tab-Auswahl bleibt (Bug 7/21/26/29)', async ({
      page,
    }) => {
      await openPlanner(page);
      await addComponent(page, 'battery');
      await showCanvas(page);

      await openMenubar(page, 'datei');
      await page.getByTestId('action-bom').click();
      const dialog = page.getByRole('dialog', { name: 'Stückliste' });
      await expect(dialog).toBeVisible();
      await expectWithinViewport(page, dialog, 'Stückliste');
      const body = page.getByTestId('bom-scroll-body');
      const innerOverflow = await body.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(innerOverflow, 'Stückliste: innerer Horizontal-Overflow').toBeLessThanOrEqual(1);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      // Nach dem Schließen ist der Plan-Tab wieder aktiv sichtbar.
      await expect(page.getByTestId('planner-canvas-column')).toBeVisible();
      await expectNoHorizontalOverflow(page, 'Planer nach Stückliste');
    });

    test('Modus-Umschalter und Ansicht überlappen nicht (N8)', async ({ page }) => {
      await openPlanner(page);
      await addComponent(page, 'battery');
      await showCanvas(page);
      const mode = page.getByTestId('planner-mode-planung');
      const displayOptions = page.getByTestId('canvas-display-options');
      if (
        (await mode.count()) > 0 &&
        (await mode.isVisible()) &&
        (await displayOptions.count()) > 0 &&
        (await displayOptions.isVisible())
      ) {
        const a = await boxOf(mode, 'Modus-Umschalter');
        const b = await boxOf(displayOptions, 'Ansicht-Knopf');
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        expect(overlapX > 0 && overlapY > 0, 'Modus-Umschalter und Ansicht überlappen').toBe(false);
      }
      // Zoom-Kontrollen: 44 px (per CSS über dem RF-Standard) und unverdeckt.
      const zoomIn = page.locator('.react-flow__controls-zoomin');
      if ((await zoomIn.count()) > 0 && (await zoomIn.isVisible())) {
        await expectTapTarget(zoomIn, 'Zoom +');
        await expectNotCovered(zoomIn, 'Zoom +');
      }
      // Bug 23: „Planübersicht“ (Fit-View) lag unter der Undo-Leiste.
      const fitView = page.locator('.react-flow__controls-fitview');
      if ((await fitView.count()) > 0 && (await fitView.isVisible())) {
        await expectNotCovered(fitView, 'Planübersicht');
      }
    });

    test('Warnzentrale, Fachwissen und Fokus-Tab funktionieren (Bug 18/21/22/27)', async ({ page }) => {
      await openPlanner(page);
      await addComponent(page, 'battery');
      // Auto-verbinden erzeugt einen Plan mit echten Prüfhinweisen
      // (zwei lose Bauteile allein lösen keine Live-Warnung aus).
      // Bug 20: Vor der Übernahme MUSS der Vorschau-Dialog kommen.
      await showCanvas(page);
      const toolbarAutoWire = page.getByTestId('action-autowire');
      if ((await toolbarAutoWire.count()) > 0 && (await toolbarAutoWire.isVisible())) {
        await toolbarAutoWire.click();
      } else {
        await openMoreMenuItem(page, 'action-autowire-menu');
      }
      const preview = page.getByRole('dialog', { name: /Automatisch verbinden/ });
      await expect(preview).toBeVisible();
      await expectWithinViewport(page, preview, 'Auto-verbinden-Vorschau');
      await page.getByRole('button', { name: 'Vorschlag auf den Plan anwenden' }).click();
      await expect(preview).toBeHidden();
      await expect.poll(async () => edgeCount(page)).toBeGreaterThan(0);
      await showCanvas(page);

      // Bug 21: Prüfhinweise öffnen als sichtbares, unverdecktes Panel.
      const warnToggle = page.getByRole('button', { name: /Planungsprüfung öffnen/ });
      await expect(warnToggle).toBeVisible();
      await expectTapTarget(warnToggle, 'Prüfhinweise-Knopf');
      await warnToggle.click();
      const warnPanel = page.getByRole('dialog', { name: 'Planungsprüfung' });
      await expect(warnPanel).toBeVisible();
      await expectWithinViewport(page, warnPanel, 'Prüfhinweise-Panel');
      await expectNotCovered(warnPanel, 'Prüfhinweise-Panel');
      await page.keyboard.press('Escape');
      await expect(warnPanel).toBeHidden();

      // Bug 18/22: Fachwissen öffnen (Knopf oder Hilfe-Menü), Panel im Bild.
      const fab = page.getByRole('button', { name: 'Hilfe und Fachwissen öffnen' });
      if ((await fab.count()) > 0 && (await fab.isVisible())) {
        await expectTapTarget(fab, 'Fachwissen-Knopf');
        await expectNotCovered(fab, 'Fachwissen-Knopf');
        await fab.click();
      } else {
        await openMenubar(page, 'hilfe');
        await page.getByRole('menuitem', { name: /Hilfe & Fachwissen/ }).click();
      }
      const expertPanel = page.getByTestId('expert-panel-open');
      await expect(expertPanel).toBeVisible();
      await expectWithinViewport(page, expertPanel, 'Fachwissen-Panel');
      await expectNotCovered(expertPanel, 'Fachwissen-Panel');
      await page.getByTestId('expert-panel-close').click();
      await expect(expertPanel).toBeHidden();

      // Bug 27: Fokus-Tab hat eine sichtbare Wirkung (Chrome verschwindet)
      // und der Ausstieg ist ein eigener, erreichbarer Knopf — die untere
      // Navigation ist im Fokusmodus bewusst ausgeblendet.
      const focusTab = page.getByTestId('nav-tab-focus');
      if ((await focusTab.count()) > 0 && (await focusTab.isVisible())) {
        await focusTab.click();
        await expect(page.locator('.planner-shell--focus')).toBeVisible();
        const exit = page.getByTestId('focus-mode-exit');
        await expect(exit).toBeVisible();
        await expectWithinViewport(page, exit, 'Fokus-Beenden');
        await expectTapTarget(exit, 'Fokus-Beenden');
        await expectNotCovered(exit, 'Fokus-Beenden');
        await exit.click();
        await expect(page.locator('.planner-shell--focus')).toHaveCount(0);
        await expect(focusTab).toBeVisible();
      }
    });

    test('Stückliste aus dem Details-Tab öffnet über dem Blatt (Bug 29)', async ({ page }) => {
      await openPlanner(page);
      await addComponent(page, 'battery');
      const inspectorTab = page.getByTestId('nav-tab-inspector');
      if ((await inspectorTab.count()) > 0 && (await inspectorTab.isVisible())) {
        await inspectorTab.click();
      }
      await openMenubar(page, 'datei');
      await page.getByTestId('action-bom').click();
      const dialog = page.getByRole('dialog', { name: 'Stückliste' });
      await expect(dialog).toBeVisible();
      await expectNotCovered(dialog, 'Stückliste über Details');
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  });
}
