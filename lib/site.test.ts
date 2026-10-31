import { describe, expect, it } from 'vitest';

import { SITE_ORIGIN, siteUrl } from './site';

describe('siteUrl', () => {
  it('zeigt mit Canonical, Sitemap und robots auf die eigene Domain — nie auf github.io', () => {
    // Regressionsschutz für den SEO-Befund: Stand hier wieder
    // `caze7.github.io`, würde Google die eigene Domain als Kopie werten
    // und elektroplaner-camper.de aus dem Index werfen.
    expect(SITE_ORIGIN).toBe('https://12v-planer.de');
    expect(siteUrl('/planer/', '')).toBe('https://12v-planer.de/planer/');
    expect(siteUrl('/sitemap.xml', '')).toBe('https://12v-planer.de/sitemap.xml');
    expect(siteUrl('/planer/', '')).not.toContain('github.io');
  });

  it('setzt Herkunft und Seitenpfad mit Basis-Pfad zusammen', () => {
    expect(siteUrl('/elektrik-planung/', '/Camp')).toBe(`${SITE_ORIGIN}/Camp/elektrik-planung/`);
  });

  it('kommt ohne abschließenden Schrägstrich im Basis-Pfad aus', () => {
    expect(siteUrl('/sitemap.xml', '/Camp/')).toBe(`${SITE_ORIGIN}/Camp/sitemap.xml`);
  });

  it('liefert ohne Basis-Pfad die Wurzel-Adressen (Entwicklung, Prüfbau)', () => {
    expect(siteUrl('/sitemap.xml', '')).toBe(`${SITE_ORIGIN}/sitemap.xml`);
    expect(siteUrl('/', '')).toBe(`${SITE_ORIGIN}/`);
  });

  it('ergänzt einen fehlenden führenden Schrägstrich', () => {
    expect(siteUrl('elektrik-planung/', '/Camp')).toBe(`${SITE_ORIGIN}/Camp/elektrik-planung/`);
  });
});
