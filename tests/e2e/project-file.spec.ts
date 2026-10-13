import { expect, test, type Page } from '@playwright/test';
import { addComponent, autoWire, edgeCount, nodeCount, openPlanner } from './helpers';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Projektdatei, Stückliste und Dokumentstatus im echten Browser.
 *
 * Ablauf (Auftrag Phase F): Plan erstellen → Auto-Wiring → speichern →
 * neu laden → Plan leeren → Projektdatei öffnen → Stückliste/CSV →
 * fehlerhafte Datei bleibt ohne Wirkung.
 *
 * Nur Desktop: Das Datei-Menü liegt dort in der Menüleiste.
 */

test.beforeEach(({ browserName: _browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440', 'Datei-Menü ist nur in der Desktop-Menüleiste');
});

/** Öffnet das Menü „Datei“ der Menüleiste und klickt den Eintrag mit diesem Text. */
async function openFileMenuItem(page: Page, name: string): Promise<void> {
  await page.getByRole('menubar').getByRole('menuitem', { name: 'Datei', exact: true }).click();
  const item = page.getByRole('menu').getByText(name, { exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

async function clearPlanViaDialog(page: Page): Promise<void> {
  await page.getByRole('menubar').getByRole('menuitem', { name: 'Datei', exact: true }).click();
  await page
    .getByRole('menu')
    .getByRole('menuitem', { name: 'Neuen leeren Plan starten', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Neuen leeren Plan starten?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Plan leeren', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => nodeCount(page)).toBe(0);
}

test.describe('Projektdatei und Stückliste', () => {
  test('Plan speichern, neu laden, leeren und wieder öffnen', async ({ page }) => {
    await openPlanner(page);
    await addComponent(page, 'battery');
    await addComponent(page, 'consumer');
    await autoWire(page);
    const nodesBefore = await nodeCount(page);
    const edgesBefore = await edgeCount(page);

    // 1. Speichern: Download der Projektdatei.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      openFileMenuItem(page, 'Projekt speichern (.json)'),
    ]);
    expect(download.suggestedFilename()).toMatch(/^camp-plan-\d{4}-\d{2}-\d{2}\.json$/);
    const dir = mkdtempSync(join(tmpdir(), 'camp-e2e-'));
    const savedPath = join(dir, 'plan.json');
    await download.saveAs(savedPath);
    const doc = JSON.parse(readFileSync(savedPath, 'utf8')) as {
      format: string;
      formatVersion: number;
      plan: { nodes: unknown[]; edges: unknown[] };
    };
    expect(doc.format).toBe('camp-elektroplaner-projekt');
    expect(doc.formatVersion).toBe(1);
    expect(doc.plan.nodes).toHaveLength(nodesBefore);
    expect(doc.plan.edges).toHaveLength(edgesBefore);

    // 2. Neu laden: Der lokale Stand bleibt erhalten.
    await page.reload();
    await expect(page.getByTestId('planner-shell')).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => nodeCount(page)).toBe(nodesBefore);

    // 3. Leeren, dann die Datei öffnen.
    await clearPlanViaDialog(page);

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      openFileMenuItem(page, 'Projekt öffnen (.json)'),
    ]);
    await chooser.setFiles(savedPath);

    await expect.poll(async () => nodeCount(page)).toBe(nodesBefore);
    await expect.poll(async () => edgeCount(page)).toBe(edgesBefore);
    await expect(page.getByText(/Projekt „plan.json“ geöffnet/)).toBeVisible();
  });

  test('eine fehlerhafte Projektdatei lässt den aktuellen Plan unverändert', async ({ page }) => {
    await openPlanner(page);
    await addComponent(page, 'battery');
    const before = await nodeCount(page);

    const dir = mkdtempSync(join(tmpdir(), 'camp-e2e-bad-'));
    const badPath = join(dir, 'kaputt.json');
    writeFileSync(badPath, JSON.stringify({ format: 'fremd', formatVersion: 1, plan: {} }));

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      openFileMenuItem(page, 'Projekt öffnen (.json)'),
    ]);
    await chooser.setFiles(badPath);

    await expect(page.getByText(/nicht geöffnet/)).toBeVisible();
    await expect(page.getByText(/Der aktuelle Plan bleibt unverändert/)).toBeVisible();
    expect(await nodeCount(page)).toBe(before);
  });

  test('Stückliste: CSV-Export trägt Planstand und Status, oder ist bei Sperre deaktiviert', async ({
    page,
  }) => {
    await openPlanner(page);
    await addComponent(page, 'battery');
    await addComponent(page, 'consumer');
    await autoWire(page);

    await page.getByTestId('action-more').click();
    await page.getByTestId('action-bom').click();
    const status = page.getByTestId('bom-release-status');
    await expect(status).toBeVisible();
    const csvButton = page.getByTestId('bom-export-csv');

    if ((await status.getAttribute('data-status')) === 'gesperrt') {
      // Kritischer Befund: Export muss gesperrt sein und den Grund nennen.
      await expect(csvButton).toBeDisabled();
      await expect(page.getByTestId('bom-blockers')).toBeVisible();
      return;
    }

    await expect(csvButton).toBeEnabled();
    const [download] = await Promise.all([page.waitForEvent('download'), csvButton.click()]);
    expect(download.suggestedFilename()).toMatch(/^stueckliste-.*\.csv$/);
    const dir = mkdtempSync(join(tmpdir(), 'camp-e2e-csv-'));
    const path = join(dir, 'bom.csv');
    await download.saveAs(path);
    const text = readFileSync(path, 'utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const lines = text
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n');
    expect(lines[0]).toBe(
      'Typ;Bezeichnung;Menge;Einheit;Querschnitt_mm2;Laenge_m;Quelle;Planstand;Dokumentstatus'
    );
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines.slice(1)) {
      expect(line.endsWith(';Entwurf') || line.endsWith(';Softwareprüfung bestanden (keine Freigabe)')).toBe(
        true
      );
    }
  });
});
