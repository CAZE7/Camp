import { expect, test } from '@playwright/test';
import simplePlan from '../../knownPlans/simple.json';
import { openPlanner, showCanvas } from './helpers';

test('worker routing and explicit optimization leave device positions unchanged', async ({ page }) => {
  let workers = 0;
  page.on('worker', () => {
    workers++;
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((plan) => {
    localStorage.setItem(
      'werft-planner-v1',
      JSON.stringify({ state: { nodes: plan.nodes, edges: plan.edges, viewMode: 'electric' }, version: 1 })
    );
    localStorage.setItem(
      'werft-app-preferences-v1',
      JSON.stringify({ state: { calculatedSolarWatts: 0, hasOnboarded: true }, version: 2 })
    );
  }, simplePlan.autoWire);
  await openPlanner(page);
  await showCanvas(page);
  const button = page.getByRole('button', { name: 'Kabel optimieren', exact: true });
  await expect(button).toBeEnabled();
  const positions = () =>
    page
      .locator('.react-flow__node')
      .evaluateAll((nodes) =>
        nodes.map((node) => [node.getAttribute('data-id'), (node as HTMLElement).style.transform])
      );
  const before = await positions();
  await button.click();
  await expect(
    page.locator(
      '[data-testid="routing-status-partial"], [data-testid="routing-status-optimized"], [data-testid="routing-status-retained"], [data-testid="routing-status-stale"]'
    )
  ).toBeVisible();
  await expect(button).toBeDisabled();
  expect(await positions()).toEqual(before);
  expect(workers).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  // Verify no second optimization is permitted for this unchanged input.
  await expect(button).toBeDisabled();
});
