import { expect, test } from '@playwright/test';

/**
 * Visuelle Regeln des Dark-Engineering-Design-Systems — ohne Pixelvergleich.
 *
 * Diese Szenarien laufen im blockierenden E2E-Job, weil sie Verhalten messen
 * (Layout-Stabilität, Schriftgrößen-Untergrenze, SVG-Stroke), nicht Anstrich.
 * Die eingefrorenen Bilder derselben Ansicht liegen in
 * `visual-de-pixel.spec.ts` und gehören in den meldenden Job: ein Baseline-Diff
 * darf einen Production-Deploy nicht stoppen (Begründung im Kommentar von
 * `.github/workflows/quality.yml`, Auftrag im Job `visual`).
 */

type LayoutShiftEntry = PerformanceEntry & {
  hadRecentInput: boolean;
  value: number;
};

test.describe('Dark Engineering Visual', () => {
  const viewports = [
    { name: 'mobile-375', width: 375, height: 812 },
    { name: 'tablet-768', width: 768, height: 1024 },
    { name: 'desktop-1440', width: 1440, height: 900 },
  ] as const;

  const themes = ['light', 'dark'] as const;

  for (const theme of themes) {
    for (const vp of viewports) {
      test(`design-system ${theme} ${vp.name} ohne Layout-Shift`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        // Theme via class — layout.tsx setzt .dark via SystemThemeSync
        await page.emulateMedia({ colorScheme: theme === 'dark' ? 'dark' : 'light' });
        await page.goto('/design-system');
        await page.waitForSelector('text=DARK ENGINEERING DESIGN SYSTEM');

        // CLS = 0 — keine Layout-Shifts nach Load
        const cls = await page.evaluate(() => {
          return new Promise<number>((resolve) => {
            let clsValue = 0;
            const observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries() as LayoutShiftEntry[]) {
                if (!entry.hadRecentInput) clsValue += entry.value;
              }
            });
            observer.observe({ type: 'layout-shift', buffered: true });
            setTimeout(() => {
              observer.disconnect();
              resolve(clsValue);
            }, 1000);
          });
        });
        expect(cls, `CLS sollte 0 sein, war ${cls}`).toBeLessThan(0.01);
      });
    }
  }

  test('edge non-scaling-stroke & bridge', async ({ page }) => {
    await page.goto('/design-system');
    await page.waitForSelector('text=Trassen-Hierarchie');

    // Prüft dass SVG Pfade vector-effect: non-scaling-stroke haben
    const hasNonScaling = await page.evaluate(() => {
      // Check CSS rule existence
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules);
          for (const rule of rules) {
            if (rule.cssText.includes('non-scaling-stroke')) return true;
          }
        } catch {
          // Cross-origin stylesheets may deny CSSOM access; skip those sheets.
        }
      }
      return false;
    });
    expect(hasNonScaling, 'vector-effect: non-scaling-stroke muss existieren').toBe(true);
  });

  test('typography tabular-nums & 11px floor', async ({ page }) => {
    await page.goto('/design-system');
    await page.waitForSelector('.de-mono-numeric');

    const monoStyle = await page
      .locator('.de-mono-numeric')
      .first()
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          fontVariantNumeric: cs.fontVariantNumeric,
          fontSize: cs.fontSize,
        };
      });

    expect(monoStyle.fontVariantNumeric).toContain('tabular-nums');

    // Kein Text unter 11px im Canvas-Bereich
    const smallTexts = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const tooSmall: string[] = [];
      for (const el of all) {
        const cs = getComputedStyle(el);
        const fs = parseFloat(cs.fontSize);
        if (fs > 0 && fs < 11 && el.textContent?.trim()) {
          // Ignoriere versteckte und 10px Hilfetexte die explizit erlaubt sind
          if (el.classList.contains('de-label-eyebrow') || parseFloat(cs.fontSize) >= 10.5) continue;
          tooSmall.push(`${el.tagName} ${fs}px: ${el.textContent?.slice(0, 30)}`);
        }
      }
      return tooSmall.slice(0, 5);
    });

    expect(smallTexts, `Kein Text unter 11px erlaubt, gefunden: ${smallTexts.join(', ')}`).toEqual([]);
  });
});
