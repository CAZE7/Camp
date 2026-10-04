import { expect, test } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('indexierbare Seiten liefern Überschrift, Inhalt und Verweise ohne JavaScript', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.locator('main h1')).toHaveText('Camper planen — erst der Plan, dann das Blech.');
  await expect(page.locator('main')).toContainText('Dach, Elektrik, Heizung und Sicherheit an einem Ort.');
  await expect(page.getByRole('link', { name: 'Schaltplan starten' })).toHaveAttribute(
    'href',
    /\/elektrik-planung\/?$/
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
});
