import { expect, test } from '@playwright/test';

import { PLANNER_URL } from './helpers';

/**
 * tests/e2e/rendered-contrast.spec.ts — AP-2 Wächter auf GEMALTE Elemente.
 *
 * Der Token-Guard in `lib/designTokens.test.ts` rechnet mit deklarierten Werten
 * aus globals.css. Genau das hat zweimal hintereinander falsche Sicherheit
 * gegeben: die Legacy-Map in `app/dark-engineering.css` lag unlayered über dem
 * `@layer base`-Block und hat fünf Leitungsrollen überschrieben, ohne dass der
 * Guard es sah (gemessen 03.11.2026: deklariert #f87171, gemalt #ff6b6b).
 *
 * Dieser Test fragt deshalb NICHTS ab, was in einer CSS-Datei steht. Er liest
 * die computed styles der tatsächlich gemalten Pfade, der Legendenproben und
 * der Flächen und rechnet den Kontrast gegen die Fläche, die wirklich dahinter
 * liegt. WCAG 1.4.11 (nicht-textuelle Inhalte) verlangt 3:1 für Leitungen.
 */

/**
 * Die Legende liegt im Inspector und der ist immer eingeklappt gestartet —
 * gemessen über 375, 768, 1024 und 1440 px: der Schalter
 * „Rechte Sidebar ausklappen“ (PlannerInspector.tsx) existiert auf jeder
 * Breite ab 1280 px; auf dem Handy öffnet `phone-open-detail` in der
 * Werkzeugzone des Schaltplans dieselbe Ebene (Spezifikation §6.2).
 *
 * Wichtig: Die Legende steht im Zustand „Kein Element ausgewählt“
 * (Inspector.tsx: EmptySelection → RoutingLegend). Wer für die Legende ein
 * Bauteil anklickt, blendet sie wieder aus.
 */
async function zeigeLegende(page: import('@playwright/test').Page): Promise<boolean> {
  const legende = page.locator('.cad-routing-legend').first();
  if (await legende.isVisible().catch(() => false)) return true;

  const handle = page.getByRole('button', { name: /Rechte Sidebar ausklappen/ });
  const reiter = page.getByTestId('phone-open-detail');
  if (await handle.isVisible().catch(() => false)) {
    await handle.click();
  } else if (await reiter.isVisible().catch(() => false)) {
    await page.getByTestId('nav-tab-schaltplan').click();
    await reiter.click();
  } else {
    return false;
  }
  await expect(legende).toBeVisible({ timeout: 15_000 });
  return true;
}

function toRgb(hex: string): [number, number, number] {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`kein 6-stelliges Hex: ${hex}`);
  const s = m[1] ?? '';
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number];
}

function relativLuminanz(hex: string): number {
  const [r, g, b] = toRgb(hex);
  const linear = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function kontrast(a: string, b: string): number {
  const x = relativLuminanz(a);
  const y = relativLuminanz(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test.describe('Kontrast gemalter Elemente', () => {
  test('die Kontrastrechnung selbst ist korrekt', () => {
    // Ohne diesen Nachweis ist jede Zahl weiter unten wertlos.
    expect(kontrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(kontrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  for (const schema of ['hell', 'dunkel'] as const) {
    test(`Leitungen halten 3:1 auf der gemalten Zeichenfläche (${schema})`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: schema === 'dunkel' ? 'dark' : 'light' });
      await page.goto(`${PLANNER_URL}?template=kastenwagen`);
      await expect(page.getByTestId('planner-shell')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.react-flow__edge').first()).toBeAttached({ timeout: 30_000 });

      const mess = await page.evaluate(() => {
        const hex = (value: string) => {
          const m = value.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const parts = (m[1] ?? '')
            .split(/[,\s/]+/)
            .filter(Boolean)
            .map(Number);
          if ((parts[3] ?? 1) < 0.02) return null;
          const zwei = (n: number) => Math.round(n).toString(16).padStart(2, '0');
          return `#${zwei(parts[0] ?? 0)}${zwei(parts[1] ?? 0)}${zwei(parts[2] ?? 0)}`;
        };
        const undurchsichtigeFlaeche = (el: Element | null) => {
          for (let n = el; n; n = n.parentElement) {
            const c = hex(getComputedStyle(n).backgroundColor);
            if (c) return c;
          }
          return '#ffffff';
        };

        const leitungen = new Map<string, number>();
        document.querySelectorAll('.react-flow__edge path').forEach((p) => {
          const s = getComputedStyle(p);
          const farbe = hex(s.stroke);
          if (!farbe) return;
          if (parseFloat(s.strokeWidth) < 0.4) return; // Trefferflächen sind unsichtbar
          leitungen.set(farbe, (leitungen.get(farbe) ?? 0) + 1);
        });

        const legende = [...document.querySelectorAll('.cad-routing-legend__row')].map((row) => {
          const pfad = row.querySelector('path');
          return {
            label: row.textContent?.trim() ?? '',
            stroke: pfad ? hex(getComputedStyle(pfad).stroke) : null,
            flaeche: undurchsichtigeFlaeche(row),
          };
        });

        return {
          leitungen: [...leitungen.entries()].map(([farbe, anzahl]) => ({ farbe, anzahl })),
          legende,
          zeichenflaeche:
            hex(getComputedStyle(document.querySelector('.react-flow')!).backgroundColor) ?? '#ffffff',
          seitenflaeche: hex(getComputedStyle(document.body).backgroundColor) ?? '#ffffff',
        };
      });

      expect(mess.leitungen.length, 'gar keine Leitungen gemalt').toBeGreaterThan(0);

      const fehlend: string[] = [];
      for (const leitung of mess.leitungen) {
        const ratio = kontrast(leitung.farbe, mess.zeichenflaeche);
        if (ratio < 3) fehlend.push(`${leitung.farbe} auf ${mess.zeichenflaeche} = ${ratio.toFixed(2)}:1`);
      }
      expect(fehlend, `Leitungen unter 3:1 auf der Zeichenfläche:\n${fehlend.join('\n')}`).toEqual([]);

      await testInfo.attach('gemalte-leitungen', {
        body: JSON.stringify({ schema, ...mess }, null, 1),
        contentType: 'application/json',
      });
    });

    test(`Legende malt dieselben Farben wie die Leitungen (${schema})`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: schema === 'dunkel' ? 'dark' : 'light' });
      await page.goto(`${PLANNER_URL}?template=kastenwagen`);
      await expect(page.locator('.react-flow__edge').first()).toBeAttached({ timeout: 30_000 });

      const erreichbar = await zeigeLegende(page);
      if (!erreichbar) {
        // Bei 768 px gibt es keinen Schalter, der die Legende ohne Auswahl
        // öffnet, und mit Auswahl blendet EmptySelection sie aus. Die Legende
        // ist auf dieser Breite nicht erreichbar — gemessen, nicht vermutet.
        // Der Befund gehört nach AP-4 (Planer-Chrome); hier wird er vermerkt.
        testInfo.annotations.push({
          type: 'Legende bei dieser Breite nicht erreichbar',
          description: `Viewport ${testInfo.project.use?.viewport?.width ?? '?'} px: Slide-over öffnet nur mit Auswahl, die Legende gehört zu „Kein Element ausgewählt“.`,
        });
        return;
      }

      const mess = await page.evaluate(() => {
        const hex = (value: string) => {
          const m = value.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const parts = (m[1] ?? '')
            .split(/[,\s/]+/)
            .filter(Boolean)
            .map(Number);
          if ((parts[3] ?? 1) < 0.02) return null;
          const zwei = (n: number) => Math.round(n).toString(16).padStart(2, '0');
          return `#${zwei(parts[0] ?? 0)}${zwei(parts[1] ?? 0)}${zwei(parts[2] ?? 0)}`;
        };
        const gemalt = new Set<string>();
        document.querySelectorAll('.react-flow__edge path').forEach((p) => {
          const s = getComputedStyle(p);
          if (parseFloat(s.strokeWidth) < 0.4) return;
          const c = hex(s.stroke);
          if (c) gemalt.add(c);
        });
        return {
          leitungsFarben: [...gemalt],
          legende: [...document.querySelectorAll('.cad-routing-legend__row')].map((row) => {
            const pfad = row.querySelector('path')!;
            const flaeche = (() => {
              for (let n = row as Element | null; n; n = n.parentElement) {
                const c = hex(getComputedStyle(n).backgroundColor);
                if (c) return c;
              }
              return '#ffffff';
            })();
            return {
              label: row.textContent?.trim() ?? '',
              stroke: hex(getComputedStyle(pfad).stroke),
              flaeche,
            };
          }),
        };
      });

      const abweichend: string[] = [];
      for (const eintrag of mess.legende) {
        if (!eintrag.stroke) continue;
        if (!mess.leitungsFarben.includes(eintrag.stroke)) {
          abweichend.push(
            `${eintrag.label}: Legende ${eintrag.stroke}, gemalt ${mess.leitungsFarben.join('/')}`
          );
        }
      }
      expect(abweichend, `Legende und Leitung zeigen verschiedene Farben:\n${abweichend.join('\n')}`).toEqual(
        []
      );

      const duenn: string[] = [];
      for (const eintrag of mess.legende) {
        if (!eintrag.stroke) continue;
        const ratio = kontrast(eintrag.stroke, eintrag.flaeche);
        if (ratio < 3)
          duenn.push(`${eintrag.label}: ${eintrag.stroke} auf ${eintrag.flaeche} = ${ratio.toFixed(2)}:1`);
      }
      expect(duenn, `Legendenproben unter 3:1 auf ihrer Fläche:\n${duenn.join('\n')}`).toEqual([]);
    });

    test(`Auswahl ist Form, nicht Farbe (${schema})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: schema === 'dunkel' ? 'dark' : 'light' });
      await page.goto(`${PLANNER_URL}?template=kastenwagen`);
      const knoten = page
        .locator('.react-flow__node')
        .filter({ has: page.locator('.node-card') })
        .first();
      await expect(knoten).toBeVisible({ timeout: 30_000 });

      await knoten.click();
      await expect(page.locator('.node-card--selected').first()).toBeVisible({ timeout: 10_000 });

      const nach = await page
        .locator('.node-card--selected')
        .first()
        .evaluate((el) => {
          const s = getComputedStyle(el);
          return { outlineFarbe: s.outlineColor, outlineBreite: s.outlineWidth };
        });

      // Der Auswahl-Umriss folgt --text-high, nicht dem Akzent: Oxid (#a34a24)
      // und die Plus-Leitung (#c62f21) liegen bei 1,08:1 und wären
      // verwechselbar. Verglichen wird der gemessene Wert, nicht „hat sich
      // geändert“ — die Vorlage kann einen Knoten bereits ausgewählt liefern.
      const textHigh = schema === 'dunkel' ? 'rgb(232, 235, 238)' : 'rgb(22, 24, 26)';
      expect(nach.outlineBreite).toBe('2px');
      expect(nach.outlineFarbe).toBe(textHigh);
      expect(nach.outlineFarbe).not.toBe('rgb(163, 74, 36)');
      expect(nach.outlineFarbe).not.toBe('rgb(226, 136, 95)');
      expect(nach.outlineFarbe).not.toBe('rgb(198, 47, 33)');
      expect(nach.outlineFarbe).not.toBe('rgb(255, 107, 107)');
    });

    test(`Zeichen- und Seitenfläche sind getrennte Rollen (${schema})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: schema === 'dunkel' ? 'dark' : 'light' });
      await page.goto(`${PLANNER_URL}?template=kastenwagen`);
      await expect(page.locator('.react-flow').first()).toBeVisible({ timeout: 30_000 });

      const flaechen = await page.evaluate(() => {
        const hex = (value: string) => {
          const m = value.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const parts = (m[1] ?? '')
            .split(/[,\s/]+/)
            .filter(Boolean)
            .map(Number);
          const zwei = (n: number) => Math.round(n).toString(16).padStart(2, '0');
          return `#${zwei(parts[0] ?? 0)}${zwei(parts[1] ?? 0)}${zwei(parts[2] ?? 0)}`;
        };
        return {
          zeichnen: hex(getComputedStyle(document.querySelector('.react-flow')!).backgroundColor),
          zeichnenContainer: hex(getComputedStyle(document.querySelector('.de-canvas')!).backgroundColor),
          seite: hex(getComputedStyle(document.body).backgroundColor),
        };
      });

      // Die Zeichenfläche malt die Rollen-Farbe, nicht die Seitenfarbe: der
      // Inline-Hintergrund von FlowCanvas (--canvas-bg) liegt über .de-canvas.
      expect(flaechen.zeichnen).toBe(flaechen.zeichnenContainer);

      if (schema === 'dunkel') {
        expect(flaechen.zeichnen).toBe('#0e1114');
        expect(flaechen.seite).toBe('#131518');
      } else {
        expect(flaechen.zeichnen).toBe('#eceef0');
        expect(flaechen.seite).toBe('#eceef0');
      }
    });
  }
});

test.describe('Katalog und angewandte Prüfungen', () => {
  test('das Siegel trennt Regelkatalog von ausgeführten Prüfungen', async ({ page }) => {
    await page.goto(`${PLANNER_URL}?template=kastenwagen`);
    const siegel = page.getByTestId('verification-seal-toggle');
    await expect(siegel).toBeVisible({ timeout: 30_000 });

    // "29 Regeln" ohne Zusatz wäre falsch: angewandt sind nur die mit Gegenstand.
    await expect(siegel).not.toHaveText(/(?<!von )29 Regeln/);

    await siegel.click();
    const bericht = page.getByTestId('verification-sheet-body');
    await expect(bericht).toContainText(/einen Gegenstand/);
    await expect(bericht).toContainText(/\d+ von \d+ Regeln|29 Regeln/);

    // Kein Durchgang darf als "erfüllt" gelten, wenn er nichts geprüft hat.
    const zeilen = await bericht.locator('li').allTextContents();
    const falsch = zeilen.filter((text) => /erfüllt/.test(text) && /0 von \d+ Regeln/.test(text));
    expect(falsch, `Durchgänge ohne Gegenstand als erfüllt:\n${falsch.join('\n')}`).toEqual([]);
  });
});

/**
 * §10 · Befund B6 (Freigabe 2026-11-04): „Statusanzeigen sind nie gefüllte
 * Knöpfe." Die Decisions-Stufe in `lib/designTokens.test.ts` rechnet mit
 * Klassennamen; hier wird die gemalte Fläche selbst befragt — dasselbe Muster,
 * das schon die Legacy-Map überführt hat (Zeilen 8-12 oben).
 */

/**
 * Der Löschknopf sitzt im Inspector, und der ist nicht auf jeder Breite offen:
 * ab Desktop gibt es den Klappgriff, unter 768 px den Knopf `phone-open-detail`
 * in der Werkzeugzone des Schaltplans. Beides wird versucht — gemessen an
 * `zeigeLegende`.
 */
async function zeigeLoeschKnopf(
  page: import('@playwright/test').Page
): Promise<import('@playwright/test').Locator> {
  const loesch = page.getByRole('button', { name: /^Löschen$/ }).first();
  if (await loesch.isVisible().catch(() => false)) return loesch;

  const reiter = page.getByTestId('phone-open-detail');
  if (await reiter.isVisible().catch(() => false)) {
    await page.getByTestId('nav-tab-schaltplan').click();
    await reiter.click();
  } else {
    const griff = page.getByRole('button', { name: /Rechte Sidebar ausklappen/ });
    if (await griff.isVisible().catch(() => false)) await griff.click();
  }
  await expect(loesch, 'Inspector zeigt keinen Löschknopf').toBeVisible({ timeout: 15_000 });
  return loesch;
}
test.describe('§10 B6 — der Löschknopf malt keine Fehlerfläche', () => {
  for (const schema of ['hell', 'dunkel'] as const) {
    test(`Löschknopf im Inspector: Umriss in Fehlerfarbe, Kontrast ≥ 4,5:1 (${schema})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: schema === 'dunkel' ? 'dark' : 'light' });
      await page.goto(`${PLANNER_URL}?template=kastenwagen`);
      await expect(page.getByTestId('planner-shell')).toBeVisible({ timeout: 30_000 });

      const dialog = page.getByRole('dialog');
      await dialog
        .first()
        .waitFor({ state: 'visible', timeout: 8_000 })
        .catch(() => undefined);
      if ((await dialog.count()) > 0) {
        await dialog.getByRole('button', { name: 'Dialog schließen' }).click();
      }

      // Bauteil auswählen — derselbe Tastaturweg wie im A11y-Szenario.
      const knoten = page.locator('.react-flow__node[role="group"]').first();
      await expect(knoten).toBeVisible({ timeout: 20_000 });
      await knoten.focus();
      await page.keyboard.press('Enter');

      // Der Inspector startet je Breite anders: Klappgriff oder Reiter.
      const loesch = await zeigeLoeschKnopf(page);

      const gemessen = await loesch.evaluate((el) => {
        const hex = (wert: string): string | null => {
          const m = wert.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const teile = (m[1] ?? '')
            .split(/[,\s/]+/)
            .filter(Boolean)
            .map(Number);
          if ((teile[3] ?? 1) < 0.02) return null; // durchsichtig
          const zwei = (n: number) => Math.round(n).toString(16).padStart(2, '0');
          return `#${zwei(teile[0] ?? 0)}${zwei(teile[1] ?? 0)}${zwei(teile[2] ?? 0)}`;
        };
        const stil = getComputedStyle(el);
        const eigeneFlaeche = hex(stil.backgroundColor);
        const flaeche =
          eigeneFlaeche ??
          (() => {
            for (let n = el.parentElement; n; n = n.parentElement) {
              const c = hex(getComputedStyle(n).backgroundColor);
              if (c) return c;
            }
            return '#ffffff';
          })();
        return {
          schrift: hex(stil.color),
          rand: hex(stil.borderColor),
          flaeche,
          gefüllt: eigeneFlaeche,
          fehlerfarbe: hex(
            `rgb(${getComputedStyle(document.documentElement)
              .getPropertyValue('--destructive-rgb')
              .trim()
              .split(/\s+/)
              .join(',')})`
          ),
        };
      });

      // Ohne diesen Nachweis wären die drei Vergleiche darunter vacuous: ein
      // nicht auflösbares Token lieferte `null` und „nicht gleich null" fiele
      // nie auf.
      expect(gemessen.fehlerfarbe, '--destructive-rgb ist nicht auflösbar').not.toBeNull();
      // 1. Keine Fehlerfläche: der Knopf darf nicht in der Statusfarbe grundiert
      //    sein — genau das war der Befund.
      expect(gemessen.gefüllt, `Grundierung ${gemessen.gefüllt} = Fehlerfarbe`).not.toBe(
        gemessen.fehlerfarbe
      );
      // 2. Umriss und Text tragen die Fehlerfarbe.
      expect(gemessen.rand).toBe(gemessen.fehlerfarbe);
      expect(gemessen.schrift).toBe(gemessen.fehlerfarbe);
      // 3. Der Text bleibt lesbar: gegen die tatsächlich gemalte Fläche.
      expect(gemessen.schrift, `unbekannte Schriftfarbe ${schema}`).not.toBeNull();
      const x = relativLuminanz(gemessen.schrift ?? '#000000');
      const y = relativLuminanz(gemessen.flaeche ?? '#ffffff');
      const verhaeltnis = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      expect(
        verhaeltnis,
        `${schema}: ${gemessen.schrift} auf ${gemessen.flaeche} = ${verhaeltnis.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});
