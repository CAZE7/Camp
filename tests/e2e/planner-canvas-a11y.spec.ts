import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function openExampleCanvas(page: Page): Promise<void> {
  await page.goto('/planer/');
  await expect(page.getByTestId('planner-shell')).toBeVisible({ timeout: 30_000 });
  const dialog = page.getByRole('dialog');
  await dialog
    .first()
    .waitFor({ state: 'visible', timeout: 8_000 })
    .catch(() => undefined);
  if ((await dialog.count()) > 0) {
    // Close the introduction without choosing “empty plan”: the example's
    // real nodes and connection ports are the accessibility test fixture.
    await dialog.getByRole('button', { name: 'Dialog schließen' }).click();
  }
  await expect(page.locator('.react-flow__node:not(.react-flow__node-backboneGroup)').first()).toBeVisible({
    timeout: 15_000,
  });
  // Handy-Hülle: Die Startansicht ist „Bauteile“, die Zeichenfläche darunter
  // ist `inert` (Spec §5) — ohne den Wechsel zum Schaltplan ist kein Knoten
  // fokussierbar.
  const schaltplan = page.getByTestId('nav-tab-schaltplan');
  if (await schaltplan.isVisible().catch(() => false)) await schaltplan.click();
}

test.describe('Planer-Canvas: Barrierefreiheit', () => {
  test('axe: Bauteile, Anschlussflächen und Plansteuerung ohne schwere Verstöße', async ({ page }) => {
    await openExampleCanvas(page);

    const handles = page.locator('.react-flow__handle.connectable');
    await expect(handles.first()).toHaveAttribute('role', 'button');
    await expect(handles.first()).toHaveAttribute('aria-label', /Eingabetaste oder Leertaste/);
    const descriptionId = await page
      .locator('.react-flow__node:not(.react-flow__node-backboneGroup)')
      .first()
      .getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    await expect(page.locator(`[id="${descriptionId}"]`)).toContainText('Pfeiltasten');

    const result = await new AxeBuilder({ page })
      .include('.react-flow')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    const blocking = result.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious'
    );

    expect(
      blocking,
      blocking
        .map(
          (violation) =>
            `${violation.id} (${violation.impact}): ${violation.help}\n  → ` +
            violation.nodes.map((node) => String(node.target).slice(0, 140)).join('\n  → ')
        )
        .join('\n')
    ).toEqual([]);
  });

  test('§3.6: genau eine Bauteil-Gruppe pro Knoten, deutsch benannt', async ({ page }) => {
    await openExampleCanvas(page);
    const knoten = page.locator('.react-flow__node');
    const anzahl = await knoten.count();
    expect(anzahl, 'das Beispiel muss Knoten auf der Zeichenfläche haben').toBeGreaterThan(0);

    let gruppen = 0;
    for (let index = 0; index < anzahl; index += 1) {
      const wrapper = knoten.nth(index);
      // §3.6 Punkt 3: die Rolle kommt von der Bibliothek, aber nur für
      // fokussierbare Knoten. Dekoration (der Backbone-Rahmen) ist nicht
      // fokussierbar und soll deshalb ausdrücklich keine Gruppe sein.
      if ((await wrapper.getAttribute('role')) !== 'group') {
        await expect(wrapper).not.toHaveAttribute('aria-roledescription', 'Bauteil');
        continue;
      }
      gruppen += 1;
      await expect(wrapper, `Knoten ${index} ohne lokale Rollenbeschreibung`).toHaveAttribute(
        'aria-roledescription',
        'Bauteil'
      );
      const name = await wrapper.getAttribute('aria-label');
      expect((name ?? '').trim(), `Knoten ${index} ohne Accessible Name`).not.toBe('');
      // aria-selected kennt die Rolle group nicht; der Zustand sitzt im Namen.
      await expect(wrapper).not.toHaveAttribute('aria-selected');
      // Genau ein Group-Element je Bauteil: in der Karte darf keine zweite stecken.
      expect(await wrapper.locator('[role="group"]').count(), `Knoten ${index} mit zweiter Gruppe`).toBe(0);
      const karte = wrapper.locator('.node-card');
      if ((await karte.count()) > 0) {
        await expect(karte.first()).not.toHaveAttribute('role');
        await expect(karte.first()).not.toHaveAttribute('aria-label');
      }
    }
    expect(gruppen, 'mindestens ein Bauteil muss eine Gruppe sein').toBeGreaterThan(0);
  });

  test('§3.6: Tastaturauswahl kündigt den Zustand im Namen an', async ({ page }) => {
    await openExampleCanvas(page);
    const alle = page.locator('.react-flow__node');
    const anzahl = await alle.count();
    // Gesucht wird ein Bauteil, das **nicht** schon ausgewählt ist — sonst
    // bewiese der Test nichts.
    let ziel = null;
    for (let index = 0; index < anzahl; index += 1) {
      const kandidat = alle.nth(index);
      if ((await kandidat.getAttribute('role')) !== 'group') continue;
      if (!(await kandidat.getAttribute('aria-label'))?.includes('ausgewählt')) {
        ziel = kandidat;
        break;
      }
    }
    expect(ziel, 'mindestens ein Bauteil ist unausgewählt').not.toBeNull();
    await ziel!.focus();
    await page.keyboard.press('Enter');
    await expect(ziel!).toHaveAttribute('aria-label', /ausgewählt/);
    await expect(ziel!).not.toHaveAttribute('aria-selected');
  });

  test('nicht verbindbare interne Handles sind keine Tastatur- oder Screenreader-Stopps', async ({
    page,
  }) => {
    await openExampleCanvas(page);
    // Auf dem Handy liegt der Katalog hinter „Hinzufügen“ in der Ansicht
    // Bauteile (Spezifikation §6.1); ab 768 px ist er eine Spalte.
    const sidebarTab = page.getByTestId('nav-tab-bauteile');
    if (await sidebarTab.isVisible()) {
      await sidebarTab.click();
      const add = page.getByTestId('phone-add');
      if (await add.isVisible()) await add.click();
    }
    const search = page.getByTestId('sidebar-search');
    await search.fill('Leerrohr');
    const conduit = page.locator('[data-testid="sidebar-item"][data-component-type="conduit"]').first();
    await expect(conduit).toBeVisible();
    await conduit.click();
    await expect(page.locator('.react-flow__node-conduit')).toHaveCount(1);

    const internalHandles = page.locator('.react-flow__handle[aria-hidden="true"]');
    await expect(internalHandles).toHaveCount(2);
    for (let index = 0; index < (await internalHandles.count()); index += 1) {
      await expect(internalHandles.nth(index)).toHaveAttribute('tabindex', '-1');
      await expect(internalHandles.nth(index)).not.toHaveAttribute('role', 'button');
    }
  });

  test('§11: die sichtbare Planer-Wortmarke hat eine 44-px-Trefferhöhe', async ({ page }) => {
    await openExampleCanvas(page);
    const home = page.locator('.cad-menubar__home');
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    // Auf dem Telefon ersetzt der 44-px-Menüknopf die gesamte Menüleiste.
    if (viewport!.width < 768) {
      await expect(home).toBeHidden();
      return;
    }

    await expect(home).toBeVisible();
    const box = await home.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('globale reduzierte Bewegung', () => {
  test('respektiert prefers-reduced-motion auf allen Viewports', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/planer/');
    await expect(page.getByTestId('planner-shell')).toBeVisible({ timeout: 30_000 });

    const motion = await page.evaluate(() => {
      const button = document.querySelector('button');
      return {
        preference: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
        transitionDuration: button ? getComputedStyle(button).transitionDuration : '',
        animationIterations: button ? getComputedStyle(button).animationIterationCount : '',
      };
    });

    expect(motion.preference).toBe(true);
    expect(motion.scrollBehavior).toBe('auto');
    expect(Number.parseFloat(motion.transitionDuration)).toBeLessThanOrEqual(0.00001);
    expect(motion.animationIterations).toBe('1');
  });
});
