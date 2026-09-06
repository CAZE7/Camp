import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
  { path: '/elektrik-planung/', name: 'Elektrik-Planer' },
];

for (const { path, name } of PAGES) {
  test(`axe: ${name} (${path}) ohne kritische/schwere Verstöße`, async ({ page }) => {
    await page.goto(path);
    // Auf Inhalte warten statt auf die Uhr: axe soll das fertige DOM sehen.
    await expect(page.locator('body')).not.toBeEmpty();
    await page.waitForLoadState('networkidle');

    const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);

    if (path === '/elektrik-planung/') {
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
