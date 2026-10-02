import { describe, expect, it } from 'vitest';

import { siteUrl } from '@/lib/site';

import { DEFAULT_PREVIEW_IMAGE, pageMetadata } from './siteMetadata';

/**
 * Die Kopfdaten sind eine Zusage an Suchmaschinen und Vorschau-Dienste.
 * Geprüft werden die Felder, deren Fehlen in einem Audit zuerst auffällt:
 * Bezugsadresse und Verweis auf die Seite selbst, Bild mit Maßen und
 * Alternativtext, Anweisung an Crawler sowie die Unterscheidung zwischen
 * „Titel wird ergänzt" und „Titel ist vollständig".
 */
describe('pageMetadata', () => {
  const minimal = pageMetadata({
    title: 'Dach-Planer',
    description: 'Beschreibung der Seite.',
    path: '/tools/dach/',
  });

  it('verweist auf die eigene Adresse', () => {
    expect(minimal.alternates?.canonical).toBe(siteUrl('/tools/dach/'));
    expect(minimal.openGraph?.url).toBe(siteUrl('/tools/dach/'));
  });

  it('gibt ein vollständiges Vorschaubild an, wenn keines übergeben wird', () => {
    const images = minimal.openGraph?.images as Array<{
      url: string;
      width: number;
      height: number;
      alt: string;
    }>;

    expect(images).toHaveLength(1);
    expect(images[0]?.url).toBe(siteUrl(DEFAULT_PREVIEW_IMAGE.path));
    expect(images[0]?.width).toBe(1200);
    expect(images[0]?.height).toBe(630);
    expect(images[0]?.alt).not.toBe('');
    expect(minimal.twitter).toMatchObject({ card: 'summary_large_image' });
  });

  it('überlässt den Titel der Vorlage des Wurzel-Layouts', () => {
    expect(minimal.title).toBe('Dach-Planer');
  });

  it('kennzeichnet einen vollständigen Titel als absolut', () => {
    const absolute = pageMetadata({
      title: 'Vollständiger Titel ohne Zusatz',
      description: 'Beschreibung der Seite.',
      path: '/',
      absoluteTitle: true,
    });

    expect(absolute.title).toEqual({ absolute: 'Vollständiger Titel ohne Zusatz' });
  });

  it('erlaubt das Indexieren ausdrücklich und großzügig', () => {
    expect(minimal.robots).toEqual({
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    });
  });

  it('nimmt Ansichten ohne eigenen Inhalt aus dem Index, ohne sie abzuschneiden', () => {
    const internal = pageMetadata({
      title: 'Design-System',
      description: 'Interne Übersicht.',
      path: '/design-system/',
      index: false,
    });

    expect(internal.robots).toEqual({ index: false, follow: true });
  });
});
