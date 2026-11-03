import { expect, test } from '@playwright/test';

import { pageByPath } from '../../lib/seo/inventory';

test.use({ javaScriptEnabled: false });

/**
 * Überschrift aus dem Seiteninventar statt als zweite Zeichenkette.
 *
 * Vorher stand der Text hier abgeschrieben — und blieb beim Umbau von
 * `/planer/` („Camper-Elektroplaner" → „Camper-Schaltplan kostenlos
 * erstellen") stehen. Genau das soll diese Prüfung nicht mehr zulassen: Sie
 * vergleicht jetzt den ausgelieferten Export mit dem Inventar, aus dem Titel,
 * Brotkrumen und strukturierte Beschreibung stammen.
 */
function h1Of(path: string): string {
  const page = pageByPath(path);
  if (!page) throw new Error(`Route ${path} fehlt im SEO-Inventar.`);
  return page.h1;
}

test('indexierbare Seiten liefern Überschrift, Inhalt und Verweise ohne JavaScript', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main h1')).toHaveCount(1);
  // Überschrift aus dem Inventar: Die Startseite trägt seit dem 2026-10-27 den
  // Hauptsuchbegriff im H1; ein zweiter, abgeschriebener Text würde beim
  // nächsten Umbau wieder stehen bleiben (genau der Befund aus dem Header).
  await expect(page.locator('main h1')).toHaveText(h1Of('/'));
  await expect(page.locator('main h1')).toContainText('Camper-Ausbau planen');
  await expect(page.locator('main')).toContainText('Dach, Elektrik, Heizung und Sicherheit an einem Ort.');
  await expect(page.getByRole('link', { name: 'Schaltplan starten' })).toHaveAttribute(
    'href',
    /\/planer\/?$/
  );

  await page.goto('/camper-elektrik/');
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Camper-Elektrik planen');
  await expect(page.locator('main')).toContainText(
    'Eine Elektrik im Camper wird nicht gezeichnet, sondern gerechnet'
  );
  await expect(
    page.getByRole('link', { name: '12V-Kabelquerschnitt für den Camper berechnen' })
  ).toHaveAttribute('href', /\/camper-elektrik\/kabelquerschnitt\/?$/);

  await page.goto('/elektrik-planung/');
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Camper-Elektrik berechnen');
  await expect(page.locator('main')).toContainText('Der Rechner dimensioniert eine 12-V-Leitung');
  // Die Anwendung ist umgezogen: Auf dieser Seite steht ihr Einstieg, nicht
  // ihre Zeichenfläche. Der Anker `#planer` bleibt das Ziel der Themenseiten.
  await expect(page.locator('#planer')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Planer im Vollbild öffnen' })).toHaveAttribute(
    'href',
    /\/planer\/?$/
  );

  // Anwendungsroute ohne JavaScript: Der Startbildschirm ist der ausgelieferte
  // Inhalt. Er benennt die Seite (genau eine `h1`, Text aus dem Inventar) und
  // bietet einen Weg zurück — ein leeres Fenster wäre eine Sackgasse.
  await page.goto('/planer/');
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText(h1Of('/planer/'));
  await expect(page.locator('main')).toContainText('Der Elektroplaner lädt');
  // `exact`: Die serverseitige Brotkrumenspur und der Rückweg-Link im
  // Ladehinweis führen beide zur selben Seite — gemeint ist der Rückweg.
  await expect(page.getByRole('link', { name: 'Camper-Elektrik berechnen', exact: true })).toHaveAttribute(
    'href',
    /\/elektrik-planung\/?$/
  );
});

test('Ladebooster-Vergleich liefert Inhalt ohne JavaScript', async ({ page }) => {
  await page.goto('/camper-elektrik/ladebooster/');
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText(h1Of('/camper-elektrik/ladebooster/'));
  await expect(page.locator('main')).toContainText('Ladebooster im Vergleich: 30, 60 oder 90 A?');
  await expect(page.locator('main')).toContainText('Die Kurzentscheidung');
  await expect(page.locator('main')).toContainText('Geräteüberblick');
});
