import { describe, expect, it } from 'vitest';

import { indexablePages, nonIndexablePages, SITEMAP_ROUTES } from '@/lib/seo/inventory';
import { siteUrl } from '@/lib/site';

import sitemap from './sitemap';

const ERLAUBTE_FREQUENZEN = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];

/**
 * Die Sitemap entsteht aus dem Seiteninventar. Geprüft wird deshalb beides:
 * dass sie die Zusage der Auslieferung einhält (Basis-Pfad, gültige Werte,
 * belegte Zeitstempel) und dass sie zum Inventar passt — eine indexierbare
 * Seite ohne Sitemap-Eintrag ist ein Fehler, ein Eintrag ohne Indexierbarkeit
 * ebenfalls.
 *
 * Zu `lastModified`: Seit 2026-10-28 trägt die Sitemap ein Datum, aber nur für
 * Seiten mit belegter Inhaltsänderung (`lastReviewed` im Inventar). Der Test
 * prüft die REGEL, nicht die Liste: Format, Kalendergültigkeit, kein Datum in
 * der Zukunft, kein Datum vor Projektbeginn — und dass jedes Datum im Inventar
 * eine Begründung am Eintrag hat. Er prüft ausdrücklich NICHT, dass alle
 * Seiten ein Datum tragen; ein fehlendes Datum ist der korrekte Zustand für
 * eine Seite, deren letzte Änderung niemand belegen kann.
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

  it('gibt Zeitstempel nur als belegtes Kalenderdatum aus, nie in der Zukunft', () => {
    const heute = new Date();
    for (const entry of entries) {
      if (entry.lastModified === undefined) continue;
      const datum = new Date(entry.lastModified as Date | string);
      expect(Number.isNaN(datum.getTime())).toBe(false);
      // Mitternacht UTC: Der Wert ist ein Tag, kein Zeitpunkt.
      expect(datum.toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
      expect(datum.getTime()).toBeLessThanOrEqual(heute.getTime());
      // Vor dem ersten Commit dieses Projekts kann keine Seite geändert worden sein.
      expect(datum.getTime()).toBeGreaterThanOrEqual(Date.UTC(2026, 8, 1));
    }
  });

  it('belegt jeden Zeitstempel mit einem Eintrag im Inventar', () => {
    for (const entry of entries) {
      if (entry.lastModified === undefined) continue;
      const page = indexablePages().find((candidate) => siteUrl(candidate.path) === entry.url);
      expect(page?.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('erfindet kein Datum für Seiten ohne Beleg', () => {
    // Mindestens eine Seite trägt heute ein belegtes Datum (sonst wäre das
    // Feld tot), und die Datenschutzerklärung gehört dazu — sie wurde am
    // 2026-10-28 neu geschrieben.
    const mitDatum = entries.filter((entry) => entry.lastModified !== undefined);
    expect(mitDatum.length).toBeGreaterThan(0);
    const datenschutz = entries.find((entry) => entry.url === siteUrl('/datenschutz/'));
    expect(datenschutz?.lastModified).toBeInstanceOf(Date);
    // Und die Mehrheit trägt keins: Ein Datum an jeder Seite wäre genau die
    // Behauptung, die dieser Test verhindern soll.
    expect(mitDatum.length).toBeLessThan(entries.length);
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
