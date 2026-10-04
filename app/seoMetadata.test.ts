import { describe, expect, it } from 'vitest';

import { CONTENT_PAGES } from '@/lib/seo/content';
import { indexablePages, nonIndexablePages, PAGES } from '@/lib/seo/inventory';
import { siteUrl } from '@/lib/site';

import { metadataFor, metadataForPage } from './seoMetadata';

describe('SEO-Metadaten und Inventar', () => {
  it('hält jede Route eindeutig im Inventar und mit vollständigen Kopfdaten', () => {
    const paths = PAGES.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);

    for (const page of PAGES) {
      const metadata = metadataForPage(page.path);
      expect(page.title.trim(), page.path).not.toBe('');
      expect(page.description.trim(), page.path).not.toBe('');
      expect(metadata.description, page.path).toBe(page.description);
      expect(metadata.alternates?.canonical, page.path).toBe(siteUrl(page.path));
      expect(metadata.openGraph?.url, page.path).toBe(siteUrl(page.path));
      expect(metadata.openGraph?.title, page.path).toBe(page.title);
      expect(metadata.openGraph?.description, page.path).toBe(page.description);
      expect(metadata.twitter?.title, page.path).toBe(page.title);
      expect(metadata.twitter?.description, page.path).toBe(page.description);
    }
  });

  it('kennzeichnet nur die inventarisierten Ansichten als noindex', () => {
    for (const page of indexablePages()) {
      expect(metadataForPage(page.path).robots, page.path).toMatchObject({ index: true, follow: true });
    }
    for (const page of nonIndexablePages()) {
      expect(metadataForPage(page.path).robots, page.path).toEqual({ index: false, follow: true });
    }
    expect(nonIndexablePages().map((page) => page.path)).toEqual(['/design-system/', '/ki-assistent/']);
  });

  it('stoppt unbekannte Routen und abweichende Inhaltsmetadaten', () => {
    expect(() => metadataForPage('/nicht-im-inventar/')).toThrow(/fehlt im SEO-Inventar/);
    const content = CONTENT_PAGES[0]!;
    expect(() => metadataFor({ ...content, title: `${content.title} abweichend` })).toThrow(
      /Metadaten und Inhalt.*weichen voneinander ab/
    );
  });

  it('leitet die Metadaten datengetriebener Seiten aus demselben Inventareintrag ab', () => {
    for (const content of CONTENT_PAGES) {
      const metadata = metadataFor(content);
      expect(metadata.description).toBe(content.description);
      expect(metadata.alternates?.canonical).toBe(siteUrl(content.path));
    }
  });
});
