import { describe, expect, it } from 'vitest';

import { SITE_ORIGIN, siteUrl } from './site';

describe('siteUrl', () => {
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
