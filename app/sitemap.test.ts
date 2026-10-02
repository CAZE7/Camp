import { describe, expect, it } from 'vitest';

import { siteUrl } from '@/lib/site';

import sitemap from './sitemap';

const ERLAUBTE_FREQUENZEN = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];

/** Seiten, die im Index stehen sollen — genau diese gehören in die Sitemap. */
const INDEXIERBARE_SEITEN = [
  '/',
  '/elektrik-planung/',
  '/tools/dach/',
  '/tools/heizung/',
  '/guides/ausbau-fahrplan/',
  '/guides/camper-ausbauguide/',
  '/guides/holzausbau/',
  '/impressum/',
  '/datenschutz/',
];

/**
 * Ansichten ohne eigenen Inhalt für Ergebnislisten: Sie tragen `noindex`
 * (`pageMetadata`) und dürfen deshalb nicht in der Sitemap auftauchen — eine
 * Sitemap, die nicht indexierte Adressen anbietet, ist ein Widerspruch.
 */
const NICHT_IN_DER_SITEMAP = ['/design-system/', '/ki-assistent/'];

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

  it('enthält genau die indexierbaren Seiten', () => {
    expect(entries.map((entry) => entry.url).sort()).toEqual(
      INDEXIERBARE_SEITEN.map((path) => siteUrl(path)).sort()
    );
  });

  it('bietet keine Seite an, die auf noindex steht', () => {
    const urls = entries.map((entry) => entry.url);
    for (const path of NICHT_IN_DER_SITEMAP) {
      expect(urls).not.toContain(siteUrl(path));
    }
  });
});
