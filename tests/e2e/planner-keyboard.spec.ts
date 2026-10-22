import { expect, test, type Page } from '@playwright/test';

type ActiveElement = {
  testId: string | null;
  id: string | null;
  dataId: string | null;
  nodeId: string | null;
  handleId: string | null;
  className: string;
};

const NODE_SELECTOR = '.react-flow__node:not(.react-flow__node-backboneGroup)';

async function activeElement(page: Page): Promise<ActiveElement> {
  return page.evaluate(() => {
    const element = document.activeElement;
    return {
      testId: element?.getAttribute('data-testid') ?? null,
      id: element?.id ?? null,
      dataId: element?.getAttribute('data-id') ?? null,
      nodeId: element?.getAttribute('data-nodeid') ?? null,
      handleId: element?.getAttribute('data-handleid') ?? null,
      className: typeof element?.className === 'string' ? element.className : '',
    };
  });
}

async function focusSearchByTab(page: Page): Promise<void> {
  const search = page.getByTestId('sidebar-search');
  for (let index = 0; index < 120; index += 1) {
    if (await search.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Die Bauteilsuche war per Tab nicht erreichbar.');
}

async function focusSearchWithShiftTab(page: Page): Promise<void> {
  const search = page.getByTestId('sidebar-search');
  for (let index = 0; index < 8; index += 1) {
    if (await search.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Shift+Tab');
  }
  throw new Error('Von der Bauteilzeile führte Shift+Tab nicht zur Bauteilsuche.');
}

async function addByKeyboard(page: Page, query: string, componentType: string): Promise<void> {
  const search = page.getByTestId('sidebar-search');
  if (!(await search.evaluate((element) => element === document.activeElement))) {
    await focusSearchWithShiftTab(page);
  }

  const before = await page.locator(NODE_SELECTOR).count();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(query);
  await page.keyboard.press('Enter');

  const tile = page.locator(`[data-testid="sidebar-item"][data-component-type="${componentType}"]`).first();
  await expect(tile).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.locator(NODE_SELECTOR).count()).toBe(before + 1);
  await expect(tile).toBeFocused();
}

async function focusByTab(
  page: Page,
  matches: (active: ActiveElement) => boolean,
  description: string,
  maxTabs = 240
): Promise<void> {
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press('Tab');
    if (matches(await activeElement(page))) return;
  }
  throw new Error(`Kein Tastaturfokus auf ${description} nach ${maxTabs} Tab-Schritten.`);
}

test.describe('Planer-Canvas: kompletter Mini-Plan nur per Tastatur', () => {
  test('Bauteile hinzufügen, verbinden, verschieben und löschen ohne Zeigeraktion', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-1440',
      'Die Tastatur-Interaktion wird einmal im Desktop-Projekt geprüft.'
    );

    // Vorhandenes leeres Projekt und abgeschlossene Einführung: Das ist nur
    // die Test-Fixture; jede Planänderung danach erfolgt ausschließlich über
    // Tab, Eingabe, Pfeiltasten, Entf und Escape.
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem(
        'elektroplaner-planner-v1',
        JSON.stringify({
          state: {
            nodes: [],
            edges: [],
            waterNodes: [],
            waterEdges: [],
            viewMode: 'electric',
            season: 'summer',
            isSidebarOpen: true,
          },
          version: 1,
        })
      );
      localStorage.setItem(
        'elektroplaner-preferences-v1',
        JSON.stringify({ state: { calculatedSolarWatts: 0, hasOnboarded: true }, version: 2 })
      );
    });
    await page.goto('/planer/');
    await expect(page.getByTestId('planner-shell')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(NODE_SELECTOR)).toHaveCount(0);
    await expect(page.getByTestId('sidebar-search')).toBeVisible();

    // Start at the document and reach the catalog by normal Tab navigation.
    await focusSearchByTab(page);
    await addByKeyboard(page, 'Batterie', 'battery');
    const batteryId = await page.locator('.react-flow__node-battery').getAttribute('data-id');
    expect(batteryId).toBeTruthy();

    await addByKeyboard(page, 'Sammelschiene', 'busbar');
    const busbars = page.locator('.react-flow__node-busbar');
    await expect(busbars).toHaveCount(1);
    const busbarId = await busbars.first().getAttribute('data-id');
    expect(busbarId).toBeTruthy();

    await addByKeyboard(page, 'Sammelschiene', 'busbar');
    await expect(busbars).toHaveCount(2);
    const removableBusbarId = await busbars.nth(1).getAttribute('data-id');
    expect(removableBusbarId).toBeTruthy();

    // Tab to the positive battery output; Enter selects the first endpoint.
    await focusByTab(
      page,
      (active) =>
        active.nodeId === batteryId && active.handleId === 'plus' && active.className.includes(' source'),
      'Batterie-Plus-Ausgang'
    );
    const batteryOutput = page.locator(
      `.react-flow__handle.source[data-nodeid="${batteryId}"][data-handleid="plus"]`
    );
    await expect(batteryOutput).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(batteryOutput).toHaveClass(/tap-connect-selected/);

    // Continue by Tab to the positive busbar input and complete the wire.
    await focusByTab(
      page,
      (active) =>
        active.nodeId === busbarId && active.handleId === 'plus' && active.className.includes(' target'),
      'Plus-Eingang der Sammelschiene'
    );
    const busbarInput = page.locator(
      `.react-flow__handle.target[data-nodeid="${busbarId}"][data-handleid="plus"]`
    );
    await page.keyboard.press('Enter');
    await expect.poll(() => page.locator('.react-flow__edge').count()).toBe(1);
    await expect(busbarInput).not.toHaveClass(/tap-connect-selected/);

    // Select the second, unconnected busbar by keyboard and move it with an
    // arrow key. This exercises React Flow's actual node keyboard handler.
    await focusByTab(
      page,
      (active) => active.dataId === removableBusbarId && active.className.includes('react-flow__node '),
      'zweite Sammelschiene'
    );
    const removableBusbar = page.locator(`.react-flow__node[data-id="${removableBusbarId}"]`);
    const positionBefore = await removableBusbar.evaluate((element) => element.style.transform);
    await page.keyboard.press('Enter');
    await expect(removableBusbar).toHaveClass(/selected/);
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(() => removableBusbar.evaluate((element) => element.style.transform))
      .not.toBe(positionBefore);

    // The ? help opens as a real keyboard dialog: focus moves inside, Tab is
    // trapped, and Escape returns focus to the selected canvas object.
    const focusBeforeHelp = await page.evaluateHandle(() => document.activeElement);
    // The browser API accepts the resulting key value directly; this is the
    // `?` keystroke produced by Shift+/ on a physical keyboard.
    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: 'Tastaturkürzel' });
    await expect(help).toBeVisible();
    const closeHelp = help.getByRole('button', { name: 'Tastaturkürzel schließen' });
    await expect(closeHelp).toBeFocused();
    await expect(help).toContainText('Verbindung beginnen oder abschließen');
    await expect(help).toContainText('Ausgewähltes Bauteil verschieben');
    await page.keyboard.press('Tab');
    await expect(closeHelp).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
    expect(await page.evaluate((element) => document.activeElement === element, focusBeforeHelp)).toBe(true);
    await focusBeforeHelp.dispose();

    // Entf asks for confirmation. Confirm it from the keyboard and preserve
    // the connected two-node mini-plan.
    await page.keyboard.press('Delete');
    const confirmation = page.getByRole('dialog', { name: 'Bitte bestätigen' });
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
    await page.keyboard.press('Tab');
    const proceed = confirmation.getByRole('button', { name: 'Fortfahren' });
    await expect(proceed).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(confirmation).toBeHidden();
    await expect(removableBusbar).toHaveCount(0);
    await expect(page.locator(NODE_SELECTOR)).toHaveCount(2);
    await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  });
});
