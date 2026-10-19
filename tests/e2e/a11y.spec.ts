import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import { dismissOnboarding } from './helpers';

/**
 * Automatisiertes Barrierefreiheits-Gate (ersetzt das frühere, händische
 * „Lighthouse 100 halten"-Versprechen durch einen erzwingbaren Check).
 *
 * Es wird der gebaute Static Export bewertet — also genau das, was auf
 * GitHub Pages ausgeliefert wird. Fail-Schwelle: Verstöße der Stufen
 * 'critical' und 'serious' (Impact-basiert, wcag2a/aa-Regelwerk). Leichtere
 * Stufen werden als Report geloggt, damit sie sichtbar bleiben, ohne den
 * Build wegen kosmetischer Hinweise zu blockieren.
 *
 * Der Planer-Canvas (React Flow) ist eine Editor-Oberfläche mit eigenem
 * Bedienmodell (DAG-Manipulation); er wird gezielt ausgeschlossen (Begründung
 * unten im Code), nicht pauschal.
 */

const PAGES: Array<{ path: string; name: string }> = [
  { path: '/', name: 'Startseite' },
  { path: '/tools/dach/', name: 'Dachplaner' },
  { path: '/tools/heizung/', name: 'Heizlast-Rechner' },
  { path: '/planer/', name: 'Elektroplaner (Anwendung)' },
  // Die inhaltsgetriebenen Seiten teilen sich ein Gerüst (`components/seo/`).
  // Sie stehen hier stellvertretend für die drei Seitentypen — Pillar,
  // Cluster mit Rechner, Vertrauensseite —, damit ein Fehler im Gerüst nicht
  // unbemerkt bleibt. Weitere Themen nutzen dieselben Bausteine.
  { path: '/camper-elektrik/', name: 'Elektrik-Pillar' },
  { path: '/camper-elektrik/kabelquerschnitt/', name: 'Kabelquerschnitt' },
  { path: '/rechner/spannungsabfall-12v/', name: 'Spannungsabfall-Rechner' },
  { path: '/ueber-werft/', name: 'Über Werft' },
];

for (const { path, name } of PAGES) {
  test(`axe: ${name} (${path}) ohne kritische/schwere Verstöße`, async ({ page }) => {
    await page.goto(path);
    // Auf Inhalte warten statt auf die Uhr: axe soll das fertige DOM sehen.
    await expect(page.locator('body')).not.toBeEmpty();
    await page.waitForLoadState('networkidle');

    const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

    if (path === '/planer/') {
      // Der React-Flow-Canvas ist eine Anwendung mit Zeiger-/Tastatur-Modell
      // (Pfeiltasten-Verschiebung, Verbindungsmodus) und kein Dokumenten-
      // Fließtext: axe-Regeln für Dokumentstruktur (z. B. 'region' pro
      // verschachteltem Node-Element) sind dort nicht das Bedienmodell.
      // Chrome installiert axe nur im Seiten-Kontext — der Ausschluss gilt
      // ausschließlich dem Editor-Canvas, nicht der restlichen Shell.
      builder.exclude('.react-flow');
    }

    const results = await builder.analyze();
    const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    const minor = results.violations.filter((v) => v.impact === 'minor' || v.impact === 'moderate');

    if (minor.length > 0) {
      console.warn(
        `[a11y-Hinweise ${name}]`,
        minor.map((v) => `${v.id}: ${v.nodes.length} Stelle(n)`).join('; ')
      );
    }

    expect(
      blocking,
      blocking
        .map(
          (v) =>
            `${v.id} (${v.impact}): ${v.help}\n  → ${v.nodes.map((n) => String(n.target).slice(0, 120)).join('\n  → ')}`
        )
        .join('\n')
    ).toEqual([]);
  });
}

/**
 * Barrierefreiheits-Gate der Blätter (M12).
 *
 * Der Durchlauf oben bewertet den Startzustand. Genau die Zustände, die in
 * dieser Runde umgebaut wurden — Katalog als Blatt, Eigenschaften als Blatt,
 * das `⋯`-Menü als Blatt —, waren bisher ungeprüft: Ein Blatt über der
 * Zeichenfläche ist eine eigene Ebene mit eigenen Fokus- und Kontrastfragen.
 * Geprüft wird auf dem Handy (dort sind es Blätter); ab 768 px sind dieselben
 * Bereiche Spalten bzw. Dropdowns und werden vom Startzustand erfasst.
 */
test.describe('axe: Planer-Blätter auf dem Handy', () => {
  for (const step of [
    { name: 'Bauteilkatalog-Blatt', open: 'nav-tab-sidebar' },
    { name: 'Eigenschaften-Blatt', open: 'nav-tab-inspector' },
  ] as const) {
    test(`${step.name} ohne kritische/schwere Verstöße`, async ({ page }) => {
      const width = page.viewportSize()?.width ?? 0;
      test.skip(width >= 768, 'Blätter gibt es nur unter 768 px.');

      await page.goto('/planer/');
      await expect(page.getByTestId('planner-shell')).toBeVisible({ timeout: 30_000 });
      // Der Einführungsdialog liegt beim Erstbesuch über allem und fängt
      // Klicks ab — er ist selbst Teil der Startprüfung oben, hier geht es um
      // die Blätter dahinter.
      await dismissOnboarding(page);
      await page.getByTestId(step.open).click();
      await expect(page.getByTestId(step.open)).toHaveAttribute('aria-expanded', 'true');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        // Wie oben: Der Editor-Canvas hat ein eigenes Bedienmodell.
        .exclude('.react-flow')
        .analyze();
      const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      expect(blocking, blocking.map((v) => `${v.id} (${v.impact}): ${v.help}`).join('\n')).toEqual([]);
    });
  }

  test('Werkzeugmenü (⋯) ohne kritische/schwere Verstöße', async ({ page }) => {
    await page.goto('/planer/');
    await expect(page.getByTestId('planner-shell')).toBeVisible({ timeout: 30_000 });
    await dismissOnboarding(page);
    await page.getByTestId('action-more').click();
    await expect(page.getByRole('menu', { name: 'Weitere Aktionen' })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('.react-flow')
      .analyze();
    const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(blocking, blocking.map((v) => `${v.id} (${v.impact}): ${v.help}`).join('\n')).toEqual([]);
  });
});
