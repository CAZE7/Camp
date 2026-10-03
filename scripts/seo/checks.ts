/**
 * scripts/seo/checks.ts
 *
 * Prüfregeln für den gebauten Static Export (`out/`) — als reine Funktionen,
 * damit sie ohne Browser und ohne Netz prüfbar bleiben (`checks.test.ts`).
 *
 * Warum ein eigenes Prüfwerkzeug: Kopfdaten, Verweise und strukturierte
 * Beschreibung entstehen aus mehreren Dateien (`app/siteMetadata.ts`,
 * `app/robots.ts`, `app/sitemap.ts`, `components/elektrik/structuredData.ts`).
 * Ein einzelner Blick auf eine Seite belegt nicht, dass auch die anderen zehn
 * stimmen — eine Regel ist erst dann etwas wert, wenn sie maschinell über das
 * ausgelieferte Artefakt läuft (dieselbe Haltung wie `routing:audit` für die
 * Kabelwege).
 *
 * Die Regeln prüfen das Ergebnis, nicht die Absicht: Titel- und
 * Beschreibungslängen, den Verweis auf die eigene Adresse, Vollständigkeit der
 * Vorschaukarten, Erreichbarkeit jeder Seite über interne Verweise und die
 * Übereinstimmung von Crawler-Anweisung und Sitemap.
 */

/** Kleinste und größte übliche Länge einer Beschreibung in Ergebnislisten. */
export const DESCRIPTION_MIN = 50;
export const DESCRIPTION_MAX = 160;

/** Üblicher Bereich für Titel in Ergebnislisten (Kürzen beginnt darüber). */
export const TITLE_MIN = 15;
export const TITLE_MAX = 65;

export type Severity = 'fehler' | 'hinweis';

export type Finding = {
  severity: Severity;
  /** Betroffene Datei im Export, z. B. `out/tools/dach/index.html`. */
  file: string;
  rule: string;
  message: string;
};

/** Zeichenketten ohne HTML-Maskierung — Längen zählen echte Zeichen. */
export function unescapeHtml(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'");
}

/** Wert eines `<meta name=…|property=… content=…>`-Tags, erstes Vorkommen. */
export function metaContent(html: string, attribute: 'name' | 'property', key: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]*${attribute}="${key}"[^>]*content="([^"]*)"|<meta[^>]*content="([^"]*)"[^>]*${attribute}="${key}"`,
    'i'
  );
  const match = pattern.exec(html);
  return match ? unescapeHtml(match[1] ?? match[2] ?? '') : null;
}

/** Inhalt des `<title>`-Elements, ohne Maskierung. */
export function titleOf(html: string): string | null {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? unescapeHtml(match[1]!.trim()) : null;
}

/** Alle Verweise des `<link rel=…>`-Typs, absolut oder relativ. */
export function linkHrefs(html: string, rel: string): string[] {
  const pattern = new RegExp(`<link[^>]*rel="${rel}"[^>]*href="([^"]*)"`, 'gi');
  return [...html.matchAll(pattern)].map((match) => unescapeHtml(match[1]!));
}

/** Anzahl der Überschriften einer Ebene. */
export function headingCount(html: string, level: number): number {
  return (html.match(new RegExp(`<h${level}[\\s>]`, 'gi')) ?? []).length;
}

/** Reihenfolge der Überschriftenebenen (`h1`, `h2`, …) im Dokument. */
export function headingLevels(html: string): number[] {
  return [...html.matchAll(/<h([1-6])[\s>]/gi)].map((match) => Number(match[1]));
}

/**
 * Verweise, die im Export auf eine Datei zeigen müssen — in Export-Schreibweise
 * ohne Herkunft und Basis-Pfad (`/tools/dach/`), damit sie unmittelbar gegen
 * die Dateien in `out/` geprüft werden können.
 *
 * Ausgelassen werden Anker, Fremdadressen, `mailto:`/`tel:` und Adressen, die
 * keine Seite sind (Sitemap, Robots).
 */
export function internalLinkTargets(html: string, origin: string, basePath = ''): string[] {
  const targets = new Set<string>();
  const base = basePath.replace(/\/+$/, '');

  for (const match of html.matchAll(/href="([^"]+)"/gi)) {
    const href = unescapeHtml(match[1]!);
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (!href.startsWith('/') && !href.startsWith(origin)) continue;

    const withoutOrigin = href.startsWith(origin) ? href.slice(origin.length) : href;
    let path = withoutOrigin.split('#')[0]!.split('?')[0]!;
    if (path === '' || path.endsWith('.xml') || path.endsWith('.txt')) continue;
    if (base && path.startsWith(base)) path = path.slice(base.length) || '/';
    targets.add(path.startsWith('/') ? path : `/${path}`);
  }
  return [...targets].sort();
}

/**
 * Große Abhängigkeiten aus dem Planer-Umfeld. Sie dürfen auf statischen
 * Inhaltsseiten nicht im Erstaufbau landen: Ein Kabelquerschnitt-Ratgeber, der
 * elkjs oder GSAP lädt, kostet auf Mobilfunk hunderte Kilobyte für eine
 * Leistung, die er nicht erbringt.
 *
 * Die Kennungen sind bewusst spezifisch (kein „ELK" — das wäre in einem
 * 1,4-MB-Bündel ein Zufallstreffer): gesucht wird nach Bibliotheksnamen, die
 * nur in der jeweiligen Abhängigkeit vorkommen.
 */
export const HEAVY_LIBRARIES = [
  { name: 'elkjs', markers: ['org.eclipse.elk', 'elkjs'] },
  { name: 'dagre', markers: ['dagre'] },
  { name: 'react-flow', markers: ['@xyflow', 'reactflow'] },
  { name: 'gsap', markers: ['gsap', 'GreenSock'] },
] as const;

export type HeavyLibrary = (typeof HEAVY_LIBRARIES)[number]['name'];

/** Quelladressen aller `<script src=…>`-Elemente einer Seite. */
export function scriptSources(html: string): string[] {
  return [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/gi)].map((match) => unescapeHtml(match[1]!));
}

/**
 * Namen der großen Abhängigkeiten, die eine Seite lädt.
 *
 * `resolveChunk` liefert den Inhalt eines Bündels zu einer Quelladresse (oder
 * `null`, wenn die Datei nicht existiert). Als reine Funktion bleibt die
 * Erkennung ohne Dateisystem prüfbar.
 */
export function heavyLibrariesLoaded(
  html: string,
  resolveChunk: (source: string) => string | null
): HeavyLibrary[] {
  const loaded = new Set<HeavyLibrary>();
  for (const source of scriptSources(html)) {
    const code = resolveChunk(source);
    if (code === null) continue;
    for (const library of HEAVY_LIBRARIES) {
      if (library.markers.some((marker) => code.includes(marker))) loaded.add(library.name);
    }
  }
  return [...loaded].sort();
}

/**
 * Prüft, dass eine Inhaltsseite ohne die schweren Planer-Abhängigkeiten
 * auskommt. `allowed` nennt die Ausnahmen je Seite — eine Werkzeugseite darf
 * ihre eigene Bibliothek laden, eine Textseite keine.
 */
export function checkHeavyLibraries(
  file: string,
  html: string,
  options: { resolveChunk: (source: string) => string | null; allowed?: readonly HeavyLibrary[] }
): Finding[] {
  const allowed = new Set(options.allowed ?? []);
  const loaded = heavyLibrariesLoaded(html, options.resolveChunk).filter((library) => !allowed.has(library));
  return loaded.map((library) => ({
    severity: 'fehler' as const,
    file,
    rule: 'bundle-schwer',
    message: `${library} wird auf einer Inhaltsseite geladen — gehört nur in Werkzeug-Ansichten.`,
  }));
}

/**
 * Prüft eine Seite gegen die Regeln, die für sie allein entscheidbar sind.
 *
 * @param file    Datei im Export (für die Meldung)
 * @param html    Inhalt der Datei
 * @param options Erwartungen: eigene Adresse, Basis-Pfad, indexierbar?
 *                `checkCanonical: false` gilt für technische Seiten (Fehlerseite),
 *                die kein eigenes Ziel haben und deren Canonical deshalb aus dem
 *                Wurzel-Layout stammt.
 */
export function checkPage(
  file: string,
  html: string,
  options: { canonical: string; basePath: string; indexable: boolean; checkCanonical?: boolean }
): Finding[] {
  const findings: Finding[] = [];
  const add = (severity: Severity, rule: string, message: string) =>
    findings.push({ severity, file, rule, message });

  const head = html.slice(0, html.indexOf('</head>') === -1 ? html.length : html.indexOf('</head>'));

  const title = titleOf(html);
  if (!title) add('fehler', 'titel', 'Kein <title> im Dokument.');
  else if (title.length < TITLE_MIN || title.length > TITLE_MAX)
    add(
      'hinweis',
      'titel-laenge',
      `Titel misst ${title.length} Zeichen (üblich: ${TITLE_MIN}–${TITLE_MAX}).`
    );

  const description = metaContent(html, 'name', 'description');
  if (!description) add('fehler', 'beschreibung', 'Keine Beschreibung im Dokument.');
  else if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX)
    add(
      'hinweis',
      'beschreibung-laenge',
      `Beschreibung misst ${description.length} Zeichen (üblich: ${DESCRIPTION_MIN}–${DESCRIPTION_MAX}).`
    );

  const canonicals = linkHrefs(head, 'canonical');
  if (options.checkCanonical !== false) {
    if (canonicals.length !== 1) add('fehler', 'canonical', `${canonicals.length}× Canonical (erwartet: 1).`);
    else if (canonicals[0] !== options.canonical)
      add('fehler', 'canonical-ziel', `Canonical zeigt auf ${canonicals[0]}, erwartet ${options.canonical}.`);
  }

  if (!head.includes('<html lang="de"')) {
    const lang = /<html[^>]*lang="([^"]*)"/i.exec(html);
    if (!lang) add('fehler', 'sprache', 'Kein lang-Attribut am <html>-Element.');
    else add('hinweis', 'sprache', `Sprache ist "${lang[1]}".`);
  }

  const h1 = headingCount(html, 1);
  if (h1 !== 1) add('fehler', 'h1', `${h1}× <h1> (erwartet: genau 1).`);

  const levels = headingLevels(html);
  for (let index = 1; index < levels.length; index += 1) {
    if (levels[index]! - levels[index - 1]! > 1) {
      add('hinweis', 'ueberschriften-sprung', `Sprung von h${levels[index - 1]} auf h${levels[index]}.`);
      break;
    }
  }

  for (const key of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type']) {
    if (!metaContent(head, 'property', key)) add('fehler', 'vorschaukarte', `${key} fehlt.`);
  }
  if (metaContent(head, 'name', 'twitter:card') !== 'summary_large_image')
    add('fehler', 'vorschaukarte', 'twitter:card fehlt oder ist nicht summary_large_image.');
  const ogUrl = metaContent(head, 'property', 'og:url');
  if (ogUrl && canonicals[0] && ogUrl !== canonicals[0])
    add('fehler', 'og-url', `og:url (${ogUrl}) weicht vom Canonical ab.`);

  const ogImage = metaContent(head, 'property', 'og:image');
  if (ogImage && !ogImage.startsWith('https://'))
    add('fehler', 'og-bild-absolut', `og:image ist nicht absolut: ${ogImage}`);
  if (ogImage && options.basePath && !ogImage.includes(options.basePath))
    add('fehler', 'og-bild-pfad', `og:image liegt außerhalb des Basis-Pfads: ${ogImage}`);

  if (linkHrefs(head, 'icon').length === 0) add('fehler', 'icon', 'Kein Favicon-Verweis im Kopfbereich.');

  const robots = metaContent(head, 'name', 'robots');
  if (options.indexable && !robots) add('fehler', 'crawler', 'Keine Crawler-Anweisung im Kopfbereich.');
  if (!options.indexable && robots && !robots.includes('noindex'))
    add('fehler', 'crawler', `Seite soll nicht indexiert werden, Anweisung lautet "${robots}".`);
  if (options.indexable && robots && robots.includes('noindex'))
    add('fehler', 'crawler', 'Seite steht auf noindex, ist aber als indexierbar geführt.');

  const withoutAlt = [...html.matchAll(/<img[^>]*>/gi)].filter((match) => !/\salt=/.test(match[0]));
  if (withoutAlt.length > 0)
    add('fehler', 'bild-alternativtext', `${withoutAlt.length} Bild(er) ohne alt-Attribut.`);

  return findings;
}

/**
 * Prüft die strukturierte Beschreibung: gültiges JSON, schema.org als
 * Kontext, belegte Pflichtfelder der verwendeten Typen und Adressen innerhalb
 * der Auslieferung.
 */
export function checkStructuredData(
  file: string,
  html: string,
  options: { origin: string; basePath: string }
): Finding[] {
  const findings: Finding[] = [];
  const add = (severity: Severity, rule: string, message: string) =>
    findings.push({ severity, file, rule, message });

  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  if (blocks.length === 0) {
    add('fehler', 'strukturierte-daten', 'Keine strukturierte Beschreibung im Dokument.');
    return findings;
  }

  for (const [index, block] of blocks.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1]!);
    } catch (error) {
      add('fehler', 'json-ld', `Block ${index + 1} ist kein gültiges JSON: ${String(error)}`);
      continue;
    }

    const graph = (parsed as { '@graph'?: Array<Record<string, unknown>> })['@graph'] ?? [];
    if (graph.length === 0) {
      add('fehler', 'json-ld', `Block ${index + 1} hat keinen @graph.`);
      continue;
    }

    for (const node of graph) {
      const type = String(node['@type'] ?? '');
      if (!type) add('fehler', 'json-ld', `Knoten ohne @type in Block ${index + 1}.`);

      const urls = JSON.stringify(node).match(/https?:\/\/[^"\\]+/g) ?? [];
      for (const url of urls) {
        if (!url.startsWith(options.origin))
          add('fehler', 'json-ld-adresse', `${type}: fremde Adresse ${url}`);
      }

      if (type === 'WebApplication') {
        for (const field of ['name', 'applicationCategory', 'operatingSystem', 'url']) {
          if (!node[field]) add('fehler', 'json-ld-pflichtfeld', `WebApplication ohne ${field}.`);
        }
        if (!node['offers']) add('hinweis', 'json-ld-angebot', 'WebApplication ohne offers (Preisangabe).');
      }

      if (type === 'FAQPage') {
        const questions = (node['mainEntity'] ?? []) as Array<Record<string, unknown>>;
        if (questions.length === 0) add('fehler', 'json-ld-faq', 'FAQPage ohne Fragen.');
        for (const question of questions) {
          const answer = (question['acceptedAnswer'] ?? {}) as Record<string, unknown>;
          if (!question['name'] || !answer['text'])
            add('fehler', 'json-ld-faq', 'Frage ohne Text oder ohne Antwort.');
        }
      }

      if (type === 'BreadcrumbList') {
        const items = (node['itemListElement'] ?? []) as Array<Record<string, unknown>>;
        if (items.length === 0) add('fehler', 'json-ld-brotkrumen', 'BreadcrumbList ohne Einträge.');
      }

      if (type === 'WebPage' && !node['isPartOf'])
        add('hinweis', 'json-ld-verweis', 'WebPage ohne isPartOf-Verweis auf die Website.');
    }
  }

  return findings;
}

/**
 * Prüft Sitemap und Crawler-Anweisung gegeneinander: Jede indexierbare Seite
 * muss in der Sitemap stehen, jede nicht indexierbare darf es nicht – und
 * keine Adresse darf ohne ausgelieferte Datei angeboten werden.
 *
 * Die Adressen in der Sitemap sind absolut und enthalten den Basis-Pfad der
 * Auslieferung; verglichen wird deshalb immer der Pfad OHNE diesen Präfix,
 * damit `indexable`/`nonIndexable`/`exists` in Export-Schreibweise
 * (`/tools/dach/`) übergeben werden können.
 */
export function checkSitemap(
  file: string,
  sitemapXml: string,
  options: {
    indexable: string[];
    nonIndexable: string[];
    basePath: string;
    exists: (path: string) => boolean;
  }
): Finding[] {
  const findings: Finding[] = [];
  const add = (severity: Severity, rule: string, message: string) =>
    findings.push({ severity, file, rule, message });

  const locs = [...sitemapXml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => unescapeHtml(match[1]!));
  if (locs.length === 0) add('fehler', 'sitemap-leer', 'Die Sitemap enthält keine Adressen.');

  const duplicates = locs.filter((loc, index) => locs.indexOf(loc) !== index);
  if (duplicates.length > 0) add('fehler', 'sitemap-doppelt', `Doppelte Adressen: ${duplicates.join(', ')}`);

  const toPath = (loc: string) => {
    const withoutOrigin = loc.replace(/^https?:\/\/[^/]+/, '') || '/';
    const withoutBase = options.basePath ? withoutOrigin.replace(options.basePath, '') : withoutOrigin;
    return withoutBase === '' ? '/' : withoutBase;
  };

  for (const loc of locs) {
    const path = toPath(loc);
    if (!options.exists(path)) add('fehler', 'sitemap-ziel', `${loc} hat keine ausgelieferte Datei.`);
    if (options.nonIndexable.includes(path))
      add('fehler', 'sitemap-noindex', `${loc} steht auf noindex, ist aber in der Sitemap.`);
  }

  for (const path of options.indexable) {
    if (!locs.some((loc) => toPath(loc) === path))
      add('fehler', 'sitemap-fehlend', `Indexierbare Seite ${path} fehlt in der Sitemap.`);
  }

  return findings;
}
