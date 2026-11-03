import { cn } from '@/lib/utils';

/**
 * components/brand/ContentImage.tsx — die EINE Stelle für Inhaltsbilder
 * (Designkonzept 2026-11 §4, P1).
 *
 * Warum eine Komponente und nicht `<img>` an jeder Seite: Ein statischer
 * Export mit `images.unoptimized: true` erzeugt keine Bildvarianten zur
 * Laufzeit. AVIF und der JPEG-Fallback sind Build-Artefakte und müssen für
 * jedes Motiv in derselben Form ausgegeben werden — `srcset`/`sizes`, feste
 * Maße (CLS), Alt-Text und eine Bildunterschrift, die ihrerseits indexierbarer
 * Text und interner Verweis ist. Fünf handgeschriebene `<img>`-Tags wären fünf
 * Gelegenheiten, eines davon zu vergessen.
 *
 * Der Wächter in `ContentImage.test.tsx` verbietet rohe `<img>`-Tags in
 * `app/` und `components/` außerhalb dieser Datei.
 *
 * Bewusst noch nicht auf einer Seite verdrahtet: Die Motive aus
 * `docs/design-2026-11/FOTOMOTIV-KATALOG.pdf` sind eigene Fotografie. Die
 * sechs Bilder im Konzept-Prototyp sind KI-Platzhalter und werden laut
 * `BILDRECHTE.md` nicht in `public/bilder/` übernommen. P2 setzt das
 * Hero-Foto ein, sobald die Aufnahmen vorliegen.
 */
export interface ContentImageProps {
  /** Pfad ohne Endung, z. B. `/bilder/a-01-kabelverlegung`. */
  name: string;
  /** Beschreibt das Sichtbare, ≤ 125 Zeichen; dekorativ → leerer String. */
  alt: string;
  /** Intrinsische Breite des Masters in px — Pflicht gegen Layout-Shift. */
  width: number;
  /** Intrinsische Höhe des Masters in px — Pflicht gegen Layout-Shift. */
  height: number;
  /** Sichtbare Bildunterschrift mit einer Aussage und ggf. internem Verweis. */
  caption: React.ReactNode;
  /** true = LCP-Bild: sofort laden und mit hoher Priorität anfordern. */
  priority?: boolean;
  /** `sizes` für `srcset`; Standard ist die Lesespalte bzw. volle Breite mobil. */
  sizes?: string;
  className?: string;
  imageClassName?: string;
}

const DEFAULT_SIZES = '(max-width: 768px) 100vw, 42rem';

export function ContentImage({
  name,
  alt,
  width,
  height,
  caption,
  priority = false,
  sizes = DEFAULT_SIZES,
  className,
  imageClassName,
}: ContentImageProps) {
  return (
    <figure className={cn('content-figure', className)}>
      <picture>
        <source type="image/avif" srcSet={`${name}-640.avif 640w, ${name}-1200.avif 1200w`} sizes={sizes} />
        {/* `src` ist der JPEG-Fallback; ohne AVIF-Unstützung bleibt das Bild sichtbar. */}
        <img
          src={`${name}.jpg`}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          className={cn('content-image', imageClassName)}
        />
      </picture>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
