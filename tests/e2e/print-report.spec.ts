import { expect, test } from '@playwright/test';
import { addComponent, autoWire, openMoreMenuItem, openPlanner } from './helpers';

/**
 * Druckbericht im echten Browser.
 *
 * Der Bericht entsteht über mehrere asynchrone Schritte (dynamischer Import,
 * ein Frame, html-to-image). Zwei Dinge lassen sich nur im Browser prüfen:
 *
 * 1. `window.open` braucht eine laufende Nutzeraktivierung. Wird das Fenster
 *    erst nach der Aufnahme geöffnet, blockiert der Browser es bei großen
 *    Plänen kommentarlos.
 * 2. Das eingebettete Bild muss wirklich geladen sein und darf die Seite
 *    nicht überlaufen — ein `dataUrl`-String im HTML beweist das nicht.
 */
test.describe('Druckbericht im Browser', () => {
  test('öffnet das Druckfenster und bettet einen geladenen Schaltplan ein', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-1440',
      'Der Druckdialog wird einmal im Desktop-Projekt geprüft.'
    );

    await openPlanner(page);
    await addComponent(page, 'battery');
    await addComponent(page, 'consumer');
    await autoWire(page);
    await openMoreMenuItem(page, 'action-bom');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const printButton = dialog.getByTestId('bom-print-report');
    await expect(printButton).toBeEnabled();

    // Das Fenster muss als Popup aufgehen — nicht blockiert werden.
    const popupPromise = context.waitForEvent('page', { timeout: 30_000 });
    await printButton.click();
    const report = await popupPromise;
    await report.waitForLoadState('domcontentloaded');

    // Titel und Überschrift stammen aus dem Bericht, nicht aus about:blank.
    await expect(report).toHaveTitle(/Planungsbericht/);
    await expect(report.locator('h1')).toContainText('Planungsbericht');

    // Der Schaltplan ist ein ECHT geladenes Bild: naturalWidth > 0 beweist,
    // dass die Data-URL dekodiert wurde und nicht nur im Markup steht.
    const image = report.locator('img.plan-image');
    await expect(image).toHaveCount(1);
    await expect
      .poll(async () => image.evaluate((el) => (el as HTMLImageElement).naturalWidth), {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);

    // Stückliste und Prüfbericht sind im selben Dokument.
    await expect(report.locator('body')).toContainText('Stückliste');
    await expect(report.locator('body')).toContainText(/Prüfbericht|Prüfung/);

    // Kein waagerechter Überlauf: das Bild darf die A4-Breite nicht sprengen.
    const overflow = await report.evaluate(() => {
      const img = document.querySelector('img.plan-image') as HTMLImageElement | null;
      if (!img) return { missing: true };
      const rect = img.getBoundingClientRect();
      return {
        missing: false,
        widerThanPage: rect.width > document.documentElement.clientWidth + 1,
        zeroHeight: rect.height <= 0,
      };
    });
    expect(overflow.missing).toBe(false);
    expect(overflow.widerThanPage).toBe(false);
    expect(overflow.zeroHeight).toBe(false);

    // Es darf keine Konsistenz-Warnung im Ausgangsdialog stehen.
    await expect(dialog.getByTestId('bom-report-error')).toHaveCount(0);
    await report.close();
  });

  /**
   * Der Plan ändert sich, NACHDEM die Stückliste geöffnet wurde. Undo ist auch
   * bei offenem Dialog erreichbar. Der Bericht darf dann nicht entstehen —
   * sonst zeigte das Bild den zurückgenommenen Stand und die Stückliste den
   * alten.
   */
  test('verweigert das Dokument, wenn der Plan nach dem Öffnen zurückgenommen wird', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-1440',
      'Der Druckdialog wird einmal im Desktop-Projekt geprüft.'
    );

    await openPlanner(page);
    await addComponent(page, 'battery');
    await addComponent(page, 'consumer');
    await autoWire(page);
    await openMoreMenuItem(page, 'action-bom');

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('bom-print-report')).toBeEnabled();

    // Plan zurücknehmen, während der Dialog offen ist.
    await page.keyboard.press('ControlOrMeta+z');

    await dialog.getByTestId('bom-print-report').click();

    // Entweder wird gar kein Fenster geöffnet (Vorprüfung greift) oder ein
    // geöffnetes wird sofort wieder geschlossen (Nachprüfung greift).
    const error = dialog.getByTestId('bom-report-error');
    await expect(error).toBeVisible({ timeout: 15_000 });
    await expect(error).toContainText(/geändert/i);

    // Kein Dokument mit gemischtem Planstand darf übrig bleiben. Der Zustand
    // wird abgefragt statt mit einer festen Wartezeit angenommen — ein zu früh
    // geöffnetes Fenster wäre sonst nur zufällig erkannt.
    await expect
      .poll(() => context.pages().filter((p) => p !== page && !p.isClosed()).length, {
        timeout: 10_000,
      })
      .toBe(0);
  });
});
