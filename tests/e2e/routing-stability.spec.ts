import { expect, test, type Page } from '@playwright/test';
import complexPlan from '../../knownPlans/complex.json';
import { openPlanner, showCanvas } from './helpers';

const plan = complexPlan.autoWire as {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
};

type TraceEvent = Record<string, unknown> & {
  event?: string;
  epochMs?: number;
  cableCount?: number;
  triggerStateChange?: { kind?: string; routingInputChanged?: boolean };
};

async function readRoutingTrace(page: Page): Promise<TraceEvent[]> {
  return page.evaluate(() => {
    const debugWindow = window as unknown as { __PLANNER_ROUTING_TRACE__?: TraceEvent[] };
    return debugWindow.__PLANNER_ROUTING_TRACE__ ?? [];
  });
}

/** Wait for the real input/route trace to become quiescent (not a fixed sleep). */
async function waitForRoutingTraceToSettle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const debugWindow = window as unknown as { __PLANNER_ROUTING_TRACE__?: TraceEvent[] };
      const events = debugWindow.__PLANNER_ROUTING_TRACE__ ?? [];
      const inputs = events.filter((event) => event.event === 'input-change');
      const lastInput = inputs.at(-1);
      const latestRoute = events.filter((event) => event.event === 'route-result').at(-1);
      const lastEvent = events.at(-1);
      const routeCaughtUp =
        lastInput?.triggerStateChange?.routingInputChanged !== true ||
        (latestRoute?.epochMs ?? 0) >= (lastInput?.epochMs ?? Number.POSITIVE_INFINITY);
      return (
        lastInput !== undefined &&
        latestRoute !== undefined &&
        routeCaughtUp &&
        Date.now() - (lastEvent?.epochMs ?? Date.now()) >= 300
      );
    },
    undefined,
    { timeout: 30_000 }
  );
}

async function routeResultCount(page: Page): Promise<number> {
  const events = await readRoutingTrace(page);
  return events.filter((event) => event.event === 'route-result').length;
}

async function verifyPresentationInteractions(page: Page): Promise<void> {
  const persistedState = JSON.stringify({
    state: {
      nodes: plan.nodes,
      edges: plan.edges,
      viewMode: 'electric',
      backboneGrouping: true,
    },
    version: 1,
  });

  const appPreferences = JSON.stringify({
    state: { calculatedSolarWatts: 0, hasOnboarded: true },
    version: 2,
  });

  await page.addInitScript(
    ({ plannerState, preferences }) => {
      localStorage.setItem('werft-planner-v1', plannerState);
      localStorage.setItem('werft-app-preferences-v1', preferences);
      const debugWindow = window as unknown as {
        __PLANNER_ROUTING_DEBUG__?: boolean;
        __PLANNER_ROUTING_TRACE__?: TraceEvent[];
      };
      debugWindow.__PLANNER_ROUTING_DEBUG__ = true;
      debugWindow.__PLANNER_ROUTING_TRACE__ = [];
    },
    { plannerState: persistedState, preferences: appPreferences }
  );

  await openPlanner(page);
  await showCanvas(page);
  await expect(
    page.locator('[data-testid="routing-status-valid"], [data-testid="routing-status-invalid"]')
  ).toBeVisible();
  await waitForRoutingTraceToSettle(page);

  const beforePresentation = await routeResultCount(page);
  expect(beforePresentation).toBeGreaterThan(0);

  const displayOptions = page.getByTestId('canvas-display-options');
  if (await displayOptions.isVisible()) await displayOptions.click();
  const backboneToggle = page.getByRole('button', { name: 'Hauptstromkreis' });
  await expect(backboneToggle).toBeVisible();

  await backboneToggle.click();
  await expect(page.locator('.react-flow__node[data-id="__planner-backbone-group"]')).toHaveCount(0);
  await waitForRoutingTraceToSettle(page);
  expect(await routeResultCount(page)).toBe(beforePresentation);

  let trace = await readRoutingTrace(page);
  expect(
    trace.some(
      (event) =>
        event.event === 'input-change' &&
        event.triggerStateChange?.kind === 'presentation-only-change' &&
        event.triggerStateChange.routingInputChanged === false
    )
  ).toBe(true);

  await backboneToggle.click();
  await expect(page.locator('.react-flow__node[data-id="__planner-backbone-group"]')).toHaveCount(1);
  await waitForRoutingTraceToSettle(page);
  expect(await routeResultCount(page)).toBe(beforePresentation);

  // Selecting and visually tracing a real component can replace presentation
  // wrappers, but must not cause the planner to recalculate cable geometry.
  await page.locator('.react-flow__node[data-id="battery-1"]').click({ force: true });
  await waitForRoutingTraceToSettle(page);
  expect(await routeResultCount(page)).toBe(beforePresentation);

  const pane = page.locator('.react-flow__pane');
  const bounds = await pane.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds) {
    await page.mouse.move(bounds.x + bounds.width - 24, bounds.y + bounds.height - 24);
    await page.mouse.wheel(0, -240);
    await page.mouse.move(bounds.x + bounds.width - 32, bounds.y + bounds.height - 32);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width - 72, bounds.y + bounds.height - 60);
    await page.mouse.up();
  }
  await waitForRoutingTraceToSettle(page);
  expect(await routeResultCount(page)).toBe(beforePresentation);

  trace = await readRoutingTrace(page);
  const routeResult = trace.filter((event) => event.event === 'route-result').at(-1);
  expect(routeResult?.cableCount).toBe(plan.edges.length);
}

test('presentation interactions do not re-route the electrical graph', async ({ page }, testInfo) => {
  let events: TraceEvent[] = [];
  let traceCaptureError: string | null = null;

  try {
    await verifyPresentationInteractions(page);
  } finally {
    if (!page.isClosed()) {
      try {
        events = await readRoutingTrace(page);
      } catch (error) {
        traceCaptureError = error instanceof Error ? error.message : String(error);
      }
    } else {
      traceCaptureError = 'Page closed before the routing trace could be read.';
    }

    await testInfo.attach('routing-trace', {
      body: JSON.stringify(
        {
          schemaVersion: 1,
          test: testInfo.title,
          project: testInfo.project.name,
          retry: testInfo.retry,
          status: testInfo.status,
          expectedStatus: testInfo.expectedStatus,
          durationMs: testInfo.duration,
          traceCaptureError,
          events,
        },
        null,
        2
      ),
      contentType: 'application/json',
    });
  }
});
