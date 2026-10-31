import { expect, test } from '@playwright/test';

/**
 * Der Ladebooster-Vergleich nach dem Umbau auf das Vergleichs-Template.
 *
 * Drei Zusagen werden hier am gebauten Export geprüft, nicht im Quelltext:
 *   - G12: die sechs eingefrorenen Ausgaben des Ladestrom-Rechners.
 *   - G6:  ein Filter wirkt auf Tabellenzeilen UND Produktkarten. Der Vorgänger
 *          blendete nur die Karten aus und trug einen Hinweissatz dazu.
 *   - G10: unter 768 px gibt es genau EINE Darstellung — die Karten tragen die
 *          Scan-Merkmale selbst. Darüber steht die Tabelle, und die Karten
 *          blenden genau diese Merkmale aus.
 *
 * Der Klassenfilter heißt jetzt „50–70 A": Das Renogy mit 50 A gehörte schon
 * vorher dazu, der Knopf nannte aber „60–70 A".
 */

const ORION = 'orion-tr-smart-12-12-30';

test.describe('Ladebooster-Vergleich', () => {
  test('filtert Geräte und rechnet den Ladestrom', async ({ page }) => {
    await page.goto('/camper-elektrik/ladebooster/');

    await expect(
      page.getByRole('heading', { name: 'Ladebooster im Vergleich: 30, 60 oder 90 A?' })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcher passt zu mir?' })).toBeVisible();

    // Der Rechner ist mit 330 Ah / 5 h / 180 A vorbelegt und rechnet bei der
    // Eingabe — einen „Berechnen"-Knopf gibt es nicht mehr.
    await expect(page.getByLabel('Batteriekapazität (Ah)')).toHaveValue('330');
    await expect(page.getByText('79 A · 0,24 C', { exact: true })).toBeVisible();
    await expect(page.getByText('90-A-Klasse', { exact: true })).toBeVisible();
    await expect(page.getByText('130 A · 72 %', { exact: true })).toBeVisible();

    const filter = page.getByRole('button', { name: '50–70 A' });
    await filter.click();
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { name: 'BB 60', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'WA 121545', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Orion-Tr Smart 12/12-30', exact: true })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'VCC 1212-90', exact: true })).toBeHidden();

    await page.getByLabel('Batteriekapazität (Ah)').fill('100');
    await expect(page.getByText('24 A · 0,24 C', { exact: true })).toBeVisible();
    await expect(page.getByText('30-A-Klasse', { exact: true })).toBeVisible();
    await expect(page.getByText('53 A · 30 %', { exact: true })).toBeVisible();
  });

  test('G6: ein Filter trifft Zeile und Karte desselben Geräts', async ({ page }) => {
    // Eigene Breite: G6 prüft die Filterlogik, nicht die Darstellung. Unter
    // 768 px wäre die Tabelle ohnehin ausgeblendet und die Zusage für die
    // Zeilen nicht prüfbar (dafür ist G10 zuständig).
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/camper-elektrik/ladebooster/');

    const darstellungen = (id: string) => page.locator(`[data-vergleich-produkt="${id}"]`);

    await expect(darstellungen(ORION)).toHaveCount(2);

    await page.getByRole('button', { name: '50–70 A' }).click();
    await expect(darstellungen(ORION).first()).toBeHidden();
    await expect(darstellungen(ORION).nth(1)).toBeHidden();
    await expect(darstellungen('ective-bb-60').first()).toBeVisible();
    await expect(darstellungen('ective-bb-60').nth(1)).toBeVisible();

    await page.getByRole('button', { name: 'Alle' }).click();
    await expect(darstellungen(ORION).first()).toBeVisible();
    await expect(darstellungen(ORION).nth(1)).toBeVisible();
  });

  test('G10: eine Darstellung je Gerätebreite', async ({ page }) => {
    await page.goto('/camper-elektrik/ladebooster/');

    const breite = page.viewportSize()?.width ?? 1440;
    const tabelle = page.getByRole('table', { name: /Geräteüberblick/, includeHidden: true });
    const scanMerkmal = page.locator(`#p-${ORION}`).getByText('Ladestrom', { exact: true });

    if (breite < 768) {
      await expect(tabelle).toBeHidden();
      // Ohne Tabelle trägt die Karte die Scan-Werte — mobil eine Darstellung.
      await expect(scanMerkmal).toBeVisible();
    } else {
      await expect(tabelle).toBeVisible();
      await expect(scanMerkmal).toBeHidden();
    }

    // In beiden Fällen sind alle neun Geräte lesbar, und der Anker aus den
    // Einsatzfällen trifft die Karte.
    await expect(page.locator('[data-vergleich-liste="karten"] > article')).toHaveCount(9);
    await page.getByRole('link', { name: 'Victron Energy Orion-Tr Smart 12/12-30' }).click();
    await expect(page.locator(`#p-${ORION}`)).toBeInViewport();

    // Die Tabelle darf seitlich scrollen (eigener Tab-Schritt), das DOKUMENT
    // aber nicht: Ein Vergleich, der die ganze Seite quer schiebt, ist auf dem
    // Handy unbrauchbar.
    const ueberlauf = await page.evaluate(() => ({
      dokument: document.documentElement.scrollWidth,
      fenster: window.innerWidth,
    }));
    expect(ueberlauf.dokument).toBeLessThanOrEqual(ueberlauf.fenster + 1);
  });
});
