import { expect, test } from '@playwright/test';

test.describe('Ladebooster-Vergleich', () => {
  test('filtert Geräte und rechnet den Ladestrom', async ({ page }) => {
    await page.goto('/camper-elektrik/ladebooster/');

    await expect(
      page.getByRole('heading', { name: 'Ladebooster im Vergleich: 30, 60 oder 90 A?' })
    ).toBeVisible();
    await expect(page.getByRole('table', { name: /Geräteüberblick/ })).toBeVisible();

    // Der Rechner initialisiert nach der Hydration mit 330 Ah / 5 h / 180 A.
    await expect(page.getByLabel('Batteriekapazität (Ah)')).toHaveValue('330');
    await expect(page.getByText('79 A · 0,24 C', { exact: true })).toBeVisible();
    await expect(page.getByText('90-A-Klasse', { exact: true })).toBeVisible();
    await expect(page.getByText('130 A · 72 %', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '60–70 A' }).click();
    await expect(page.getByRole('button', { name: '60–70 A' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { name: 'BB 60', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'WA 121545', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Orion-Tr Smart 12/12-30', exact: true })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'VCC 1212-90', exact: true })).toBeHidden();

    await page.getByLabel('Batteriekapazität (Ah)').fill('100');
    await page.getByLabel('Gewünschte Fahrzeit (h)').fill('5');
    await page.getByLabel('Lichtmaschine (A)').fill('180');
    await page.getByRole('button', { name: 'Berechnen' }).click();

    await expect(page.getByText('24 A · 0,24 C', { exact: true })).toBeVisible();
    await expect(page.getByText('30-A-Klasse', { exact: true })).toBeVisible();
    await expect(page.getByText('53 A · 30 %', { exact: true })).toBeVisible();
  });
});
