import { expect, type Page, test } from '@playwright/test';

import { expandAllCategories, openMenubar, openPlanner, showCanvas, showSidebar } from './helpers';

/**
 * tests/e2e/scroll-architecture.spec.ts
 *
 * M12 — Vertrag der Scroll-Architektur (Auftrag §2 und §9A).
 *
 * Diese Datei prüft mit echter Interaktion (Rad, Klicks, Zustandswechsel), dass
 * die Anwendung genau EINE Scroll-Achse pro Zone hat:
 *
 *   · Dokument — scrollt auf `/planer/` nie. Die Hülle ist der Rahmen.
 *   · Canvas   — verschiebt den Plan, nie die Seite (`overscroll-behavior`).
 *   · Panels   — scrollen nur ihren eigenen Körper, reichen das Rad nicht
 *                weiter und sind vollständig erreichbar.
 *   · Blätter  — Palette, Eigenschaften und Menüs liegen vollständig im Bild;
 *                ihr Öffnen verändert die Größe der Zeichenfläche NICHT (das
 *                war die Ursache dafür, dass React Flow bei jedem Panelwechsel
 *                neu vermessen wurde und der Plan „sprang“).
 *
 * Bewusst keine `overflow: hidden`-Behauptungen: Geprüft wird, ob Inhalte
 * erreichbar bleiben (Rad-Bewegung im Panel, Blätter im Bild), nicht ob eine
 * CSS-Eigenschaft gesetzt ist.
 */

type Box = { x: number; y: number; width: number; height: number; right: number; bottom: number };

async function boxOf(page: Page, testId: string): Promise<Box> {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box, `${testId} hat keine Box`).not.toBeNull();
  return roundBox(box as { x: number; y: number; width: number; height: number });
}

function roundBox(box: { x: number; y: number; width: number; height: number }): Box {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
    right: Math.round(box.x + box.width),
    bottom: Math.round(box.y + box.height),
  };
}

async function documentScroll(page: Page): Promise<{ html: number; body: number; width: number }> {
  return page.evaluate(() => ({
    html: document.documentElement.scrollTop,
    body: document.body.scrollTop,
    width: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
}

async function viewport(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
}

/** Prüft, dass eine Box vollständig im Fenster liegt (1 px Toleranz). */
function expectInsideViewport(box: Box, view: { width: number; height: number }, label: string): void {
  expect(box.x, `${label}: links außerhalb`).toBeGreaterThanOrEqual(-1);
  expect(box.y, `${label}: oben außerhalb`).toBeGreaterThanOrEqual(-1);
  expect(box.right, `${label}: rechts außerhalb`).toBeLessThanOrEqual(view.width + 1);
  expect(box.bottom, `${label}: unten außerhalb`).toBeLessThanOrEqual(view.height + 1);
}

test.describe('M12 Scroll-Architektur', () => {
  test('das Dokument scrollt nicht — die Hülle ist der Rahmen', async ({ page }) => {
    await openPlanner(page);
    const scroll = await documentScroll(page);
    expect(scroll.html, 'html hat gescrollt').toBe(0);
    expect(scroll.body, 'body hat gescrollt').toBe(0);

    const view = await viewport(page);
    const shell = await boxOf(page, 'planner-shell');
    // Hülle = dynamische Fensterhöhe (dvh). 1 px Toleranz für Subpixel.
    expect(Math.abs(shell.height - view.height), 'Hülle ist nicht fensterhoch').toBeLessThanOrEqual(1);
  });

  test('Rad über der Zeichenfläche verschiebt die Seite nicht', async ({ page }) => {
    await openPlanner(page);
    await showCanvas(page);

    const canvas = await boxOf(page, 'planner-canvas-column');
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.wheel(0, 400);

    // Zwei Frames Ruhe: erst danach ist eine Scroll-Wirkung sichtbar.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    const scroll = await documentScroll(page);
    expect(scroll.html, 'die Seite folgte dem Rad auf der Zeichenfläche').toBe(0);
    expect(scroll.body, 'body folgte dem Rad auf der Zeichenfläche').toBe(0);
    expect(scroll.width, 'horizontaler Überlauf nach dem Rad').toBeLessThanOrEqual(1);

    // Die Zeichenfläche bleibt dabei in derselben Größe (Zoom/Pan, kein Reflow).
    const after = await boxOf(page, 'planner-canvas-column');
    expect(after).toEqual(canvas);
  });

  test('der Panel-Körper scrollt sich selbst und reicht das Rad nicht weiter', async ({ page }) => {
    await openPlanner(page);
    await showSidebar(page);
    await expandAllCategories(page);

    const list = page.getByTestId('sidebar-scroll');
    await expect(list).toBeVisible();

    const scrollable = await list.evaluate((el) => el.scrollHeight > el.clientHeight + 4);
    test.skip(!scrollable, 'Die Bauteilliste ist in dieser Breite nicht scrollbar.');

    const box = await boxOf(page, 'sidebar-scroll');
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(60, box.height / 2));
    await page.mouse.wheel(0, 300);

    await expect
      .poll(() => list.evaluate((el) => el.scrollTop), { message: 'die Liste scrollte nicht' })
      .toBeGreaterThan(0);

    const scroll = await documentScroll(page);
    expect(scroll.html, 'die Seite scrollte mit der Liste (Scroll-Chaining)').toBe(0);
    expect(scroll.body, 'body scrollte mit der Liste (Scroll-Chaining)').toBe(0);

    // Das Panel bleibt dabei vollständig im Bild — es scrollt nur sein Inhalt.
    const view = await viewport(page);
    expectInsideViewport(await boxOf(page, 'sidebar'), view, 'Katalog');
  });

  test('Blätter und Menüs liegen vollständig im Bild', async ({ page }) => {
    await openPlanner(page);
    const view = await viewport(page);

    // 1. Bauteilkatalog (auf dem Handy ein Blatt über der Zeichenfläche, ab
    //    768 px eine Spalte — in beiden Fällen vollständig im Bild).
    await showSidebar(page);
    expectInsideViewport(await boxOf(page, 'sidebar'), view, 'Katalog');

    // 2. Eigenschaften: am Handy ein Blatt, ab 1280 px eine Spalte. Nur dort
    //    gibt es einen Schalter, der ihn ohne Auswahl öffnet.
    const inspectorHandle = page.getByRole('button', { name: /Rechte Sidebar/ });
    const navInspector = page.getByTestId('nav-tab-inspector');
    const panel = page.getByTestId('inspector-panel');
    if (await navInspector.isVisible()) {
      await navInspector.click();
      await expect(panel).toBeVisible();
      expectInsideViewport(await boxOf(page, 'inspector-panel'), view, 'Eigenschaften-Blatt');
      await page.getByTestId('nav-tab-electric').click();
    } else if (await inspectorHandle.isVisible()) {
      await inspectorHandle.click();
      await expect(panel).toBeVisible();
      expectInsideViewport(await boxOf(page, 'inspector-panel'), view, 'Eigenschaften-Spalte');
      await inspectorHandle.click();
    }
    // Zwischen 768 und 1279 px ist der Inspector ein Slide-over, das eine
    // Auswahl öffnet — ohne Auswahl gibt es dort bewusst keinen Schalter.
    // Geprüft wird deshalb nur, was auch bedienbar ist.

    // 3. Das „Weitere Aktionen“-Menü der Werkzeugleiste.
    await page.getByTestId('action-more').click();
    const toolbarMenu = page.getByRole('menu', { name: 'Weitere Aktionen' });
    await expect(toolbarMenu).toBeVisible();
    expectInsideViewport(roundBox((await toolbarMenu.boundingBox())!), view, 'Werkzeugmenü');
    await page.keyboard.press('Escape');

    // 4. Ein Menü der Menüleiste.
    // Ab 768 px ist der Auslöser ein `menuitem`, das Dropdown heißt „Menü“.
    // Darunter liegt er als Knopf im Blatt hinter „Menü“; das geöffnete
    // Menü heißt dann nach dem Abschnitt („Ansicht“).
    const onPhone =
      (await page.getByTestId('phone-menu').count()) > 0 &&
      (await page.getByTestId('phone-menu').isVisible());
    await openMenubar(page, 'ansicht');
    const menubarMenu = page.getByRole('menu', { name: onPhone ? 'Ansicht' : 'Menü' });
    await expect(menubarMenu).toBeVisible();
    if (onPhone) {
      // Der Abschnitt darf im Blatt scrollen. Gemessen wird das Blatt, nicht
      // die volle Höhe der Einträge, und der erste Eintrag liegt darin.
      const sheet = page.getByTestId('phone-menu-sheet');
      const sheetBox = roundBox((await sheet.boundingBox())!);
      expectInsideViewport(sheetBox, view, 'Menüblatt');
      const nav = page.getByTestId('planner-bottom-nav');
      if (await nav.isVisible()) {
        const navBox = await boxOf(page, 'planner-bottom-nav');
        expect(sheetBox.bottom, 'Menüblatt liegt unter der Fußleiste').toBeLessThanOrEqual(navBox.y + 1);
      }
      const itemBox = roundBox((await menubarMenu.getByRole('menuitem').first().boundingBox())!);
      expect(itemBox.y).toBeGreaterThanOrEqual(sheetBox.y - 1);
      expect(itemBox.bottom).toBeLessThanOrEqual(sheetBox.bottom + 1);
    } else {
      const menubarBox = roundBox((await menubarMenu.boundingBox())!);
      expectInsideViewport(menubarBox, view, 'Menüleiste-Dropdown');
    }
    await page.keyboard.press('Escape');
  });

  test('das Öffnen eines Blattes verändert die Zeichenfläche nicht', async ({ page }) => {
    await openPlanner(page);
    const view = await viewport(page);
    test.skip(view.width >= 768, 'Gilt für die Blatt-Darstellung des Handys.');

    const before = await boxOf(page, 'planner-canvas-column');
    expect(before.height, 'Zeichenfläche zu klein').toBeGreaterThanOrEqual(240);

    await page.getByTestId('nav-tab-sidebar').click();
    await expect(page.getByTestId('sidebar')).toBeVisible();
    expect(await boxOf(page, 'planner-canvas-column'), 'Katalogblatt hat den Canvas verschoben').toEqual(
      before
    );

    await page.getByTestId('sidebar-close').click();
    await expect(page.getByTestId('sidebar')).toBeHidden();
    expect(await boxOf(page, 'planner-canvas-column'), 'Blatt schließen hat den Canvas verschoben').toEqual(
      before
    );
  });

  test('zehnfaches Umschalten bleibt geometrisch stabil', async ({ page }) => {
    // Die Breitenübergänge (150 ms) sind Darstellung, nicht Layout. Ohne diese
    // Zeile mäße der Test einen Zwischenwert mitten im Übergang — genau das
    // war der erste Befund dieses Tests (Palette 115 px statt 248 px).
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPlanner(page);

    const snapshot = async () => ({
      toolbar: await boxOf(page, 'planner-toolbar'),
      canvas: await boxOf(page, 'planner-canvas-column'),
      scrollWidth: (await documentScroll(page)).width,
    });

    // Auf dem Handy sind es die Blatt-Schalter der Fußleiste, ab 768 px die
    // Griffe an der Panelkante — beides ist derselbe Umschaltvorgang.
    const navSidebar = page.getByTestId('nav-tab-sidebar');
    const useNav = await navSidebar.isVisible();
    const sidebarHandle = page.getByRole('button', { name: /Linke Sidebar (ein|aus)klappen/ });
    const inspectorHandle = page.getByRole('button', { name: /Rechte Sidebar (ein|aus)klappen/ });

    const before = await snapshot();
    for (let round = 0; round < 10; round += 1) {
      if (useNav) {
        await navSidebar.click();
        await expect(page.getByTestId('sidebar')).toBeVisible();
        await page.getByTestId('nav-tab-electric').click();
        await expect(page.getByTestId('sidebar')).toBeHidden();
        await page.getByTestId('nav-tab-inspector').click();
        await expect(page.getByTestId('inspector-panel')).toBeVisible();
        await page.getByTestId('nav-tab-electric').click();
      } else {
        await sidebarHandle.click();
        await sidebarHandle.click();
        if (await inspectorHandle.isVisible()) {
          await inspectorHandle.click();
          await inspectorHandle.click();
        }
      }
    }
    const after = await snapshot();

    expect(after, 'die Shell verändert sich beim Umschalten').toEqual(before);
    expect(after.scrollWidth, 'horizontaler Überlauf nach 10 Runden').toBeLessThanOrEqual(1);
  });

  test('das eingeklappte Eigenschaften-Panel lässt sich am Desktop wieder öffnen', async ({ page }) => {
    await openPlanner(page);
    const view = await viewport(page);
    test.skip(view.width < 1280, 'Der angedockte Inspector beginnt bei 1280 px.');

    const handle = page.getByRole('button', { name: /Rechte Sidebar/ });
    const panel = page.getByTestId('inspector-panel');

    // Ohne Auswahl startet der Inspector eingeklappt — der Griff muss trotzdem
    // bedienbar sein. Er liegt im `xl:invisible`-Panel; `visibility` erbt sich,
    // deshalb war er vor M12 genau dann unsichtbar, wenn er gebraucht wurde.
    await expect(handle).toBeVisible();
    await handle.click();
    await expect(panel).toBeVisible();

    await handle.click();
    await expect(panel).toBeHidden();
    await expect(handle, 'der Griff verschwindet mit dem Panel').toBeVisible();
  });

  test('Werkzeugleiste und Fußleiste bleiben erreichbar und überlappen nichts', async ({ page }) => {
    await openPlanner(page);
    // Mit geöffnetem Katalog: Die Leisten liegen darüber, nicht darunter. Auf
    // dem Handy ist der Katalog ein Blatt (`nav-tab-sidebar`), ab 768 px ist er
    // die linke Spalte und bereits sichtbar.
    await showSidebar(page);
    await expect(page.getByTestId('sidebar')).toBeVisible();

    const view = await viewport(page);
    const toolbar = await boxOf(page, 'planner-toolbar');
    const workspace = await boxOf(page, 'planner-workspace');
    const canvas = await boxOf(page, 'planner-canvas-column');

    expectInsideViewport(toolbar, view, 'Werkzeugleiste');
    expect(toolbar.bottom, 'Werkzeugleiste überdeckt den Arbeitsbereich').toBeLessThanOrEqual(
      workspace.y + 1
    );
    expect(canvas.y, 'Zeichenfläche beginnt unter der Werkzeugleiste').toBeGreaterThanOrEqual(
      workspace.y - 1
    );

    const navVisible = await page.getByTestId('planner-bottom-nav').isVisible();
    if (navVisible) {
      const nav = await boxOf(page, 'planner-bottom-nav');
      expectInsideViewport(nav, view, 'Fußleiste');
      // Die Fußleiste liegt UNTER dem Arbeitsbereich, nie darüber.
      expect(nav.y, 'Fußleiste überdeckt den Arbeitsbereich').toBeGreaterThanOrEqual(
        workspace.y + workspace.height - 1
      );
    }

    // Kein Knopf der Leiste ist abgeschnitten (die Statusgruppe ist genagelt).
    const clipped = await page.evaluate(() => {
      const bar = document.querySelector('.cad-toolbar');
      if (!bar) return ['keine Werkzeugleiste'];
      const rect = bar.getBoundingClientRect();
      return Array.from(bar.querySelectorAll('button'))
        .filter((element) => {
          const box = element.getBoundingClientRect();
          if (box.width === 0) return false;
          return box.right > rect.right + 0.5 || box.left < rect.left - 0.5 || box.bottom > rect.bottom + 0.5;
        })
        .map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '?');
    });
    expect(clipped, 'abgeschnittene Knöpfe in der Werkzeugleiste').toEqual([]);
  });

  test('die Werkzeugleiste scrollt nicht selbst weg', async ({ page }) => {
    await openPlanner(page);
    await showSidebar(page);
    await expandAllCategories(page);

    const before = await boxOf(page, 'planner-toolbar');
    const list = await boxOf(page, 'sidebar-scroll');
    await page.mouse.move(list.x + list.width / 2, list.y + Math.min(60, list.height / 2));
    await page.mouse.wheel(0, 500);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    expect(await boxOf(page, 'planner-toolbar'), 'die Werkzeugleiste hat sich beim Scrollen bewegt').toEqual(
      before
    );
  });
});
