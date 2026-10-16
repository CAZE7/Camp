import { describe, expect, it } from 'vitest';

import { indexablePages, nonIndexablePages, SITEMAP_ROUTES } from '@/lib/seo/inventory';
import { siteUrl } from '@/lib/site';

import sitemap from './sitemap';

const ERLAUBTE_FREQUENZEN = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];

/**
 * Die Sitemap entsteht aus dem Seiteninventar. Geprüft wird deshalb beides:
 * dass sie die Zusage der Auslieferung einhält (Basis-Pfad, keine
 * Zeitstempel, gültige Werte) und dass sie zum Inventar passt — eine
 * indexierbare Seite ohne Sitemap-Eintrag ist ein Fehler, ein Eintrag ohne
 * Indexierbarkeit ebenfalls.
 */
describe('sitemap', () => {
  const entries = sitemap();

  it('listet jede ausgelieferte Seite genau einmal', () => {
    const urls = entries.map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain(siteUrl('/camper-elektrik/'));
  });

  it('bildet alle Adressen unter dem Basis-Pfad der Auslieferung', () => {
    const prefix = siteUrl('/');
    for (const entry of entries) {
      expect(entry.url.startsWith(prefix)).toBe(true);
    }
  });

  it('führt Zeitstempel nur, wo der Inhalt durchgesehen wurde', () => {
    // Der Zeitstempel kommt aus dem Inventar (`contentRevision`) — nicht aus
    // der Bauzeit. Wo der Inhalt nicht geprüft wurde, steht keiner: eine
    // ehrliche Lücke ist besser als ein behauptetes Datum.
    for (const entry of entries) {
      const route = SITEMAP_ROUTES.find((candidate) => candidate.path === new URL(entry.url).pathname);
      expect(route).toBeDefined();
      if (route?.contentRevision) {
        expect(entry.lastModified).toBe(route.contentRevision);
      } else {
        expect(entry).not.toHaveProperty('lastModified');
      }
    }
  });

  it('nennt keinen Zeitstempel für Seiten ohne dokumentierten Stand', () => {
    const ohneStand = entries.filter((entry) => !entry.lastModified);
    // Die Rechtsseiten tragen keinen fachlichen Stand — dort behauptet die
    // Sitemap nichts, was im Text steht.
    expect(ohneStand.map((entry) => new URL(entry.url).pathname)).toContain('/impressum/');
  });

  it('gibt Priorität und Änderungsfrequenz im gültigen Bereich an', () => {
    for (const entry of entries) {
      expect(entry.priority).toBeGreaterThan(0);
      expect(entry.priority).toBeLessThanOrEqual(1);
      expect(ERLAUBTE_FREQUENZEN).toContain(entry.changeFrequency);
    }
  });

  it('enthält genau die indexierbaren Seiten des Inventars', () => {
    expect(entries.map((entry) => entry.url).sort()).toEqual(
      indexablePages()
        .map((page) => siteUrl(page.path))
        .sort()
    );
  });

  it('bietet keine Seite an, die auf noindex steht', () => {
    const urls = entries.map((entry) => entry.url);
    for (const page of nonIndexablePages()) {
      expect(urls).not.toContain(siteUrl(page.path));
    }
  });

  it('führt jede Route mit Änderungsfrequenz und Priorität', () => {
    for (const route of SITEMAP_ROUTES) {
      expect(ERLAUBTE_FREQUENZEN).toContain(route.changeFrequency);
      expect(route.priority).toBeGreaterThan(0);
    }
  });
});
