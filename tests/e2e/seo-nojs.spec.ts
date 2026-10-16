import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

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
  await expect(
    page.getByRole('link', { name: '12V-Kabelquerschnitt für den Camper berechnen' })
  ).toHaveAttribute('href', /\/camper-elektrik\/kabelquerschnitt\/?$/);
  // Der Rechner der umgezogenen Seite (`/elektrik-planung/`) steht jetzt hier:
  // Rechner, Normgrundlagen und Absicherung sind auf einer Seite.
  await expect(page.locator('main')).toContainText('Der Rechner dimensioniert eine 12-V-Leitung');
  await expect(page.getByRole('link', { name: 'Camper-Elektroplaner öffnen' })).toHaveAttribute(
    'href',
    /\/planer\/?$/
  );

  // Ausbau-Vorlagen: eigene Adresse, eigene Überschrift, Stückliste und ein
  // Weg in den Planer — ohne JavaScript lesbar.
  await page.goto('/vorlagen/wochenend/');
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Elektrik-Vorlage: Wochenend-Camper');
  await expect(page.locator('main')).toContainText('Stückliste');
  await expect(page.getByRole('link', { name: 'Camper-Elektroplaner öffnen' })).toHaveAttribute(
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
