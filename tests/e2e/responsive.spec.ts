import { expect, test } from '@playwright/test';
import { addComponent, expectNoHorizontalOverflow, openPlanner, showCanvas } from './helpers';

/**
 * Pflichtszenario 2 (AGENTS.md K5):
 * Responsives Layout bei 375, 768 und 1440 px ohne horizontalen Overflow.
 *
 * Die Breakpoints sind die verbindlichen Entscheidungen aus Mission 1:
 *   < 768 px   Bottom-Tabs, ein Bereich sichtbar
 *   768–1279   Sidebar + Canvas, Inspector als Slide-over
 *   ≥ 1280 px  drei Spalten, Inspector angedockt
 */
test.describe('Responsives Layout', () => {
  test('kein horizontaler Overflow — leer und mit Plan', async ({ page }) => {
    await openPlanner(page);
    await expectNoHorizontalOverflow(page);

    await addComponent(page, 'battery');
    await addComponent(page, 'inverter');
    await addComponent(page, 'consumer230v');
    await expectNoHorizontalOverflow(page);
  });

  test('zeigt die für die Breite vorgesehenen Bereiche', async ({ page }) => {
    await openPlanner(page);
    const width = page.viewportSize()?.width ?? 0;

    const bottomNav = page.getByTestId('planner-bottom-nav');
    const sidebar = page.getByTestId('sidebar');

    if (width < 768) {
      // Handy (Spezifikation §5): vier Ansichten in der Fußleiste, der
      // Katalog öffnet als Ebene aus „Bauteile“.
      await expect(bottomNav).toBeVisible();
      await expect(sidebar).toBeHidden();
      await page.getByTestId('nav-tab-bauteile').click();
      await page.getByTestId('phone-add').click();
      await expect(sidebar).toBeVisible();
    } else {
      // Tablet und Desktop: Sidebar dauerhaft sichtbar, keine Bottom-Tabs.
      await expect(sidebar).toBeVisible();
      await expect(bottomNav).toBeHidden();
    }
  });

  test('der Canvas behält auf Tablet und Desktop genügend Breite', async ({ page }) => {
    await openPlanner(page);
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width < 768, 'Auf dem Handy ist der Canvas ein eigener Tab.');

    await showCanvas(page);
    const box = await page.getByTestId('planner-canvas-column').boundingBox();
    expect(box).not.toBeNull();
    // Mission-1-Entscheidung: der Canvas darf nie unter 600 px fallen, sobald
    // drei Spalten möglich sind. Auf dem Tablet ist der Inspector ein
    // Slide-over und nimmt keine Spaltenbreite weg.
    const minimum = width >= 1280 ? 600 : 400;
    expect(box!.width).toBeGreaterThanOrEqual(minimum);
  });

  test('M3.5: Tablet erreicht Verlauf und Auto-Wire direkt in der Leiste', async ({ page }) => {
    await openPlanner(page);
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width !== 768, 'Gilt exakt für das Tablet-Projekt.');

    for (const id of ['toolbar-undo', 'toolbar-redo', 'action-more']) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    // Nutzer-Entscheidung 2026-11-06: Hier stand `toBeHidden()` — der Knopf war
    // per `.cad-autowire-phone` ausgeblendet und nur über die Schrittleiste
    // erreichbar. Genau das war der gemeldete Defekt. Die Leiste ist entfallen,
    // der Knopf steht jetzt direkt in der Leiste; das Menü bleibt zweiter Weg.
    await expect(page.getByTestId('action-autowire')).toBeVisible();
    await page.getByTestId('action-more').click();
    await expect(page.getByTestId('action-autowire-menu')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('Tablet: Wasserplan und Ansichtsoptionen bleiben trotz fehlender Bottom-Navigation erreichbar', async ({
    page,
  }) => {
    await openPlanner(page);
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width !== 768, 'Gilt exakt für das Tablet-Projekt.');

    // Zwischen md und lg gab es vorher keinen Weg zum Wasserplan: die
    // Bottom-Navigation war ausgeblendet, der Desktop-Umschalter aber noch
    // nicht sichtbar. Die kompakte Toolbar löst diesen Zwischenzustand.
    await page.getByRole('tab', { name: 'Wasserplan anzeigen' }).click();
    await expect(page.getByTestId('sidebar')).toHaveAttribute('aria-label', 'Wasser-Komponenten');

    // Die Domänenfilter gehören ausschließlich zum Elektrikplan; zurück dort
    // liegt ihr kompakter, beschrifteter Zugang am Canvas.
    await page.getByRole('tab', { name: 'Elektrikplan anzeigen' }).click();
    const displayOptions = page.getByTestId('canvas-display-options');
    await expect(displayOptions).toBeVisible();
    const box = await displayOptions.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await displayOptions.click();
    await expect(page.getByRole('group', { name: 'Anzeige und Filter' })).toBeVisible();
  });

  test('Touch-Ziele der Navigation sind mindestens 44 px hoch', async ({ page }) => {
    await openPlanner(page);
    const width = page.viewportSize()?.width ?? 0;
    test.skip(width >= 768, 'Bottom-Navigation existiert nur unter 768 px.');

    for (const id of ['nav-tab-bauteile', 'nav-tab-schaltplan', 'nav-tab-pruefung', 'nav-tab-mehr']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, `${id} nicht sichtbar`).not.toBeNull();
      expect(box!.height, `${id} zu klein`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${id} zu schmal`).toBeGreaterThanOrEqual(44);
    }
  });
});

/**
 * AUD-002a-Folgefehler (Regressionstest).
 *
 * Der 230-V-Grenzhinweis stand auf der Startseite VOR den Handlungsbuttons.
 * Auf 375 px hat er den Haupt-CTA „Schaltplan starten" aus dem sichtbaren
 * Bereich geschoben — ein Nutzer musste scrollen, um überhaupt zu starten.
 * Der Pixel-Abgleich hat die Verschiebung gezeigt; dieser Test hält die
 * Eigenschaft fest, statt nur ein Bild zu vergleichen: Die primäre Handlung
 * bleibt ohne Scrollen erreichbar, und der Hinweis steht danach.
 *
 * Bewusst als Geometrie-Test und nicht als Baseline: Ein Screenshot vergleicht
 *Pixel, aber nicht die Frage „kommt der Nutzer an den Einstieg?".
 */
test.describe('Startseite: Einstieg bleibt ohne Scrollen erreichbar', () => {
  for (const breite of [375, 768, 1440]) {
    test(`Haupt-CTA liegt bei ${breite} px im ersten Bildschirm`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: breite === 375 ? 812 : 1024 });
      await page.goto('/');
      await expect(page.getByTestId('ac-scope-note')).toBeVisible();

      const hoehe = page.viewportSize()!.height;
      const cta = page.getByRole('link', { name: /Schaltplan starten/ });
      const ctaBox = await cta.boundingBox();
      expect(ctaBox, 'Haupt-CTA muss ein Layout haben').not.toBeNull();
      expect(
        ctaBox!.y + ctaBox!.height,
        `CTA-Unterkante ${Math.round(ctaBox!.y + ctaBox!.height)} px muss im Viewport (${hoehe} px) liegen`
      ).toBeLessThanOrEqual(hoehe);

      // Der Grenzhinweis darf den Einstieg nicht verdrängen: er steht danach.
      const hinweis = await page.getByTestId('ac-scope-note').boundingBox();
      expect(hinweis!.y).toBeGreaterThan(ctaBox!.y);
    });
  }
});
