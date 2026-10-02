import { describe, expect, it } from 'vitest';

import { siteUrl } from '@/lib/site';

import sitemap from './sitemap';

const ERLAUBTE_FREQUENZEN = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];

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
});
