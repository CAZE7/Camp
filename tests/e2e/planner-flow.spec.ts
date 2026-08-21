import { expect, test } from '@playwright/test';
import {
  addComponent,
  autoWire,
  edgeCount,
  nodeCount,
  openMoreMenuItem,
  openPlanner,
  showCanvas,
} from './helpers';

/**
 * Pflichtszenario 1 (AGENTS.md K5):
 * Batterie → Sicherung → Verbraucher → Verbindung → Prüfung/Stückliste.
 *
 * Läuft gegen den gebauten Static Export. Auf dem Handy-Viewport ist der
 * Ablauf identisch, nur über die Bottom-Tabs — deshalb kein Skip.
 */
test.describe('Planer-Grundablauf', () => {
  test('Batterie, Sicherung und Verbraucher verbinden und prüfen', async ({ page }) => {
    await openPlanner(page);
    expect(await nodeCount(page)).toBe(0);

    await addComponent(page, 'battery');
    await addComponent(page, 'fuse');
    await addComponent(page, 'consumer');
    expect(await nodeCount(page)).toBe(3);

    await autoWire(page);

    // Auto-Wire ergänzt die Backbone-Bauteile (Shunt, Busbars) und verdrahtet
    // sie: aus drei Bauteilen wird ein vollständiger Stromkreis.
    expect(await nodeCount(page)).toBeGreaterThan(3);
    expect(await edgeCount(page)).toBeGreaterThan(2);

    // Lokale Planprüfung meldet ein Ergebnis (Statusmeldung oder Prüfliste).
    await openMoreMenuItem(page, 'action-check');
    await expect(page.getByRole('status').first()).toBeVisible();
  });

  test('die Stückliste listet Bauteile und Leitungen des Plans', async ({ page }) => {
    await openPlanner(page);
    await addComponent(page, 'battery');
    await addComponent(page, 'consumer');
    await autoWire(page);

    await openMoreMenuItem(page, 'action-bom');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Stückliste')).toBeVisible();
    await expect(dialog.getByText('Bauteile')).toBeVisible();
    await expect(dialog.getByText(/Batterie/i).first()).toBeVisible();
    await expect(dialog.getByText('Elektrische Leitungen')).toBeVisible();

    // Escape schließt den Dialog und gibt den Fokus zurück.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('ein leerer Plan zeigt keinen erfundenen Inhalt in der Stückliste', async ({ page }) => {
    await openPlanner(page);
    await showCanvas(page);
    await openMoreMenuItem(page, 'action-bom');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Dein Plan ist noch leer.')).toBeVisible();
  });
});
