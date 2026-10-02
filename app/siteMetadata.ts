import type { Metadata } from 'next';

import { SITE_NAME, siteUrl } from '@/lib/site';

/**
 * app/siteMetadata.ts — die Felder des Kopfbereichs einer Seite entstehen an
 * einer Stelle.
 *
 * Jede Seite braucht dieselben Angaben in gleicher Form: Titel, Beschreibung,
 * die eigene Adresse als Verweis, ein Vorschaubild und — wo nötig — eine
 * Anweisung an Suchmaschinen. Sieben handgeschriebene Objekte wären sieben
 * Gelegenheiten, eines davon zu vergessen; hier gibt es einen Aufruf.
 *
 * Der Titel wird ohne Zusatz übergeben: der Wurzel-Layout hängt `| Werft` an
 * (Vorlage). Seiten, deren Titel bereits vollständig ist, setzen
 * `absoluteTitle` — dann bleibt der Titel unverändert.
 */

/** Vorschaubild, das gilt, wenn eine Seite kein eigenes mitbringt. */
export const DEFAULT_PREVIEW_IMAGE = {
  path: '/og/werft.png',
  width: 1200,
  height: 630,
  alt: 'Werft — Werkzeuge für den Camper-Ausbau: Elektrik, Dach und Heizlast',
} as const;

/**
 * Anweisung für Seiten, die in den Index gehören. `max-image-preview: large`
 * erlaubt große Vorschaubilder in Ergebnislisten; die Längenbegrenzungen für
 * Textauszüge werden aufgehoben, damit die Auswahl beim Verzeichnis liegt.
 */
export const INDEXABLE_ROBOTS = {
  index: true,
  follow: true,
  'max-image-preview': 'large',
  'max-snippet': -1,
  'max-video-preview': -1,
} as const;

/** Anweisung für Ansichten ohne eigenen Inhalt: nicht aufnehmen, aber folgen. */
export const NOINDEX_ROBOTS = { index: false, follow: true } as const;

type PreviewImage = {
  path: string;
  width: number;
  height: number;
  alt: string;
};

type PageMetadataInput = {
  /** Titel ohne Markenzusatz (der Wurzel-Layout ergänzt ihn). */
  title: string;
  /** Beschreibung für Ergebnislisten und Vorschaukarten. */
  description: string;
  /** Pfad der Seite innerhalb der Auslieferung, z. B. `/tools/dach/`. */
  path: string;
  /** Eigenes Vorschaubild; ohne Angabe gilt `DEFAULT_PREVIEW_IMAGE`. */
  image?: PreviewImage;
  /** true = der Titel ist vollständig und wird nicht ergänzt. */
  absoluteTitle?: boolean;
  /**
   * false = die Seite wird nicht in den Index aufgenommen (`noindex,
   * follow`): Sie ist eine Ansicht oder ein internes Werkzeug, kein Inhalt,
   * der in Ergebnislisten stehen soll.
   */
  index?: boolean;
};

/** Baut die Kopfdaten einer Seite aus Titel, Beschreibung und Pfad. */
export function pageMetadata({
  title,
  description,
  path,
  image = DEFAULT_PREVIEW_IMAGE,
  absoluteTitle = false,
  index = true,
}: PageMetadataInput): Metadata {
  const url = siteUrl(path);
  const imageUrl = siteUrl(image.path);

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    robots: index ? INDEXABLE_ROBOTS : NOINDEX_ROBOTS,
    openGraph: {
      type: 'website',
      locale: 'de_DE',
      siteName: SITE_NAME,
      url,
      title,
      description,
      images: [{ url: imageUrl, width: image.width, height: image.height, alt: image.alt }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: imageUrl, alt: image.alt }],
    },
  };
}
