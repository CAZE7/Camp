import { expect, test, type Page } from '@playwright/test';

test.use({ javaScriptEnabled: false });

/**
 * Der Block „Im Planer weiterrechnen“ (`components/seo/SeoPage.tsx`) ist der
 * eine Ort, an dem der Verweis auf den Planer als Schaltfläche steht.
 *
 * Ohne diese Einschränkung greift der Locator mehrere Links mit demselben
 * Text — im Fließtext, in der Verweisliste und im Planer-Block — und
 * Playwright meldet einen Strict-Mode-Verstoß, obwohl der Verweis vorhanden
 * ist. Die Prüfung soll den Zielpfad belegen, nicht die Zahl der Teaser.
 */
function planerBlock(page: Page) {
  return page.locator('section[aria-labelledby="weiter-planer-titel"]');
}

test('indexierbare Seiten liefern Überschrift, Inhalt und Verweise ohne JavaScript', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Camper-Ausbau planen: Elektrik, Dach und Heizlast');
  await expect(page.locator('main')).toContainText(
    'Beim Camper-Ausbau entscheidet die Planung über Sicherheit, Kosten und Nacharbeit.'
  );
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
  // Der Rechner der umgezogenen Seite (`/elektrik-planung/`) steht jetzt hier:
  // Rechner, Normgrundlagen und Absicherung sind auf einer Seite.
  //
  // Der Verweis auf den Kabelquerschnitt steht zweimal: einmal als Teaser im
  // Fließtext, einmal in der Verweisliste. Beide zeigen auf denselben Pfad —
  // geprüft wird der Pfad, deshalb der erste Treffer.
  await expect(
    page.getByRole('link', { name: '12V-Kabelquerschnitt für den Camper berechnen' }).first()
  ).toHaveAttribute('href', /\/camper-elektrik\/kabelquerschnitt\/?$/);
  await expect(page.locator('main')).toContainText('Der Rechner dimensioniert eine 12-V-Leitung');
  await expect(planerBlock(page).getByRole('link', { name: 'Camper-Elektroplaner öffnen' })).toHaveAttribute(
    'href',
    /\/planer\/?$/
  );

  // Ausbau-Vorlagen: eigene Adresse, eigene Überschrift, Stückliste und ein
  // Weg in den Planer — ohne JavaScript lesbar.
  await page.goto('/vorlagen/wochenend/');
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Elektrik-Vorlage: Wochenend-Camper');
  await expect(page.locator('main')).toContainText('Stückliste');
  await expect(planerBlock(page).getByRole('link', { name: 'Camper-Elektroplaner öffnen' })).toHaveAttribute(
    'href',
    /\/planer\/?$/
  );

  // Anwendungsroute ohne JavaScript: Der Startbildschirm ist der ausgelieferte
  // Inhalt. Er benennt die Seite (genau eine `h1`, Text aus dem Inventar) und
  // bietet einen Weg zurück — ein leeres Fenster wäre eine Sackgasse.
  await page.goto('/planer/');
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Camper-Schaltplan online erstellen (12V/24V)');
  await expect(page.locator('main')).toContainText('Der Elektroplaner lädt');
  await expect(page.getByRole('link', { name: /Camper-Elektrik planen/ })).toHaveAttribute(
    'href',
    /\/camper-elektrik\/?$/
  );
});
