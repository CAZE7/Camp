import { expect, test } from '@playwright/test';

import { autoWire, edgeCount, openPlanner, showCanvas } from './helpers';

const MAX_AUTARK_ROUTING_FINDINGS = 5;
const MAX_AUTARK_CRITICAL_FINDINGS = 3;

function criticalFindingCount(label: string): number {
  const match = label.match(/\b(\d+)(?:\s+von\s+\d+)?\s+kritisch\b/);
  return match ? Number(match[1]) : 0;
}

function routingFindingCount(testId: string | null, label: string | null): number {
  if (testId === 'routing-status-valid') return 0;
  if (testId !== 'routing-status-invalid') {
    throw new Error(`Autark did not reach a final routing status: ${testId ?? 'missing status'}`);
  }

  const match = label?.match(/\b(\d+)\s+Regelverletzung(?:en)?\b/);
  if (!match)
    throw new Error(`Could not read the visible routing finding count: ${label ?? 'missing label'}`);
  return Number(match[1]);
}

test('Autark-Vorlage bleibt nach „Automatisch verbinden“ innerhalb des sichtbaren Ratchets', async ({
  page,
}) => {
  await openPlanner(page);
  await showCanvas(page);

  const templateMenu = page.getByTestId('action-templates').first();
  await expect(templateMenu).toBeVisible();
  await templateMenu.click();
  const autarkTemplate = page.getByTestId('toolbar-template-autark');
  await expect(autarkTemplate).toBeVisible();
  await autarkTemplate.click();
  await showCanvas(page);

  // React Flow renders and measures the actual template nodes in the browser.
  await expect
    .poll(async () => page.locator('.react-flow__node:not(.react-flow__node-backboneGroup)').count())
    .toBeGreaterThan(10);
  const templateEdgeCount = await edgeCount(page);

  await autoWire(page);
  await expect
    .poll(async () => edgeCount(page), { message: 'Auto-Wire added no electrical connections' })
    .toBeGreaterThan(templateEdgeCount);

  const checkEntry = page.getByRole('button', { name: /Planungsprüfung öffnen/ });
  await expect(checkEntry).toBeVisible();
  await checkEntry.click();

  const report = page.getByRole('dialog', { name: 'Planungsprüfung' });
  await expect(report).toBeVisible();
  const routingStatus = report.locator(
    '[data-testid="routing-status-valid"], [data-testid="routing-status-invalid"]'
  );
  await expect(routingStatus).toBeVisible();

  const statusId = await routingStatus.getAttribute('data-testid');
  const statusLabel = await routingStatus.getAttribute('aria-label');
  const routingFindings = routingFindingCount(statusId, statusLabel);
  const criticalLabel = await checkEntry.getAttribute('aria-label');
  const criticalFindings = criticalFindingCount(criticalLabel ?? '');

  test.info().annotations.push({
    type: 'autark-routing-ratchet',
    description: `routing=${routingFindings}/${MAX_AUTARK_ROUTING_FINDINGS}; critical=${criticalFindings}/${MAX_AUTARK_CRITICAL_FINDINGS}`,
  });

  expect(
    routingFindings,
    `Nach Auto-Wire/Layout: ${routingFindings} sichtbare Routing-Befunde (Ratchet ≤ ${MAX_AUTARK_ROUTING_FINDINGS})`
  ).toBeLessThanOrEqual(MAX_AUTARK_ROUTING_FINDINGS);
  expect(
    criticalFindings,
    `Nach Auto-Wire/Layout: ${criticalFindings} kritische Planner-Befunde (Ratchet ≤ ${MAX_AUTARK_CRITICAL_FINDINGS})`
  ).toBeLessThanOrEqual(MAX_AUTARK_CRITICAL_FINDINGS);
});
