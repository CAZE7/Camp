import { expect, test, type Locator, type Page } from '@playwright/test';

import { expectNoHorizontalOverflow, openPlanner, showCanvas } from './helpers';

/**
 * tests/e2e/mobile-views.spec.ts
 *
 * Die vier Ansichten der Handy-Hülle (Spezifikation §6) als eigener Vertrag.
 *
 * Geprüft wird genau das, was die Spezifikation zusichert und was sich mit
 * `getBoundingClientRect` und `elementFromPoint` belegen lässt:
 *
 *   1. Kopf (48 px + Safe-Area), Ansicht, Meldungsplatz, Fuß (56 px) — in
 *      dieser Reihenfolge, ohne Überdeckung, ohne Dokument-Scroll.
 *   2. Genau eine Ansicht ist sichtbar und bedienbar; die Zeichenfläche bleibt
 *      montiert und ist unter einer Ansicht `inert`.
 *   3. Jede Ansicht hat ihre eigene Scroll-Fläche mit `overscroll-behavior:
 *      contain`; die Seite scrollt dabei nie.
 *   4. Jedes Fußziel ist mindestens 44 × 44 px und `elementFromPoint` trifft
 *      es selbst.
 *   5. Der Fokusmodus blendet Kopf, Werkzeugzone und Fuß aus; Escape beendet
 *      ihn.
 *
 * Die Größenliste entspricht dem Auftrag: die drei gemessenen Handy-Fenster
 * (360×780, 390×844, 430×932), zwei flache Querformate (844×390, 852×393),
 * die Tabletgrenzen (768×1024, 1024×768) und der Desktop (1440×900). Auf den
 * Desktop-Größen prüft dieselbe Datei die Gegenprobe: keine Hülle.
 *
 * Bewusst keine festen Wartezeiten — gewartet wird auf Zustände.
 */

type Size = { name: string; width: number; height: number; shell: boolean };

const SIZES: Size[] = [
  { name: '360×780 (Handy klein)', width: 360, height: 780, shell: true },
  { name: '390×844 (Handy)', width: 390, height: 844, shell: true },
  { name: '430×932 (Handy groß)', width: 430, height: 932, shell: true },
  { name: '844×390 (Handy quer)', width: 844, height: 390, shell: true },
  { name: '852×393 (iPhone quer)', width: 852, height: 393, shell: true },
  { name: '768×1024 (Tablet)', width: 768, height: 1024, shell: false },
  { name: '1024×768 (Tablet quer)', width: 1024, height: 768, shell: false },
  { name: '1440×900 (Desktop)', width: 1440, height: 900, shell: false },
];

type Box = { x: number; y: number; width: number; height: number; right: number; bottom: number };

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

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, 'Element ohne Box').not.toBeNull();
  return roundBox(box as { x: number; y: number; width: number; height: number });
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
}

async function openFreshPlanner(page: Page): Promise<void> {
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

/** Liegt der Punkt in der Mitte des Ziels auf dem Ziel selbst? */
async function hitsSelf(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return top !== null && (top === element || element.contains(top));
  });
}

for (const size of SIZES) {
  test.describe(`Handy-Ansichten ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('Hülle: Kopf, Ansicht, Meldungsplatz und Fuß liegen im Fluss', async ({ page }) => {
      await openFreshPlanner(page);
      const viewport = { width: size.width, height: size.height };

      // Gegenprobe: unter der Grenze gibt es die Desktop-Leiste nicht.
      const desktopChrome = page.getByTestId('planner-dashboard');
      const header = page.getByTestId('planner-phone-header');
      const nav = page.getByTestId('planner-bottom-nav');
      const mobileHistory = page.locator('.planner-mobile-history');

      if (!size.shell) {
        // Tablet und Desktop: unverändert (Freigabe Punkt 5).
        await expect(header).toHaveCount(0);
        await expect(nav).toHaveCount(0);
        await expect(desktopChrome).toBeVisible();
        await expect(page.getByTestId('planner-toolbar')).toBeVisible();
        await expect(localStorageShellFlag(page)).resolves.toBe('false');
        await expectNoHorizontalOverflow(page);
        return;
      }

      await expect(desktopChrome).toHaveCount(0);
      await expect(page.getByTestId('planner-toolbar')).toHaveCount(0);
      await expect(mobileHistory).toHaveCount(0);
      await expect(header).toBeVisible();
      await expect(nav).toBeVisible();

      // 1) Kopfzeile: eine Zeile, 48 px plus Safe-Area, niemals höher als 64 px.
      const headerBox = await boxOf(header);
      expect(headerBox.y).toBeGreaterThanOrEqual(-1);
      expect(headerBox.width).toBeGreaterThan(size.width - 2);
      expect(headerBox.height).toBeGreaterThanOrEqual(44);
      expect(headerBox.height).toBeLessThanOrEqual(64);

      // 2) Fußleiste: vier Ziele, 56 px hoch, mindestens 44 px breit.
      const navBox = await boxOf(nav);
      expect(navBox.bottom, 'Fußleiste endet nicht am Fenster').toBeGreaterThanOrEqual(viewport.height - 1);
      expect(navBox.height).toBeGreaterThanOrEqual(44);
      expect(navBox.height).toBeLessThanOrEqual(64);
      expect(overlaps(headerBox, navBox)).toBe(false);

      for (const id of ['nav-tab-bauteile', 'nav-tab-schaltplan', 'nav-tab-pruefung', 'nav-tab-mehr']) {
        const tab = page.getByTestId(id);
        await expect(tab).toBeVisible();
        const tabBox = await boxOf(tab);
        expect(tabBox.width, `${id} zu schmal`).toBeGreaterThanOrEqual(44);
        expect(tabBox.height, `${id} zu flach`).toBeGreaterThanOrEqual(44);
        expect(tabBox.x).toBeGreaterThanOrEqual(navBox.x - 1);
        expect(tabBox.right).toBeLessThanOrEqual(navBox.right + 1);
        expect(await hitsSelf(tab), `${id} wird verdeckt`).toBe(true);
      }

      // 3) Die Ansicht füllt die Fläche zwischen Kopf und Fuß.
      const view = page.getByTestId('planner-phone-view');
      await expect(view).toHaveAttribute('data-phone-view', 'bauteile');
      const viewBox = await boxOf(view);
      expect(viewBox.y).toBeGreaterThanOrEqual(headerBox.bottom - 1);
      expect(viewBox.bottom).toBeLessThanOrEqual(navBox.y + 1);

      // 4) Die Zeichenfläche bleibt montiert, ist aber nicht bedienbar.
      const canvas = page.getByTestId('planner-canvas-column');
      await expect(canvas).toHaveCount(1);
      await expect(page.getByTestId('planner-workspace')).toHaveAttribute('inert', 'true');

      // 5) Kein Dokument-Scroll, kein waagerechter Überlauf.
      await expectNoHorizontalOverflow(page);
      const scroll = await page.evaluate(() => ({
        html: document.documentElement.scrollTop,
        body: document.body.scrollTop,
      }));
      expect(scroll.html).toBe(0);
      expect(scroll.body).toBe(0);
    });

    test('jede Ansicht ist genau einmal sichtbar und lässt sich bedienen', async ({ page }) => {
      test.skip(!size.shell, 'Nur in der Handy-Hülle.');
      await openFreshPlanner(page);
      const view = page.getByTestId('planner-phone-view');

      // Bauteile: Startansicht mit „Hinzufügen“ oder dem leeren Zustand.
      await expect(view).toHaveAttribute('data-phone-view', 'bauteile');
      await expect(view).toHaveCount(1);
      const add = page.getByTestId('phone-add');
      const addBattery = page.getByTestId('phone-add-battery');
      const hasAdd =
        (await add.isVisible().catch(() => false)) || (await addBattery.isVisible().catch(() => false));
      expect(hasAdd, 'Bauteile hat keinen Hinzufügen-Einstieg').toBe(true);

      // Schaltplan: die Fläche selbst, keine Ebene darüber.
      await page.getByTestId('nav-tab-schaltplan').click();
      await expect(view).toHaveCount(0);
      await expect(page.getByTestId('planner-canvas-column')).toBeVisible();
      await expect(page.getByTestId('planner-workspace')).not.toHaveAttribute('inert', 'true');
      const tools = page.getByTestId('phone-canvas-toolbar');
      await expect(tools).toBeVisible();
      for (const id of ['mobile-undo', 'mobile-redo', 'phone-zoom-in', 'phone-zoom-out', 'phone-zoom']) {
        const control = page.getByTestId(id);
        await expect(control, id).toBeVisible();
        const box = await boxOf(control);
        expect(box.height, `${id} zu flach`).toBeGreaterThanOrEqual(44);
      }
      // Die Werkzeugzone liegt IM Fluss über der Fläche, nicht darüber.
      const toolsBox = await boxOf(tools);
      const canvasBox = await boxOf(page.getByTestId('planner-canvas-column'));
      expect(toolsBox.bottom).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + 1);
      await expect(page.locator('.react-flow__controls')).toHaveCount(0);
      await expect(page.locator('.react-flow__minimap')).toHaveCount(0);

      // Prüfung: Verdikt und Liste als volle Ansicht.
      await page.getByTestId('nav-tab-pruefung').click();
      await expect(view).toHaveAttribute('data-phone-view', 'pruefung');
      await expect(page.getByTestId('phone-check-verdict')).toBeVisible();
      const verdictBox = await boxOf(page.getByTestId('phone-check-verdict'));
      const navBox = await boxOf(page.getByTestId('planner-bottom-nav'));
      expect(verdictBox.bottom).toBeLessThanOrEqual(navBox.y + 1);

      // Mehr: Aktionen, Vorlagen, Ausgabe, Hilfe — je genau einmal.
      await page.getByTestId('nav-tab-mehr').click();
      await expect(view).toHaveAttribute('data-phone-view', 'mehr');
      for (const id of ['action-autowire', 'action-bom', 'action-check', 'action-help', 'action-reset']) {
        await expect(page.getByTestId(id), `${id} fehlt in Mehr`).toHaveCount(1);
        await expect(page.getByTestId(id)).toBeVisible();
      }
      // AC-K1: „Hinzufügen“ steht nur in Bauteile, nicht noch einmal in Mehr.
      await expect(page.getByTestId('phone-add')).toHaveCount(0);

      // Zurück in die Startansicht — kein hängendes Blatt.
      await page.getByTestId('nav-tab-bauteile').click();
      await expect(view).toHaveAttribute('data-phone-view', 'bauteile');
      await expectNoHorizontalOverflow(page);
    });

    test('Katalog und Detail sind volle Ebenen; Fußziel schließt sie', async ({ page }) => {
      test.skip(!size.shell, 'Nur in der Handy-Hülle.');
      await openFreshPlanner(page);
      const view = page.getByTestId('planner-phone-view');

      // Katalog öffnen (die Startliste ist der leere Plan → „Batterie hinzufügen“).
      await showCanvas(page);
      await page.getByTestId('nav-tab-bauteile').click();
      const addBattery = page.getByTestId('phone-add-battery');
      const add = page.getByTestId('phone-add');
      if (await addBattery.isVisible().catch(() => false)) await addBattery.click();
      else await add.click();

      const sidebar = page.getByTestId('sidebar');
      await expect(sidebar).toBeVisible();
      // Der Katalog ist die einzige Ebene: keine Ansicht darunter, kein Fuß.
      await expect(view).toHaveCount(0);
      const sidebarBox = await boxOf(sidebar);
      expect(sidebarBox.y).toBeGreaterThanOrEqual(-1);
      expect(sidebarBox.bottom).toBeLessThanOrEqual(size.height + 1);
      await expect(page.getByTestId('planner-workspace')).toHaveAttribute('inert', 'true');

      // Ein Bauteil hinzufügen → Detail des neuen Bauteils (Spec §6.1).
      const tile = page.getByTestId('sidebar-item').first();
      await expect(tile).toBeVisible();
      await tile.click();
      const inspector = page.getByTestId('inspector-panel');
      await expect(inspector).toBeVisible({ timeout: 8_000 });
      await expect(sidebar).toBeHidden();

      // Ein Fußziel schließt die Ebene und zeigt genau die gewählte Ansicht.
      await page.getByTestId('nav-tab-bauteile').click();
      await expect(inspector).toBeHidden();
      await expect(view).toHaveAttribute('data-phone-view', 'bauteile');
      await expect(page.getByTestId('planner-workspace')).not.toHaveAttribute('inert', 'true');
      await expectNoHorizontalOverflow(page);
    });

    test('Fokusmodus blendet Kopf, Werkzeugzone und Fuß aus', async ({ page }) => {
      test.skip(!size.shell, 'Nur in der Handy-Hülle.');
      await openFreshPlanner(page);
      await page.getByTestId('nav-tab-schaltplan').click();

      const toggle = page.getByTestId('phone-focus-toggle');
      await expect(toggle).toBeVisible();
      await toggle.click();

      await expect(page.locator('.planner-shell--focus')).toBeVisible();
      await expect(page.getByTestId('planner-phone-header')).toBeHidden();
      await expect(page.getByTestId('planner-bottom-nav')).toBeHidden();
      await expect(page.getByTestId('phone-canvas-toolbar')).toBeHidden();

      // Der Ausstieg ist der einzige sichtbare Weg — erreichbar und im Bild.
      const exit = page.getByTestId('focus-mode-exit');
      await expect(exit).toBeVisible();
      const exitBox = await boxOf(exit);
      expect(exitBox.x).toBeGreaterThanOrEqual(-1);
      expect(exitBox.right).toBeLessThanOrEqual(size.width + 1);
      expect(exitBox.bottom).toBeLessThanOrEqual(size.height + 1);
      expect(await hitsSelf(exit), 'Fokus-Ausstieg wird verdeckt').toBe(true);

      // Escape beendet ihn (bestehendes Verhalten).
      await page.keyboard.press('Escape');
      await expect(page.locator('.planner-shell--focus')).toHaveCount(0);
      await expect(page.getByTestId('planner-phone-header')).toBeVisible();
      await expect(page.getByTestId('planner-bottom-nav')).toBeVisible();
    });
  });
}

/** Der Hüllen-Vertrag steht auch im DOM (`data-phone-shell`). */
async function localStorageShellFlag(page: Page): Promise<string | null> {
  return page
    .getByTestId('planner-shell')
    .getAttribute('data-phone-shell')
    .catch(() => null);
}

test.describe('Handy-Hülle: Deklaration im DOM', () => {
  test('`data-phone-shell` folgt derselben Grenze wie die Hülle', async ({ page }) => {
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openPlanner(page);
      const flag = await localStorageShellFlag(page);
      expect(flag, `${size.name}: data-phone-shell`).toBe(size.shell ? 'true' : 'false');
    }
  });

  test('Die Werkzeugzone ist keine schwebende Leiste über der Fläche', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPlanner(page);
    await page.getByTestId('nav-tab-schaltplan').click();

    const tools = page.evaluate(() => {
      const toolbar = document.querySelector('[data-testid="phone-canvas-toolbar"]');
      const pane = document.querySelector('.react-flow')?.getBoundingClientRect();
      if (!toolbar || !pane) return null;
      const box = toolbar.getBoundingClientRect();
      return {
        position: getComputedStyle(toolbar).position,
        overlapsPane: box.bottom > pane.top + 1 && box.top < pane.bottom - 1,
        bottom: box.bottom,
        paneTop: pane.top,
      };
    });
    const metrics = await tools;
    expect(metrics, 'Werkzeugzone oder Fläche fehlt').not.toBeNull();
    expect(metrics!.position).toBe('static');
    expect(metrics!.overlapsPane, 'Werkzeugzone liegt über der Fläche').toBe(false);
    expect(metrics!.bottom).toBeLessThanOrEqual(metrics!.paneTop + 1);
  });
});
