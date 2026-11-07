import { expect, test } from '@playwright/test';

import { openPlanner, showCanvas } from './helpers';

/**
 * tests/e2e/autowire-reachable.spec.ts
 *
 * Nutzer-Befund 2026-11-06: „Der Automatisch-verbinden-Button ist weg und ich
 * brauche dieses Planen/Prüfen-Ding nicht."
 *
 * Ursache: `.cad-autowire-phone { display: none }` in `app/globals.css`, mit
 * `display: inline-flex` nur unter 480 px. Im geführten Modus hing der Knopf an
 * dieser Klasse und war auf Desktop damit im DOM, aber unsichtbar. Die
 * Schrittleiste war der einzige Zugang — sie ist jetzt entfernt.
 *
 * WARUM EIN BROWSERTEST: Der Defekt stand in einer Medienabfrage, nicht im
 * Markup. jsdom rechnet keine Stylesheets, `toBeInTheDocument()` war also grün,
 * während der Nutzer keinen Knopf sah. Geprüft wird hier die **gerenderte
 * Sichtbarkeit** (`toBeVisible`) und der tatsächliche Klickpfad.
 *
 * Der zweite Fall stellt den Zustand des Nutzers nach: gespeichertes
 * `guidedMode: true` aus einer früheren Sitzung. Genau dieser Altbestand hat
 * den Knopf verschwinden lassen, und genau deshalb wurde die Leiste ganz
 * entfernt statt nur standardmäßig abgeschaltet.
 */

const PLANNER_KEY = 'elektroplaner-planner-v1';

test.describe('Auto-Verbinden ist auffindbar, keine Schrittleiste', () => {
  test('Knopf steht sichtbar in der Werkzeugleiste und trägt seinen Namen', async ({ page }) => {
    await openPlanner(page);
    await showCanvas(page);

    const button = page.getByTestId('action-autowire').first();
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();

    // Die Schrittleiste ist ersatzlos entfernt. Geprüft wird über ihre
    // ehemalige Zugänglichkeits-Marke (`<nav aria-label="Planungsablauf">`)
    // statt über ein gelöschtes `data-testid`: Der Selektorvertrag
    // (`components/e2eSelectors.test.tsx`) verlangt zu Recht, dass jede in
    // tests/e2e benutzte Kennung auch gerendert wird.
    await expect(page.getByRole('navigation', { name: 'Planungsablauf' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Freie Bearbeitung öffnen' })).toHaveCount(0);

    // Der zugängliche Name muss den sichtbaren Text enthalten (WCAG 2.5.3),
    // sonst trifft Sprachsteuerung den Knopf nicht.
    await expect(button).toHaveAccessibleName(/Automatisch verbinden/);

    // Ab 520 px steht der volle Name. Die übrigen Beschriftungsstufen bleiben
    // per CSS ausgeblendet im DOM, deshalb wird die GERENDERTE Beschriftung
    // gemessen (Layout-Box vorhanden) statt der rohe `textContent` verglichen.
    // Messung statt Styling-Klasse wahrt die Selektorregel aus AGENTS.md K5.
    const width = page.viewportSize()?.width ?? 0;
    if (width >= 520) {
      await expect
        .poll(() =>
          button.evaluate((element) =>
            Array.from(element.querySelectorAll('span'))
              .filter((span) => span.getClientRects().length > 0)
              .map((span) => span.textContent ?? '')
              .join(' ')
          )
        )
        .toContain('Automatisch verbinden');
    }

    // Der Knopf liegt in der Leiste und wird nicht abgeschnitten.
    const toolbar = page.getByTestId('planner-toolbar');
    const buttonBox = await button.boundingBox();
    const toolbarBox = await toolbar.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(toolbarBox).not.toBeNull();
    if (buttonBox && toolbarBox) {
      expect(buttonBox.x).toBeGreaterThanOrEqual(toolbarBox.x - 1);
      expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(toolbarBox.x + toolbarBox.width + 1);
    }
  });

  test('gespeicherter geführter Modus versteckt den Knopf nicht mehr', async ({ page }) => {
    // Altbestand: Der Nutzer hatte den geführten Modus aktiv. Beim Laden wird
    // das Feld über `persistence.ts` übernommen — vorher der Auslöser.
    await page.addInitScript(
      ([key]) => {
        window.localStorage.setItem(
          key as string,
          JSON.stringify({ state: { guidedMode: true, viewMode: 'electric' }, version: 1 })
        );
      },
      [PLANNER_KEY]
    );

    await openPlanner(page);
    await showCanvas(page);

    await expect(page.getByTestId('action-autowire').first()).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Planungsablauf' })).toHaveCount(0);
  });
});
