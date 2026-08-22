import { expect, test } from '@playwright/test';
import { addComponent, autoWire, edgeCount, nodeCount, openPlanner } from './helpers';

/**
 * Pflichtszenario 3 (AGENTS.md K5):
 * Reload-Persistenz von Knoten und Kanten.
 *
 * Der Planer speichert mit Zustand `persist` im localStorage
 * (`werft-planner-v1`). Getestet wird das Verhalten, nicht die Implementierung:
 * nach einem echten Reload muss derselbe Plan dastehen.
 */
test.describe('Persistenz über einen Reload', () => {
  test('Knoten und Kanten überleben das Neuladen', async ({ page }) => {
    await openPlanner(page);
    await addComponent(page, 'battery');
    await addComponent(page, 'consumer');
    await autoWire(page);

    const nodesBefore = await nodeCount(page);
    const edgesBefore = await edgeCount(page);
    expect(nodesBefore).toBeGreaterThan(2);
    expect(edgesBefore).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByTestId('planner-shell')).toBeVisible({ timeout: 30000 });

    await expect.poll(async () => nodeCount(page)).toBe(nodesBefore);
    await expect.poll(async () => edgeCount(page)).toBe(edgesBefore);
  });

  test('ein frischer Browser-Kontext startet mit leerem Plan', async ({ browser }) => {
    // Eigener Kontext = eigener localStorage. Belegt zugleich, dass die Tests
    // isoliert laufen und nicht voneinander abhängen.
    const context = await browser.newContext();
    const page = await context.newPage();
    await openPlanner(page);
    expect(await nodeCount(page)).toBe(0);
    await context.close();
  });

  test('der gespeicherte Stand ist versioniert', async ({ page }) => {
    await openPlanner(page);
    await addComponent(page, 'battery');

    const stored = await page.evaluate(() => window.localStorage.getItem('werft-planner-v1'));
    expect(stored, 'Kein persistierter Planstand gefunden').not.toBeNull();

    const parsed = JSON.parse(stored as string) as { version?: number; state?: unknown };
    expect(typeof parsed.version).toBe('number');
    expect(parsed.state).toBeTruthy();
  });
});
