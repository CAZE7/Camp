import { describe, expect, it } from 'vitest';

import type { Produktionsbild } from '@/lib/seo/bildSitemap';
import { indexablePages, nonIndexablePages, SITEMAP_ROUTES } from '@/lib/seo/inventory';
import { siteUrl } from '@/lib/site';

import sitemap, { sitemapEintraege } from './sitemap';

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
    expect(urls).toContain(siteUrl('/elektrik-planung/'));
  });

  it('bildet alle Adressen unter dem Basis-Pfad der Auslieferung', () => {
    const prefix = siteUrl('/');
    for (const entry of entries) {
      expect(entry.url.startsWith(prefix)).toBe(true);
    }
  });

  it('führt keine Zeitstempel — die Seite behauptet keine Änderung, die nicht geprüft ist', () => {
    for (const entry of entries) {
      expect(entry).not.toHaveProperty('lastModified');
    }
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

/**
 * P3/P4: Bild-Sitemap. Dieselbe Liste wie das WebPage-Schema; ohne eigene,
 * rechtegeklärte Aufnahmen wird KEIN Bild in die Sitemap geschrieben.
 */
describe('sitemap — Bilder', () => {
  const gueltig: Produktionsbild = {
    pfad: '/bilder/a-01-kabelverlegung-1200.avif',
    seite: '/camper-elektrik/',
    alt: 'Hände verlegen 12-V-Leitungen entlang einer Holzleiste.',
    bildunterschrift: 'Der Kabelweg folgt der Holzleiste.',
    breite: 1200,
    hoehe: 805,
    rechteGeklaert: true,
  };

  it('behauptet keine Bilder, solange die Produktionsliste leer ist', () => {
    for (const entry of sitemapEintraege([])) {
      expect(entry).not.toHaveProperty('images');
    }
  });

  it('ordnet ein freigegebenes Bild genau seiner Zielseite zu', () => {
    const eintraege = sitemapEintraege([gueltig]);
    const ziel = eintraege.find((entry) => entry.url === siteUrl('/camper-elektrik/'));
    expect(ziel?.images).toEqual([siteUrl(gueltig.pfad)]);
    expect(eintraege.filter((entry) => entry.images).length).toBe(1);
  });

  it('ignoriert Bilder ohne Rechte, mit Platzhalternamen und unbekannter Seite', () => {
    const liste = [
      { ...gueltig, rechteGeklaert: false },
      { ...gueltig, pfad: '/bilder/01-elektrik-einbau-1200.avif' },
      { ...gueltig, seite: '/gibt-es-nicht/' },
    ];
    expect(sitemapEintraege(liste).some((entry) => entry.images)).toBe(false);
  });
});
