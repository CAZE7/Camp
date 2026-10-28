import { describe, expect, it } from 'vitest';

import { indexablePages, nonIndexablePages } from '@/lib/seo/inventory';
import { siteUrl } from '@/lib/site';

import { GET } from './route';

/**
 * `/llms.txt` — Kurzübersicht für Sprachmodell-Agenten.
 *
 * Geprüft wird das Verhältnis zum Inventar, nicht der Wortlaut: Jede
 * indexierbare Seite muss vorkommen, keine Noindex-Seite darf auftauchen, und
 * jeder Verweis muss absolut auf die eigene Herkunft zeigen. Eine Datei, die
 * eine gelöschte Seite anbietet, schickt Agenten ins Leere — und niemand merkt
 * es, weil Menschen die Datei nie öffnen.
 */
const text = async (): Promise<string> => (await GET().text()) as string;

describe('llms.txt', () => {
  it('beginnt mit Titel und Zusammenfassung', async () => {
    const inhalt = await text();
    expect(inhalt.startsWith('# Elektroplaner\n')).toBe(true);
    // Der Zitatblock ist die Zeile, die ein Agent zuerst liest.
    expect(inhalt).toMatch(/^> \S.+$/m);
  });

  it('nennt jede indexierbare Seite genau einmal', async () => {
    const inhalt = await text();
    for (const page of indexablePages()) {
      const treffer = inhalt.split(`](${siteUrl(page.path)})`).length - 1;
      expect(treffer, `Seite ${page.path}`).toBe(1);
    }
  });

  it('führt keine Seite, die auf noindex steht', async () => {
    const inhalt = await text();
    for (const page of nonIndexablePages()) {
      expect(inhalt).not.toContain(`](${siteUrl(page.path)})`);
    }
  });

  it('verweist ausschließlich absolut auf die eigene Herkunft', async () => {
    const inhalt = await text();
    const ziele = [...inhalt.matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1]);
    expect(ziele.length).toBeGreaterThan(20);
    for (const ziel of ziele) {
      expect(ziel).toMatch(/^https:\/\/elektroplaner-camper\.de\//);
      expect(ziel).not.toContain('caze7.github.io');
    }
  });

  it('behauptet nichts, was die Anwendung nicht tut', async () => {
    const inhalt = await text();
    // Diese drei Sätze decken sich mit dem, was der Code macht: kein Konto,
    // Speicherung im Browser, keine Analyse. Kommt je ein Dienst hinzu, muss
    // die Datei geändert werden — der Test erinnert daran.
    expect(inhalt).toContain('kein Konto');
    expect(inhalt).toContain('localStorage');
    expect(inhalt).toContain('Keine Cookies');
    expect(inhalt).not.toMatch(/TODO|Platzhalter|undefined/);
  });
});
