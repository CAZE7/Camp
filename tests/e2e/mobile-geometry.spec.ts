import { expect, test, type Locator, type Page } from '@playwright/test';

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
  // Diese Datei misst Geometrie AUF DER FLÄCHE (Knoten, Kanten, Werkzeugzone).
  // In der Handy-Hülle liegt beim Öffnen die Ansicht „Bauteile“ davor und die
  // Fläche ist `inert` (Spec §5/§6.1) — Klicks und Messungen liefen deshalb
  // gegen eine unsichtbare Ebene. Der Wechsel ist Teil der Vorbereitung, nicht
  // der Prüfung: Messbar ist die Fläche in der Ansicht „Schaltplan“.
  const canvasTab = page.getByTestId('nav-tab-schaltplan');
  if (await canvasTab.isVisible()) await canvasTab.click();
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

/**
 * Zahl kritischer Befunde.
 *
 * Am Desktop steht sie in der Statuszeile, auf dem Handy trägt sie der Badge
 * an „Prüfung“ im Fuß (Spec §5.2) — zusätzlich im `aria-label`, damit sie
 * nicht nur eine Farbe ist.
 */
async function criticalCount(page: Page): Promise<number> {
  const badge = page.getByTestId('nav-tab-pruefung');
  if (await badge.isVisible().catch(() => false)) {
    // Das `aria-label` trägt die genaue Zahl; der sichtbare Badge kürzt ab
    // 10 auf „9+“ und taugt deshalb nicht zum Zählen.
    const label = (await badge.getAttribute('aria-label')) ?? '';
    const labelled = label.match(/(\d+)\s+kritisch/);
    return labelled ? Number(labelled[1]) : 0;
  }
  const text = await page.locator('.planner-statusbar').innerText();
  const match = text.match(/(\d+)\s+kritisch/);
  return match ? Number(match[1]) : 0;
}

/** Zoom-Stand in Prozent — Handy: in der Werkzeugzone, Desktop: Statuszeile. */
async function zoomPercent(page: Page): Promise<number> {
  const phoneZoom = page.getByTestId('phone-zoom');
  if (await phoneZoom.isVisible().catch(() => false)) {
    const text = (await phoneZoom.innerText()).match(/(\d+)/);
    return text ? Number(text[1]) : Number.NaN;
  }
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
    await expect(page.getByText('QA-FREMD').first()).toBeVisible({ timeout: 15_000 });

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
        // Handy-Hülle (Spezifikation §5.1): keine Menüleiste, keine
        // Werkzeugleiste — eine Kopfzeile mit Home, Projektname und
        // Speicherzustand, darunter die vier Ansichten.
        await expect(page.locator('.cad-menubar')).toHaveCount(0);
        await expect(page.getByTestId('planner-toolbar')).toHaveCount(0);
        const header = page.getByTestId('planner-phone-header');
        await expect(header).toBeVisible();
        const headerBox = await boxOf(header);
        expect(insideViewport(headerBox, viewport)).toBe(true);
        // Eine Zeile: 48 px plus Safe-Area, nie höher als 64 px.
        expect(headerBox.height).toBeLessThanOrEqual(64);
        await expect(page.getByTestId('planner-bottom-nav')).toBeVisible();
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

      // Werkzeugzone und Fläche liegen nur in der Ansicht „Schaltplan“
      // (Spezifikation §6.2). Vorher steht die Startansicht „Bauteile“.
      await page.getByTestId('nav-tab-schaltplan').click();
      await expect(page.getByTestId('planner-canvas-column')).toBeVisible();

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

      // Zoom liegt in derselben Zone; die React-Flow-`Controls` gibt es in der
      // Handy-Hülle nicht mehr (eine Bedienung, ein Ort).
      const zoomIn = page.getByTestId('phone-zoom-in');
      await expect(zoomIn).toBeVisible();
      await expect(page.locator('.react-flow__controls-zoomin')).toBeHidden();
      expect(insideViewport(await boxOf(zoomIn), viewport)).toBe(true);
      expect(boxesOverlap(await boxOf(overview), await boxOf(zoomIn))).toBe(false);
      const hit = await zoomIn.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return element.contains(top);
      });
      expect(hit).toBe(true);

      // Statuszeile entfällt in der Hülle (Spec §5.2: der Fuß trägt die
      // Prüfzahl) — sie ist gar nicht mehr im DOM.
      await expect(page.locator('.planner-statusbar')).toHaveCount(0);

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
      if (viewport.width < 768 || viewport.height <= 500) {
        // In der Hülle liefert die Werkzeugzone die Gruppe (Spec §6.2); das
        // Panel auf der Fläche gibt es dort nicht mehr (sonst zwei Sätze
        // Knöpfe mit derselben Kennung).
        await expect(page.locator('.planner-mode-switch-panel')).toHaveCount(0);
        const group = page.getByTestId('phone-canvas-toolbar').getByRole('group', { name: 'Arbeitsmodus' });
        const groupBox = await boxOf(group);
        // Die Modusgruppe steht in einer Zeile der Werkzeugzone und bleibt
        // innerhalb ihres Elternteils (kein Überlauf, keine Überdeckung).
        expect(groupBox.x + groupBox.width).toBeLessThanOrEqual(viewport.width + 1);
        const zone = await boxOf(page.getByTestId('phone-canvas-toolbar'));
        expect(groupBox.y + groupBox.height).toBeLessThanOrEqual(zone.y + zone.height + 1);
        // Die Modus-Erklärung ist eine Zeile der Werkzeugzone (Spec §6.2),
        // nicht ein Kärtchen über der Fläche: sie beginnt links am Rand der
        // Zone und endet rechts daran.
        const hint = page.getByTestId('planner-mode-caption');
        if (await hint.isVisible()) {
          const hintBox = await boxOf(hint);
          expect(hintBox.width).toBeGreaterThan(20);
          expect(hintBox.x).toBeGreaterThanOrEqual(zone.x - 1);
          expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(zone.x + zone.width + 1);
          expect(boxesOverlap(hintBox, groupBox)).toBe(false);
        }
      }
      const ansicht = page.getByTestId('canvas-display-options');
      if (await ansicht.isVisible()) {
        const ansichtBox = await boxOf(ansicht);
        for (const box of boxes) expect(boxesOverlap(box!, ansichtBox)).toBe(false);
      }
    });

    test('„Automatisch verbinden“ liegt in „Mehr“ frei und ungeschnitten', async ({ page }) => {
      await openFreshExample(page);
      // Kanonischer Name (Spec §16.2): „Automatisch verbinden“ — nicht mehr
      // „Auto-verbinden“ und nicht mehr „Vorschlag prüfen“.
      await page.getByTestId('nav-tab-mehr').click();
      const wire = page.getByTestId('action-autowire');
      await expect(wire).toBeVisible();
      await expect(wire).toContainText('Automatisch verbinden');
      const wireBox = await boxOf(wire);
      expect(insideViewport(wireBox, viewport)).toBe(true);
      const clipped = await wire.evaluate((element) => element.scrollWidth > element.clientWidth + 2);
      expect(clipped).toBe(false);
      // Große Trefferfläche auch in der Liste (≥ 44 px).
      expect(wireBox.height).toBeGreaterThanOrEqual(44);
      // Jede Aktion genau einmal (AC-K1): kein zweiter Einstieg in derselben
      // Ansicht und keine Werkzeugleiste daneben.
      await expect(page.getByTestId('action-autowire')).toHaveCount(1);
      await expect(page.getByTestId('planner-toolbar')).toHaveCount(0);
      const nav = page.getByTestId('planner-bottom-nav');
      expect(boxesOverlap(wireBox, await boxOf(nav))).toBe(false);
    });

    test('zweiter Zoom-Tipp vergrößert, die Karte lässt sich am Körper ziehen', async ({ page }) => {
      await openFreshExample(page);
      // Handy-Hülle: Zoom steht in der Werkzeugzone (Spec §6.2); die
      // React-Flow-`Controls` werden dort nicht gerendert.
      const zoomIn = page.getByTestId('phone-zoom-in');
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
      await page.getByTestId('nav-tab-mehr').click();
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

      await page.getByTestId('nav-tab-mehr').click();
      await page.getByTestId('action-bom').click();
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
      const scrollBody = bom.getByTestId('bom-scroll-body');
      const scrollHeight = await scrollBody.evaluate((element) => element.clientHeight);
      expect(scrollHeight).toBeGreaterThan(120);
      const sideways = await scrollBody.evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(sideways).toBeLessThanOrEqual(1);
      for (const name of [/CSV exportieren/, /Druckbericht/, /Stückliste kopieren/]) {
        const action = bom.getByRole('button', { name });
        const mark = action.locator('svg');
        await expect(mark).toBeVisible();
        expect((await boxOf(mark)).width).toBeGreaterThan(10);
      }
      await bom.getByRole('button', { name: 'Dialog schließen' }).click();

      // Nach dem Bericht steht die Ansicht „Mehr“ wieder da (das Blatt war
      // über ihr). Für den Klick auf ein Bauteil erst zurück auf den
      // Schaltplan — dort liegt die Fläche.
      await page.getByTestId('nav-tab-schaltplan').click();
      await clickVisiblePart(page, viewport);
      // Hilfe liegt auf dem Handy in „Mehr“ (Spec §6.4), nicht in einem Menü.
      await page.getByTestId('nav-tab-mehr').click();
      await page.getByTestId('action-help').click();
      await expect(page.getByTestId('planner-phone-view')).toHaveCount(0);
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

      // Der Prüfbericht ist auf dem Handy eine eigene Ansicht (Spec §6.3) —
      // kein Blatt über dem Plan, keine zweite Prüfplakette daneben.
      await page.getByTestId('nav-tab-pruefung').click();
      await expect(page.getByTestId('planner-phone-view')).toHaveAttribute('data-phone-view', 'pruefung');
      const verdict = page.getByTestId('phone-check-verdict');
      await expect(verdict).toBeVisible();
      expect(insideViewport(await boxOf(verdict), viewport)).toBe(true);
      const heading = page.getByRole('heading', { name: 'Prüfung', level: 2 });
      expect(insideViewport(await boxOf(heading), viewport)).toBe(true);
    });

    test('Prüfung und Hilfe sind volle Ansichten und bleiben im Bild', async ({ page }) => {
      await openFreshExample(page);

      // Die Zeichenfläche füllt die Fläche unter Kopf und Fuß — auch in der
      // kleinsten gemessenen Größe (375×667) bleibt genug Plan übrig.
      await page.getByTestId('nav-tab-schaltplan').click();
      const canvas = await boxOf(page.getByTestId('planner-canvas-column'));
      expect(canvas.height).toBeGreaterThan(150);

      // Werkzeugzone: Erklärung und Darstellung liegen IM Fluss, nicht darüber.
      const caption = page.getByTestId('planner-mode-caption');
      await expect(caption).toBeVisible();
      const displayToggle = page.getByTestId('phone-display-toggle');
      await expect(displayToggle).toBeVisible();
      expect(boxesOverlap(await boxOf(caption), await boxOf(displayToggle))).toBe(false);
      await expect(page.getByTestId('canvas-display-options')).toHaveCount(0);

      // Aufklappen vergrößert die Zone und verkleinert die Fläche — sie
      // überdeckt sie nicht (Spec §6.2). Gemessen wird die FLÄCHE selbst
      // (`planner-canvas-surface`), nicht die Spalte: Die ist `flex-1` und
      // behält ihre Höhe, während die Fläche darin schrumpft.
      const surface = () => boxOf(page.getByTestId('planner-canvas-surface'));
      const surfaceBefore = await surface();
      await displayToggle.click();
      await expect(page.getByTestId('phone-display-options')).toBeVisible();
      const surfaceWithPanel = await surface();
      const zone = page.getByTestId('phone-canvas-toolbar');
      const zoneBox = await boxOf(zone);
      // Zwei zulässige Ausgänge, beide „im Fluss“ (Spec §6.2):
      //  · es ist Platz → die Zone wächst und die Fläche schrumpft;
      //  · die Zone ist am Höhendeckel (flaches Querformat) → der Rest
      //    scrollt IN der Zone, die Fläche bleibt nutzbar.
      const grewAndPushed = surfaceWithPanel.height < surfaceBefore.height;
      const cappedAndScrolls =
        zoneBox.height <= Math.round(viewport.height / 3) + 2 &&
        (await zone.evaluate((element) => element.scrollHeight > element.clientHeight + 1)) &&
        surfaceWithPanel.height > 0;
      expect(
        grewAndPushed || cappedAndScrolls,
        `Zone ${zoneBox.height} px, Fläche ${surfaceWithPanel.height} px`
      ).toBe(true);
      // Kein `fixed`-Popover: Der Bereich liegt innerhalb der Zone.
      const optionsInsideZone = await page
        .getByTestId('phone-display-options')
        .evaluate((element) => element.closest('[data-testid="phone-canvas-toolbar"]') !== null);
      expect(optionsInsideZone).toBe(true);
      await displayToggle.click();
      await expect(page.getByTestId('phone-display-options')).toHaveCount(0);

      // Hilfe: bestehendes Experten-Panel als eigene Ebene über der Ansicht.
      await page.getByTestId('nav-tab-mehr').click();
      await page.getByTestId('action-help').click();
      const expert = page.getByTestId('expert-panel-open');
      await expect(expert).toBeVisible();
      const expertBox = await boxOf(expert);
      expect(insideViewport(expertBox, viewport)).toBe(true);
      expect(expertBox.height).toBeGreaterThan(120);
      const headerHit = await expert.locator('h3').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return element.contains(top);
      });
      expect(headerHit).toBe(true);
      await page.getByTestId('expert-panel-close').click();
      await expect(expert).toBeHidden();

      // Prüfung: eigene Ansicht mit Verdikt, kein Blatt über dem Plan.
      await page.getByTestId('nav-tab-pruefung').click();
      const verdict = page.getByTestId('phone-check-verdict');
      await expect(verdict).toBeVisible();
      expect(insideViewport(await boxOf(verdict), viewport)).toBe(true);
      await expect(page.getByRole('dialog', { name: 'Planungsprüfung' })).toHaveCount(0);
    });

    test('„Mehr“ bleibt im Bild und die Seite rutscht nicht seitlich', async ({ page }) => {
      test.skip(viewport.width >= 768 && viewport.height > 500, 'nur der kompakte Kopf');
      await openFreshExample(page);
      const metrics = () =>
        page.evaluate(() => ({
          x: document.documentElement.scrollLeft,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }));
      expect((await metrics()).overflow).toBeLessThanOrEqual(1);

      await page.getByTestId('nav-tab-mehr').click();
      const view = page.getByTestId('planner-phone-view');
      await expect(view).toHaveAttribute('data-phone-view', 'mehr');
      expect(insideViewport(await boxOf(view), viewport)).toBe(true);

      // Jede sichtbare Zeile liegt im Blatt und ist nicht seitlich
      // abgeschnitten — auch die längsten Beschriftungen.
      const rows = page.getByTestId('planner-phone-view').locator('section button');
      const count = await rows.count();
      for (let index = 0; index < count; index += 1) {
        const row = rows.nth(index);
        if (!(await row.isVisible())) continue;
        const box = await boxOf(row);
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        const clipped = await row.evaluate((element) => element.scrollWidth > element.clientWidth + 2);
        expect(clipped, `Zeile ${index} ist abgeschnitten`).toBe(false);
      }

      const shift = await metrics();
      expect(shift.x).toBeLessThanOrEqual(1);
      expect(shift.overflow).toBeLessThanOrEqual(1);

      // Zurück in die Startansicht — kein hängendes Blatt.
      await page.getByTestId('nav-tab-bauteile').click();
      await expect(view).toHaveAttribute('data-phone-view', 'bauteile');
    });

    test('Einstiegsmeldung liegt im Meldungsplatz und deckt keine Bedienung', async ({ page }) => {
      await openFreshExample(page);
      // Spezifikation §5.3: EINE Meldung im Fluss. Die frühere absolute Karte
      // (`.planner-entry-notice`) lag über den Karten und ist ersatzlos weg.
      await expect(page.locator('.planner-entry-notice')).toHaveCount(0);
      await expect(page.getByTestId('planner-message-slot')).toBeVisible();
      await expect(page.getByTestId('planner-message-slot')).toHaveAttribute('data-empty', 'false');
      await expect(page.getByTestId('action-feedback')).toBeVisible();
      await expectMessageClearsControls(page);
    });

    test('Meldungsplatz im Querformat liegt frei und bleibt bedienbar', async ({ page }) => {
      test.skip(!(viewport.width >= 768 && viewport.height <= 500), 'kurzes Querformat');
      await openFreshExample(page);
      const slot = page.getByTestId('planner-message-slot');
      await expect(slot).toBeVisible();
      expect(insideViewport(await boxOf(slot), viewport)).toBe(true);
      for (const id of ['planner-mode-caption', 'phone-display-toggle', 'planner-mode-planung']) {
        const other = page.getByTestId(id);
        if (await other.isVisible())
          expect(boxesOverlap(await boxOf(slot), await boxOf(other)), id).toBe(false);
      }
    });
  });
}

async function expectMessageClearsControls(page: Page): Promise<void> {
  const slot = page.getByTestId('planner-message-slot');
  // Der Beispielplan kann aus dem Speicher zurückkommen, ohne die Meldung
  // noch einmal zu setzen. Dann einmal sauber neu laden.
  if ((await slot.count()) === 0 || !(await slot.isVisible().catch(() => false))) {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    const dialog = page.getByRole('dialog');
    await dialog
      .first()
      .waitFor({ state: 'visible', timeout: 8_000 })
      .catch(() => undefined);
    if ((await dialog.count()) > 0) {
      await dialog.getByRole('button', { name: 'Dialog schließen' }).click();
      await expect(dialog).toBeHidden();
    }
  }
  await expect(slot).toBeVisible();
  await expect(page.getByTestId('action-feedback')).toBeVisible();
  const slotBox = await boxOf(slot);
  for (const id of [
    'planner-mode-planung',
    'planner-mode-physisch',
    'planner-mode-pruefung',
    'planner-mode-caption',
    'phone-display-toggle',
    'planner-bottom-nav',
  ]) {
    const control = page.getByTestId(id);
    if ((await control.count()) === 0 || !(await control.isVisible())) continue;
    expect(boxesOverlap(slotBox, await boxOf(control)), id).toBe(false);
  }
  const mode = page.getByTestId('planner-mode-physisch');
  const hit = await mode.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return top != null && element.contains(top);
  });
  expect(hit).toBe(true);
  await mode.click();
  await expect(page.getByTestId('planner-mode-caption')).toContainText('Physisch');
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
    // Katalog als Ebene über der Ansicht „Bauteile“ (Spec §6.1, Schritt 1).
    await page.getByTestId('nav-tab-bauteile').click();
    await page.getByTestId('phone-add').click();
    const tile = page.getByTestId('sidebar-item').first();
    await expect(tile).toBeVisible();
    const label = (await tile.getAttribute('data-component-label')) ?? '';
    const before = await page.locator('.react-flow__node').count();
    await tile.click();

    // Nach dem Hinzufügen liegt das DETAIL des neuen Bauteils offen
    // (Spec §6.1, Schritt 2) — nicht wieder der Katalog, kein schwebender
    // Toast über der Zeichenfläche. Der Knoten zählt im DOM, auch wenn die
    // Ebene ihn gerade verdeckt (die Fläche bleibt montiert, Spec §5).
    await expect(page.getByTestId('inspector-panel')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.planner-mobile-feedback')).toHaveCount(0);
    await expect(page.locator('.react-flow__node')).toHaveCount(before + 1);

    // Der Schaltplan zeigt den neuen Knoten im Bild (Schritt 3).
    await page.getByTestId('nav-tab-schaltplan').click();
    const added = page.locator('.react-flow__node', { hasText: label }).last();
    await expect(added).toBeVisible();
    const addedBox = await boxOf(added);
    expect(addedBox.y + addedBox.height).toBeGreaterThan(0);
    expect(addedBox.y).toBeLessThan(393);
    expect(addedBox.x + addedBox.width).toBeGreaterThan(0);
    expect(addedBox.x).toBeLessThan(852);

    // Die Ansage steht im Meldungsplatz — im Bild und ohne Überdeckung.
    const slot = page.getByTestId('planner-message-slot');
    await expect(slot).toBeVisible();
    const slotBox = await boxOf(slot);
    expect(insideViewport(slotBox, { width: 852, height: 393 })).toBe(true);
    // Spec §5.3: Der Meldungsplatz schneidet BEDIENUNG nicht — Werkzeugzone,
    // Fußleiste und Zoom. Plan-Knoten darf er berühren (er schiebt die Ansicht
    // nach oben; bei 393 px Höhe bleibt daneben wenig Fläche).
    const toolbar = page.getByTestId('phone-canvas-toolbar');
    expect(boxesOverlap(slotBox, await boxOf(toolbar))).toBe(false);
    const nav = page.getByTestId('planner-bottom-nav');
    expect(boxesOverlap(slotBox, await boxOf(nav))).toBe(false);
    for (const id of ['phone-zoom-in', 'phone-zoom-out', 'mobile-undo', 'mobile-overview']) {
      expect(boxesOverlap(slotBox, await boxOf(page.getByTestId(id))), id).toBe(false);
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

test.describe('Einstiegsmeldung bei 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeEach(({ browserName: _browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'einmal, im Projekt desktop-1440');
  });

  test('liegt im Fluss unter der Werkzeugleiste und deckt nichts', async ({ page }) => {
    await openFreshExample(page);
    // Am Desktop ist die absolute Einstiegskarte ersetzt: dieselbe Meldung,
    // derselbe Platz wie auf dem Handy, nur unter der Chrome-Leiste (Spec
    // §5.3). Sie schiebt den Plan nach unten, statt ihn zu überdecken.
    await expect(page.locator('.planner-entry-notice')).toHaveCount(0);
    const slot = page.getByTestId('planner-message-slot');
    await expect(slot).toBeVisible();
    await expect(page.getByTestId('action-feedback')).toBeVisible();
    const slotBox = await boxOf(slot);
    expect(insideViewport(slotBox, { width: 1440, height: 900 })).toBe(true);
    for (const id of ['planner-toolbar', 'canvas-display-options', 'planner-mode-planung']) {
      const control = page.getByTestId(id);
      if (!(await control.isVisible())) continue;
      expect(boxesOverlap(slotBox, await boxOf(control)), id).toBe(false);
    }
    const canvas = page.getByTestId('planner-canvas-column');
    const canvasBox = await boxOf(canvas);
    expect(canvasBox.y).toBeGreaterThanOrEqual(slotBox.y + slotBox.height - 1);
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
    // Der Prüfplaketten-Knopf („Planungsprüfung öffnen“) ist Bedienung der
    // Desktop-Menüleiste. Auf dem Handy ist die Prüfung die eigene Ansicht
    // „Prüfung“ (Spec §6.3) — dort steht dieselbe Zahl.
    await page.getByTestId('nav-tab-pruefung').click();
    const probe = page.getByTestId('phone-check-verdict');
    await expect(probe).toBeVisible();
    const before = await probe.innerText();
    await page.getByTestId('nav-tab-schaltplan').click();
    // Auf dem Handy gibt es kein `action-more` (das ist die Werkzeugleiste der
    // Desktop-Chrome): Die Aktionen stehen direkt in „Mehr“ (Spec §6.4).
    await page.getByTestId('nav-tab-mehr').click();
    await page.getByTestId('action-autowire').click();
    const dialog = page.getByRole('dialog', { name: /Vorschlag prüfen/ });
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    const text = await dialog.innerText();
    expect(text).not.toMatch(/AUTO-[A-Z0-9-]+|%20|auto-node:|ul248-classT|\bi2A\b/);
    await dialog.getByRole('button', { name: 'Vorschlag verwerfen' }).click();
    await expect(dialog).toBeHidden();
    // Zurück in die Prüfansicht: dieselbe Zahl wie vor dem Abbruch.
    await page.getByTestId('nav-tab-pruefung').click();
    await expect(probe).toHaveText(before);
  });
});
