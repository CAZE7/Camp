/**
 * lib/seo/bildSitemap.ts — die EINE Liste der Bilder, die in die Auslieferung
 * dürfen (Designkonzept 2026-11 §4, P3/P4).
 *
 * Bewusst LEER: Die finalen Motive sind eigene Fotografien mit geklärten
 * Rechten (`docs/design-2026-11/FOTOMOTIV-KATALOG.pdf`, `BILDRECHTE.md`).
 * Die sechs Bilder im Konzeptordner sind KI-Platzhalter und dürfen weder in
 * `public/bilder/` noch in die Sitemap. Ein Eintrag ohne freigegebene Rechte
 * wird deshalb gar nicht erst ausgegeben — eine Bild-Sitemap mit erfundenen
 * oder nicht existierenden Adressen wäre schlimmer als gar keine.
 *
 * Sobald ein Motiv aufgenommen und in `BILDRECHTE.md` dokumentiert ist, genügt
 * ein Eintrag hier. `app/sitemap.ts`, das WebPage-Schema und der Export-Prüfer
 * lesen dieselbe Liste; es gibt keine zweite Stelle zu pflegen.
 *
 * Kein React, keine Farben, keine Elektro-Logik (ARCHITECTURE-RULES A/B).
 */

export type Produktionsbild = {
  /** Öffentlicher Pfad des 1200er AVIF, z. B. `/bilder/a-01-kabelverlegung-1200.avif`. */
  pfad: string;
  /** Indexierbare Zielseite, auf der das Bild tatsächlich steht. */
  seite: string;
  /** Beschreibt das Sichtbare, ≤ 125 Zeichen. */
  alt: string;
  /** Sichtbare Bildunterschrift mit einer Aussage. */
  bildunterschrift: string;
  /** Intrinsische Breite des Masters in px — Pflicht gegen Layout-Shift. */
  breite: number;
  /** Intrinsische Höhe des Masters in px. */
  hoehe: number;
  /** Erst nach Eintrag in BILDRECHTE.md auf `true` setzen. */
  rechteGeklaert: boolean;
};

/**
 * Noch keine eigene Aufnahme freigegeben. Die Liste bleibt absichtlich leer,
 * bis der Betreiber Fotos und Rechte geliefert hat (P2).
 */
export const PRODUKTIONSBILDER: readonly Produktionsbild[] = [];

/** Dateinamen der sechs KI-Konzeptmotive — dürfen nie in die Auslieferung. */
const KI_PLATZHALTER = /^0[1-6]-/;

/** Beschreibender `kebab-case`-Name mit der 1200er AVIF-Variante. */
const DATEINAME = /^[a-z0-9]+(?:-[a-z0-9]+)*-1200\.avif$/;

/**
 * Ein Bild darf nur erscheinen, wenn ALLE Zusagen belegt sind. Ein halb
 * ausgefüllter Eintrag sieht vollständig aus und ist rechtlich wie technisch
 * wertlos — dasselbe Muster wie bei `missingLegalFields()`.
 */
export function bildIstFreigegeben(bild: Produktionsbild): boolean {
  const name = bild.pfad.split('/').pop() ?? '';
  return (
    bild.rechteGeklaert === true &&
    bild.pfad.startsWith('/bilder/') &&
    DATEINAME.test(name) &&
    !KI_PLATZHALTER.test(name) &&
    bild.seite.startsWith('/') &&
    bild.seite.endsWith('/') &&
    bild.alt.trim().length > 0 &&
    bild.alt.length <= 125 &&
    bild.bildunterschrift.trim().length > 0 &&
    Number.isInteger(bild.breite) &&
    bild.breite > 0 &&
    Number.isInteger(bild.hoehe) &&
    bild.hoehe > 0
  );
}

/** Nur freigegebene Bilder, optional zusätzlich auf bekannte Seiten begrenzt. */
export function freigegebeneBilder(
  bilder: readonly Produktionsbild[] = PRODUKTIONSBILDER,
  gueltigeSeiten?: ReadonlySet<string>
): Produktionsbild[] {
  return bilder.filter(
    (bild) => bildIstFreigegeben(bild) && (gueltigeSeiten === undefined || gueltigeSeiten.has(bild.seite))
  );
}

/** Verschachtelter `ImageObject`-Knoten für `webPageNode`. */
export function bildZuSchemaKnoten(bild: Produktionsbild, seitenUrl: string) {
  return {
    '@type': 'ImageObject',
    contentUrl: seitenUrl,
    url: seitenUrl,
    description: bild.alt,
    caption: bild.bildunterschrift,
    width: bild.breite,
    height: bild.hoehe,
  };
}
