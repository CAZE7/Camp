import { expect, test, type Page } from '@playwright/test';

/**
 * Phase-9-Regression-Gate (Design-Audit, siehe DESIGN-AUDIT.md Abschnitt 8).
 *
 * Alle Fixes F1–F28 sind angewendet (siehe DESIGN-AUDIT.md Abschnitt 11). Das Gate bleibt
 * Opt-in, bis es einmal komplett in einem Browser-Environment grün gelaufen ist
 * (Sandbox-Hinweis: Chromium-Laufzeit fehlte):
 *   DESIGN_AUDIT_GATE=1 npx playwright test tests/e2e/design-audit.spec.ts
 * Nach dem ersten grünen Lauf: `test.skip(!GATE, …)`-Zeilen entfernen, damit es im
 * CI-Normalbetrieb scharf schaltet.
 */

const GATE = process.env.DESIGN_AUDIT_GATE === '1';

const BREAKPOINTS = [320, 375, 390, 768, 1024, 1280, 1440, 1920] as const;

const MARKETING_PAGES = [
  '/',
  '/tools/dach/',
  '/tools/heizung/',
  '/guides/ausbau-fahrplan/',
  '/guides/camper-ausbauguide/',
  '/guides/holzausbau/',
  '/impressum/',
  '/datenschutz/',
] as const;

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, `horizontaler Overflow von ${overflow} px`).toBeLessThanOrEqual(1);
}

test.describe('Design-Gate: Marketing-Seiten (Seite × Breakpoint)', () => {
  test.skip(!GATE, 'Aktivieren mit DESIGN_AUDIT_GATE=1 (nach Fixes F1/F2/F5/F8/F14/F17)');

  for (const path of MARKETING_PAGES) {
    for (const width of BREAKPOINTS) {
      test(`${path} @${width}px: 1 H1 in Fraunces, kein Overflow`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        await expectNoHorizontalOverflow(page);
        await expect(page.locator('h1')).toHaveCount(1);

        const font = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily);
        expect(font, 'H1 muss im Fraunces-System sein (F1)').toContain('Fraunces');

        if (path === '/tools/dach/') {
          const controls = page.locator('.react-flow__controls button');
          const sizes = await controls.evaluateAll((els) =>
            els.map((el) => {
              const r = el.getBoundingClientRect();
              return Math.min(r.width, r.height);
            })
          );
          for (const size of sizes) expect(size, 'Dach-Controls ≥ 32 px (F14)').toBeGreaterThanOrEqual(32);
        }

        if (path === '/tools/heizung/' || path === '/tools/dach/') {
          const h = await page
            .locator('[role="combobox"]')
            .first()
            .evaluate((el) => el.getBoundingClientRect().height);
          expect(h, 'Select-Trigger ≥ 44 px (F17)').toBeGreaterThanOrEqual(44);
        }
      });
    }
  }
});

test.describe('Design-Gate: Planner', () => {
  test.skip(!GATE, 'Aktivieren mit DESIGN_AUDIT_GATE=1');

  for (const width of [320, 375, 1280, 1440] as const) {
    test(`Planner @${width}px: h1 vorhanden, Toolbar ≥ 44 px, kein Overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/elektrik-planung/');
      await expect(page.getByTestId('planner-shell')).toBeVisible({ timeout: 30000 });

      await expect(page.locator('h1'), 'sr-only h1 (F18)').toHaveCount(1);
      await expectNoHorizontalOverflow(page);

      const toolbarButtons = page.locator('[data-testid^="toolbar-"]');
      if (width >= 1280) {
        const sizes = await toolbarButtons.evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return Math.min(r.width, r.height);
          })
        );
        for (const size of sizes)
          expect(size, 'Toolbar-Buttons ≥ 44 px, auch @1280 (F13)').toBeGreaterThanOrEqual(44);
      }
    });
  }
});

test.describe('Design-Gate: Static-Server-404', () => {
  test.skip(!GATE, 'Aktivieren mit DESIGN_AUDIT_GATE=1');

  test('unbekannter Pfad mit trailing slash liefert 404 (F26)', async ({ request }) => {
    const res = await request.get('/gibt-es-nicht/');
    expect(res.status(), '200 mit Home ist der F26-Regressionsfall').toBe(404);
    expect((await res.text()).toLowerCase()).toContain('fehler 404');
  });
});
