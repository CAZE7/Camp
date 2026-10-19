import { expect, test, type Page } from '@playwright/test';
import simplePlan from '../../knownPlans/simple.json';
import { openPlanner, showCanvas } from './helpers';

/**
 * Unter 768 px nimmt die Werkzeugleiste den Knopf aus der Statusgruppe
 * (`globals.css`, `.cad-status-optimize`). Dieselbe Aktion bleibt im
 * Überlaufmenü (`action-optimize-routing`). Die Zusicherung — Geräte
 * bleiben stehen, ein zweiter Lauf bleibt gesperrt — gilt auf beiden Wegen.
 */
async function runOptimize(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Kabel optimieren', exact: true });
  if (await button.isVisible()) {
    await expect(button).toBeEnabled();
    await button.click();
    await expect(button).toBeDisabled();
    return;
  }
  await page.getByTestId('action-more').click();
  const item = page.getByTestId('action-optimize-routing');
  await expect(item).toBeVisible();
  await expect(item).toBeEnabled();
  await item.click();
}

test('explicit optimization leaves device positions unchanged', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((plan) => {
    localStorage.setItem(
      'elektroplaner-planner-v1',
      JSON.stringify({ state: { nodes: plan.nodes, edges: plan.edges, viewMode: 'electric' }, version: 1 })
    );
    localStorage.setItem(
      'elektroplaner-preferences-v1',
      JSON.stringify({ state: { calculatedSolarWatts: 0, hasOnboarded: true }, version: 2 })
    );
  }, simplePlan.autoWire);
  await openPlanner(page);
  await showCanvas(page);
  const positions = () =>
    page
      .locator('.react-flow__node')
      .evaluateAll((nodes) =>
        nodes.map((node) => [node.getAttribute('data-id'), (node as HTMLElement).style.transform])
      );
  const before = await positions();
  await runOptimize(page);
  const viewport = page.viewportSize();
  const statusHiddenByLayout =
    viewport !== null &&
    (viewport.width < 768 || (viewport.height <= 480 && viewport.width > viewport.height));
  if (!statusHiddenByLayout) {
    await expect(
      page.locator(
        '[data-testid="routing-status-partial"], [data-testid="routing-status-optimized"], [data-testid="routing-status-retained"], [data-testid="routing-status-stale"]'
      )
    ).toBeVisible();
  }
  expect(await positions()).toEqual(before);
  // Der Live-Pfad rechnet in `cableRouteStore` auf dem Hauptthread.
  // Ein Turbopack-Modul-Worker lässt die Bootstrap-Datei offen und
  // blockiert `networkidle` (axe auf `/planer/`). Der Client
  // `routingWorkerClient` bleibt unit-getestet, hängt aber nicht im Lauf.
  expect(errors).toEqual([]);
  // Ein zweiter Lauf auf derselben Eingabe bleibt gesperrt — in der Leiste
  // oder, auf schmalen Fenstern, im Überlaufmenü.
  const button = page.getByRole('button', { name: 'Kabel optimieren', exact: true });
  if (await button.isVisible()) {
    await expect(button).toBeDisabled();
  } else {
    await page.getByTestId('action-more').click();
    await expect(page.getByTestId('action-optimize-routing')).toBeDisabled();
  }
});
