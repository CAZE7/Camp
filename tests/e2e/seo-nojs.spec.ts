import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('indexierbare Seiten liefern Überschrift, Inhalt und Verweise ohne JavaScript', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Camper planen — erst der Plan, dann das Blech.');
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
  await expect(page.locator('main h1')).toHaveText('Camper-Elektroplaner');
  await expect(page.locator('main')).toContainText('Der Elektroplaner lädt');
  // `exact`: Die serverseitige Brotkrumenspur und der Rückweg-Link im
  // Ladehinweis führen beide zur selben Seite — gemeint ist der Rückweg.
  await expect(page.getByRole('link', { name: 'Camper-Elektrik berechnen', exact: true })).toHaveAttribute(
    'href',
    /\/elektrik-planung\/?$/
  );
});
