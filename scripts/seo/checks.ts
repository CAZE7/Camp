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

import { JSDOM } from 'jsdom';

import type { CalculatorId } from '../../lib/seo/types';

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

/** Attribute eines einzelnen HTML-Tags (Reihenfolge und Anführungszeichen sind unerheblich). */
function tagAttribute(tag: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return match ? unescapeHtml(match[1] ?? match[2] ?? match[3] ?? '') : null;
}

/** Alle Werte eines `<meta name=…|property=… content=…>`-Typs. */
export function metaContents(html: string, attribute: 'name' | 'property', key: string): string[] {
  return [...html.matchAll(/<meta\b[^>]*>/gi)]
    .filter(
      (match) =>
        tagAttribute(match[0], attribute)?.toLocaleLowerCase('en-US') === key.toLocaleLowerCase('en-US')
    )
    .map((match) => tagAttribute(match[0], 'content') ?? '')
    .filter((value) => value.length > 0);
}

/** Wert eines `<meta name=…|property=… content=…>`-Tags, erstes Vorkommen. */
export function metaContent(html: string, attribute: 'name' | 'property', key: string): string | null {
  return metaContents(html, attribute, key)[0] ?? null;
}

/** Inhalt des `<title>`-Elements, ohne Maskierung. */
export function titleOf(html: string): string | null {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? unescapeHtml(match[1]!.trim()) : null;
}

/** Alle Verweise des `<link rel=…>`-Typs, absolut oder relativ. */
export function linkHrefs(html: string, rel: string): string[] {
  const wanted = rel.toLocaleLowerCase('en-US');
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .filter((match) =>
      (tagAttribute(match[0], 'rel') ?? '').toLocaleLowerCase('en-US').split(/\s+/).includes(wanted)
    )
    .map((match) => tagAttribute(match[0], 'href'))
    .filter((href): href is string => href !== null)
    .map(unescapeHtml);
}

/** Textinhalt ausgewählter Elemente, normalisiert für Inventar-Abgleiche. */
export function selectedText(html: string, selector: string): string[] {
  const dom = new JSDOM(html);
  try {
    return [...dom.window.document.querySelectorAll(selector)].map((node) =>
      (node.textContent ?? '').replace(/\s+/g, ' ').trim()
    );
  } finally {
    dom.window.close();
  }
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
 * Dateien im Export, die eine Adresse ausliefern — in der Form, die GitHub
 * Pages tatsächlich bedient.
 *
 * Der Unterschied ist keine Feinheit: Pages stellt die Formen nicht
 * ineinander um, es kennt nur zwei Regeln — `a/b.html` beantwortet `/a/b`
 * (Endung fällt weg) und `a/b/index.html` beantwortet `/a/b/` (die
 * kürzere Adresse leitet per 308 dorthin um). Ein flaches `a/b.html`
 * beantwortet `/a/b/` deshalb mit 404.
 *
 * Genau daran scheiterte die Auslieferung am 2026-10-03: Die Pipeline baute
 * eine fremde `next.config.js` ohne `trailingSlash`, der Export lag flach vor,
 * und diese Prüfung akzeptierte die flache Datei auch für die Adresse mit
 * Schrägstrich — Sitemap, Canonicals und Verweise zeigten also auf 404, der
 * Lauf blieb grün. Für angekündigte Adressen mit Schrägstrich wird die
 * Verzeichnisform deshalb verlangt, ohne Ausweichlösung.
 */
export function exportFileCandidates(path: string): string[] {
  const relative = path.replace(/^\/+/, '');
  if (path.endsWith('/')) return [relative === '' ? 'index.html' : `${relative}index.html`];
  // Adressen mit Dateiendung (Bilder, Schriften, Symbole) liegen als Datei vor.
  if (/\.[a-z0-9]+$/i.test(relative)) return [relative];
  // Ohne Schrägstrich und ohne Endung: `a.html` ist die exakte Antwort,
  // `a/index.html` ist zulässig, weil Pages `/a` per 308 auf `/a/` umleitet.
  return [`${relative}.html`, `${relative}/index.html`];
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

/** Skripte, die der Browser in der ersten Antwort lädt (inklusive Script-Preloads). */
export function scriptSources(html: string): string[] {
  const sources = [...html.matchAll(/<script\b[^>]*>/gi)]
    .map((match) => tagAttribute(match[0], 'src'))
    .filter((source): source is string => source !== null);

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = (tagAttribute(tag, 'rel') ?? '').toLocaleLowerCase('en-US').split(/\s+/);
    const isScriptPreload =
      rel.includes('modulepreload') || (rel.includes('preload') && tagAttribute(tag, 'as') === 'script');
    const href = tagAttribute(tag, 'href');
    if (isScriptPreload && href) sources.push(href);
  }

  return [...new Set(sources.map(unescapeHtml))];
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

/** Eindeutige UI-Kennungen verhindern, dass Rechner wieder in den SEO-Basischunk rutschen. */
export const CALCULATOR_BUNDLE_MARKERS: readonly { id: CalculatorId; markers: readonly string[] }[] = [
  { id: 'kabelquerschnitt', markers: ['rechner-strom', 'rechner-laenge'] },
  { id: 'spannungsabfall', markers: ['spannung-strom', 'spannung-querschnitt'] },
  { id: 'batteriekapazitaet', markers: ['batterie-energie', 'batterie-tage'] },
  { id: 'solaranlage', markers: ['solar-energie', 'solar-ertrag'] },
];

/** Rechnerkomponenten, deren Code im initial geladenen Skriptbestand vorkommt. */
export function calculatorBundlesLoaded(
  html: string,
  resolveChunk: (source: string) => string | null
): CalculatorId[] {
  const loaded = new Set<CalculatorId>();
  for (const source of scriptSources(html)) {
    const code = resolveChunk(source);
    if (code === null) continue;
    for (const calculator of CALCULATOR_BUNDLE_MARKERS) {
      if (calculator.markers.some((marker) => code.includes(marker))) loaded.add(calculator.id);
    }
  }
  return [...loaded].sort();
}

/** Verhindert, dass ein Text-Ratgeber Rechner-Code herunterlädt, den er nicht rendert. */
export function checkCalculatorBundles(
  file: string,
  html: string,
  options: { resolveChunk: (source: string) => string | null; allowed?: readonly CalculatorId[] }
): Finding[] {
  const allowed = new Set(options.allowed ?? []);
  return calculatorBundlesLoaded(html, options.resolveChunk)
    .filter((calculator) => !allowed.has(calculator))
    .map((calculator) => ({
      severity: 'fehler' as const,
      file,
      rule: 'rechner-bundle',
      message: `Der ${calculator}-Rechner wird im initialen Skriptbestand geladen, obwohl die Seite ihn nicht rendert.`,
    }));
}

/** Gemessene unkomprimierte Erstaufbau-Skripte gegen ein Seitenbudget prüfen. */
export function checkInitialScriptBudget(file: string, bytes: number, budgetBytes: number): Finding[] {
  if (!Number.isFinite(bytes) || bytes < 0 || !Number.isFinite(budgetBytes) || budgetBytes < 0) {
    throw new RangeError('Script- und Budgetgröße müssen endliche, nicht-negative Bytewerte sein.');
  }
  if (bytes <= budgetBytes) return [];
  return [
    {
      severity: 'fehler',
      file,
      rule: 'initial-js-budget',
      message: `Initiale Skripte umfassen ${(bytes / 1024).toFixed(1)} KiB; Budget ${(budgetBytes / 1024).toFixed(0)} KiB.`,
    },
  ];
}

/**
 * Prüft eine Seite gegen die Regeln, die für sie allein entscheidbar sind.
 * Erwartete Kopfdaten und H1 stammen aus dem Inventar; technische Fehlerseiten
 * können Canonical ausdrücklich verbieten, statt eine geerbte Homepage-Adresse
 * durchzulassen.
 */
export function checkPage(
  file: string,
  html: string,
  options: {
    canonical: string;
    basePath: string;
    indexable: boolean;
    checkCanonical?: boolean;
    forbidCanonical?: boolean;
    expectedTitle?: string;
    expectedDescription?: string;
    expectedSocialTitle?: string;
    expectedSocialDescription?: string;
    expectedSocialImage?: string;
    expectedSocialImageAlt?: string;
    expectedSocialImageWidth?: number;
    expectedSocialImageHeight?: number;
    expectedSocialSiteName?: string;
    expectedH1?: string;
    checkSocialMetadata?: boolean;
    forbidSocialMetadata?: boolean;
  }
): Finding[] {
  const findings: Finding[] = [];
  const add = (severity: Severity, rule: string, message: string) =>
    findings.push({ severity, file, rule, message });
  const headEnd = html.toLowerCase().indexOf('</head>');
  const head = html.slice(0, headEnd === -1 ? html.length : headEnd);

  const titles = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)];
  const title = titleOf(html);
  if (titles.length !== 1) add('fehler', 'titel-anzahl', `${titles.length}× <title> (erwartet: genau 1).`);
  if (!title) add('fehler', 'titel', 'Kein <title> im Dokument.');
  else {
    if (title.length < TITLE_MIN || title.length > TITLE_MAX)
      add(
        'hinweis',
        'titel-laenge',
        `Titel misst ${title.length} Zeichen (üblich: ${TITLE_MIN}–${TITLE_MAX}).`
      );
    if (options.expectedTitle && title !== options.expectedTitle)
      add('fehler', 'titel-inventar', `Titel lautet "${title}", erwartet "${options.expectedTitle}".`);
  }

  const descriptions = metaContents(head, 'name', 'description');
  const description = descriptions[0] ?? null;
  if (descriptions.length !== 1)
    add('fehler', 'beschreibung-anzahl', `${descriptions.length}× meta description (erwartet: genau 1).`);
  if (!description) add('fehler', 'beschreibung', 'Keine Beschreibung im Dokument.');
  else {
    if (description.length < DESCRIPTION_MIN || description.length > DESCRIPTION_MAX)
      add(
        'hinweis',
        'beschreibung-laenge',
        `Beschreibung misst ${description.length} Zeichen (üblich: ${DESCRIPTION_MIN}–${DESCRIPTION_MAX}).`
      );
    if (options.expectedDescription && description !== options.expectedDescription)
      add('fehler', 'beschreibung-inventar', 'Meta description weicht von der Inventar-Beschreibung ab.');
  }

  const canonicals = linkHrefs(head, 'canonical');
  if (options.forbidCanonical) {
    if (canonicals.length > 0)
      add(
        'fehler',
        'canonical-verboten',
        `Technische Fehlerseite trägt ${canonicals.length} Canonical-Verweis(e).`
      );
  } else if (options.checkCanonical !== false) {
    if (canonicals.length !== 1) add('fehler', 'canonical', `${canonicals.length}× Canonical (erwartet: 1).`);
    else if (canonicals[0] !== options.canonical)
      add('fehler', 'canonical-ziel', `Canonical zeigt auf ${canonicals[0]}, erwartet ${options.canonical}.`);
  }

  const language = /<html\b[^>]*\blang=["']([^"']*)["']/i.exec(html)?.[1];
  if (!language) add('fehler', 'sprache', 'Kein lang-Attribut am <html>-Element.');
  else if (language.toLocaleLowerCase('en-US') !== 'de')
    add('hinweis', 'sprache', `Sprache ist "${language}".`);

  const h1Count = headingCount(html, 1);
  const h1s = selectedText(html, 'h1');
  if (h1Count !== 1) add('fehler', 'h1', `${h1Count}× <h1> (erwartet: genau 1).`);
  if (h1s.length === 1 && options.expectedH1 && h1s[0] !== options.expectedH1)
    add('fehler', 'h1-inventar', `H1 lautet "${h1s[0]}", erwartet "${options.expectedH1}".`);

  if (options.indexable) {
    const dom = new JSDOM(html);
    try {
      const main = dom.window.document.querySelector('main');
      const mainText = (main?.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!main) add('fehler', 'hauptinhalt', 'Indexierbare Seite hat kein <main>-Element.');
      else if (mainText.length < 80)
        add(
          'fehler',
          'hauptinhalt-duenn',
          `Sichtbarer <main>-Inhalt umfasst nur ${mainText.length} Zeichen.`
        );
    } finally {
      dom.window.close();
    }
  }

  const levels = headingLevels(html);
  for (let index = 1; index < levels.length; index += 1) {
    if (levels[index]! - levels[index - 1]! > 1) {
      add('hinweis', 'ueberschriften-sprung', `Sprung von h${levels[index - 1]} auf h${levels[index]}.`);
      break;
    }
  }

  const socialMetaTags = [...head.matchAll(/<meta\b[^>]*>/gi)].filter((match) => {
    const property = tagAttribute(match[0], 'property')?.toLocaleLowerCase('en-US') ?? '';
    const name = tagAttribute(match[0], 'name')?.toLocaleLowerCase('en-US') ?? '';
    return property.startsWith('og:') || name.startsWith('twitter:');
  });
  if (options.forbidSocialMetadata && socialMetaTags.length > 0)
    add(
      'fehler',
      'vorschaukarte-verboten',
      `Technische Fehlerseite trägt ${socialMetaTags.length} Open-Graph-/Twitter-Tags.`
    );

  if (options.checkSocialMetadata !== false && !options.forbidSocialMetadata) {
    const socialExpected: ReadonlyArray<readonly ['property' | 'name', string, string?]> = [
      ['property', 'og:title', options.expectedSocialTitle],
      ['property', 'og:description', options.expectedSocialDescription],
      ['property', 'og:url', options.canonical],
      ['property', 'og:site_name', options.expectedSocialSiteName],
      ['property', 'og:locale', 'de_DE'],
      ['property', 'og:image', options.expectedSocialImage],
      ['property', 'og:image:alt', options.expectedSocialImageAlt],
      ['property', 'og:image:width', options.expectedSocialImageWidth?.toString()],
      ['property', 'og:image:height', options.expectedSocialImageHeight?.toString()],
      ['property', 'og:type', 'website'],
      ['name', 'twitter:card', 'summary_large_image'],
      ['name', 'twitter:title', options.expectedSocialTitle],
      ['name', 'twitter:description', options.expectedSocialDescription],
      ['name', 'twitter:image', options.expectedSocialImage],
      ['name', 'twitter:image:alt', options.expectedSocialImageAlt],
    ];
    for (const [attribute, key, expected] of socialExpected) {
      const values = metaContents(head, attribute, key);
      if (values.length !== 1)
        add('fehler', 'vorschaukarte', `${key}: ${values.length}× (erwartet: genau 1).`);
      else if (expected !== undefined && values[0] !== expected)
        add('fehler', key === 'og:url' ? 'og-url' : 'vorschaukarte', `${key} weicht vom erwarteten Wert ab.`);
    }

    const ogUrl = metaContent(head, 'property', 'og:url');
    if (ogUrl && canonicals[0] && ogUrl !== canonicals[0])
      add('fehler', 'og-url', `og:url (${ogUrl}) weicht vom Canonical ab.`);

    const ogImage = metaContent(head, 'property', 'og:image');
    if (ogImage) {
      try {
        const parsedImage = new URL(ogImage);
        if (parsedImage.protocol !== 'https:')
          add('fehler', 'og-bild-absolut', `og:image ist nicht HTTPS: ${ogImage}`);
        if (options.basePath && !parsedImage.pathname.startsWith(`${options.basePath}/`))
          add('fehler', 'og-bild-pfad', `og:image liegt außerhalb des Basis-Pfads: ${ogImage}`);
      } catch {
        add('fehler', 'og-bild-absolut', `og:image ist keine gültige absolute Adresse: ${ogImage}`);
      }
    }
  }

  if (linkHrefs(head, 'icon').length === 0) add('fehler', 'icon', 'Kein Favicon-Verweis im Kopfbereich.');

  const robotsValues = metaContents(head, 'name', 'robots');
  if (robotsValues.length !== 1)
    add('fehler', 'crawler-anzahl', `${robotsValues.length}× robots-Anweisung (erwartet: genau 1).`);
  const robots = robotsValues[0] ?? '';
  const directives = robots.split(',').map((directive) => directive.trim().toLocaleLowerCase('en-US'));
  if (options.indexable && !directives.includes('index'))
    add('fehler', 'crawler', `Indexierbare Seite enthält keine index-Anweisung (robots="${robots}").`);
  if (options.indexable && directives.includes('noindex'))
    add('fehler', 'crawler', 'Seite steht auf noindex, ist aber als indexierbar geführt.');
  if (!options.indexable && !directives.includes('noindex'))
    add('fehler', 'crawler', `Seite soll nicht indexiert werden, Anweisung lautet "${robots}".`);
  if (!options.indexable && directives.includes('index'))
    add('fehler', 'crawler', 'Nicht indexierbare Seite enthält zusätzlich die index-Anweisung.');

  const dom = new JSDOM(html);
  try {
    const imagesWithoutAlt = [...dom.window.document.querySelectorAll('img:not([alt])')];
    if (imagesWithoutAlt.length > 0)
      add('fehler', 'bild-alternativtext', `${imagesWithoutAlt.length} Bild(er) ohne alt-Attribut.`);
  } finally {
    dom.window.close();
  }

  return findings;
}

/**
 * Prüft JSON-LD gegen das Inventar und die auf der Seite sichtbare Darstellung.
 * Gültiges JSON allein reicht nicht: H1, Beschreibung, Brotkrumen und Fragen
 * müssen dieselben Texte und Ziele wie die sichtbare Seite beschreiben.
 */
export function checkStructuredData(
  file: string,
  html: string,
  options: {
    origin: string;
    basePath: string;
    expectedTypes?: readonly string[];
    expectedCanonical?: string;
    expectedH1?: string;
    expectedDescription?: string;
  }
): Finding[] {
  const findings: Finding[] = [];
  const add = (severity: Severity, rule: string, message: string) =>
    findings.push({ severity, file, rule, message });
  const blocks = [
    ...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  if (blocks.length === 0) {
    add('fehler', 'strukturierte-daten', 'Keine strukturierte Beschreibung im Dokument.');
    return findings;
  }

  const nodes: Array<Record<string, unknown>> = [];
  for (const [index, block] of blocks.entries()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1]!);
    } catch (error) {
      add('fehler', 'json-ld', `Block ${index + 1} ist kein gültiges JSON: ${String(error)}`);
      continue;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      add('fehler', 'json-ld', `Block ${index + 1} ist kein JSON-LD-Graph-Objekt.`);
      continue;
    }
    const graphObject = parsed as { '@context'?: unknown; '@graph'?: unknown };
    if (graphObject['@context'] !== 'https://schema.org')
      add('fehler', 'json-ld-kontext', `Block ${index + 1} hat keinen schema.org-@context.`);
    if (!Array.isArray(graphObject['@graph']) || graphObject['@graph'].length === 0) {
      add('fehler', 'json-ld', `Block ${index + 1} hat keinen @graph.`);
      continue;
    }
    for (const node of graphObject['@graph']) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) {
        add('fehler', 'json-ld', `Nicht-objektförmiger Knoten in Block ${index + 1}.`);
        continue;
      }
      nodes.push(node as Record<string, unknown>);
    }
  }

  const nodeTypes = nodes.map((node) => {
    const value = node['@type'];
    return Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
  });
  const sharedSiteTypes = new Set(['WebSite', 'Organization']);
  const actualPageTypes = new Set(nodeTypes.flat().filter((type) => !sharedSiteTypes.has(type)));
  for (const [index, types] of nodeTypes.entries()) {
    if (types.length === 0) add('fehler', 'json-ld', `Knoten ${index + 1} ohne @type.`);

    for (const value of Object.values(nodes[index]!)) {
      const visit = (item: unknown): void => {
        if (typeof item === 'string' && /^https?:\/\//i.test(item)) {
          try {
            if (new URL(item).origin !== options.origin)
              add('fehler', 'json-ld-adresse', `${types[0] ?? 'Knoten'}: fremde Adresse ${item}`);
          } catch {
            add('fehler', 'json-ld-adresse', `${types[0] ?? 'Knoten'}: ungültige Adresse ${item}`);
          }
        } else if (Array.isArray(item)) {
          item.forEach(visit);
        } else if (item && typeof item === 'object') {
          Object.values(item as Record<string, unknown>).forEach(visit);
        }
      };
      visit(value);
    }
  }

  if (options.expectedTypes) {
    for (const type of options.expectedTypes) {
      const count = nodeTypes.filter((types) => types.includes(type)).length;
      if (count !== 1)
        add('fehler', 'json-ld-inventar', `${type}: ${count} Knoten (im Inventar erwartet: genau 1).`);
    }
    for (const type of actualPageTypes) {
      if (!options.expectedTypes.includes(type))
        add(
          'fehler',
          'json-ld-inventar',
          `${type} ist im Markup vorhanden, aber im Inventar nicht angekündigt.`
        );
    }
  }

  const webPages = nodes.filter((node) => {
    const type = node['@type'];
    return type === 'WebPage' || type === 'CollectionPage';
  });
  for (const node of webPages) {
    if (!node['isPartOf'])
      add('hinweis', 'json-ld-verweis', 'WebPage ohne isPartOf-Verweis auf die Website.');
    if (options.expectedCanonical && node['url'] !== options.expectedCanonical)
      add('fehler', 'json-ld-url', `WebPage-URL ${String(node['url'] ?? '')} weicht vom Canonical ab.`);
    if (options.expectedH1 && node['name'] !== options.expectedH1)
      add(
        'fehler',
        'json-ld-h1',
        `WebPage.name stimmt nicht mit der sichtbaren H1 "${options.expectedH1}" überein.`
      );
    if (options.expectedDescription && node['description'] !== options.expectedDescription)
      add('fehler', 'json-ld-beschreibung', 'WebPage.description weicht von der Inventar-Beschreibung ab.');
  }

  const applications = nodes.filter((node) => node['@type'] === 'WebApplication');
  for (const node of applications) {
    for (const field of ['name', 'applicationCategory', 'operatingSystem', 'url']) {
      if (!node[field]) add('fehler', 'json-ld-pflichtfeld', `WebApplication ohne ${field}.`);
    }
    if (!node['offers']) add('hinweis', 'json-ld-angebot', 'WebApplication ohne offers (Preisangabe).');
    if (options.expectedCanonical && node['url'] !== options.expectedCanonical)
      add(
        'fehler',
        'json-ld-url',
        `WebApplication-URL ${String(node['url'] ?? '')} weicht vom Canonical ab.`
      );
    if (options.expectedH1 && node['name'] !== options.expectedH1)
      add('fehler', 'json-ld-h1', 'WebApplication.name stimmt nicht mit der sichtbaren H1 überein.');
    if (options.expectedDescription && node['description'] !== options.expectedDescription)
      add(
        'fehler',
        'json-ld-beschreibung',
        'WebApplication.description weicht von der Inventar-Beschreibung ab.'
      );
  }

  const dom = new JSDOM(html, { url: options.origin });
  try {
    const visibleBreadcrumbNav = dom.window.document.querySelector('nav[aria-label="Pfad"]');
    const visibleBreadcrumbs = visibleBreadcrumbNav
      ? [...visibleBreadcrumbNav.querySelectorAll('li')].flatMap((listItem) => {
          const labelElement = listItem.matches('[aria-current="page"]')
            ? listItem
            : listItem.querySelector('a, [aria-current="page"]');
          if (!labelElement) return [];
          const name = (labelElement.textContent ?? '').replace(/\s+/g, ' ').trim();
          const rawHref =
            labelElement instanceof dom.window.HTMLAnchorElement ? labelElement.getAttribute('href') : null;
          let item = options.expectedCanonical ?? '';
          if (rawHref) {
            try {
              item = new URL(rawHref, options.origin).href;
            } catch {
              add(
                'fehler',
                'json-ld-brotkrumen-sichtbar',
                `Sichtbarer Breadcrumb-Link ist ungültig: ${rawHref}`
              );
            }
          }
          return [{ name, item }];
        })
      : [];

    const breadcrumbNodes = nodes.filter((node) => node['@type'] === 'BreadcrumbList');
    for (const node of breadcrumbNodes) {
      const items = Array.isArray(node['itemListElement'])
        ? (node['itemListElement'] as Array<Record<string, unknown>>)
        : [];
      if (items.length === 0) {
        add('fehler', 'json-ld-brotkrumen', 'BreadcrumbList ohne Einträge.');
        continue;
      }
      if (!visibleBreadcrumbNav || visibleBreadcrumbs.length === 0) {
        add(
          'fehler',
          'json-ld-brotkrumen-sichtbar',
          'BreadcrumbList ist vorhanden, aber keine sichtbare Brotkrumenspur.'
        );
        continue;
      }
      if (items.length !== visibleBreadcrumbs.length) {
        add(
          'fehler',
          'json-ld-brotkrumen-abgleich',
          'Anzahl der JSON-LD-Brotkrumen weicht von der sichtbaren Spur ab.'
        );
        continue;
      }
      items.forEach((item, index) => {
        const expected = visibleBreadcrumbs[index]!;
        const itemValue = item['item'];
        const itemUrl =
          typeof itemValue === 'string'
            ? itemValue
            : itemValue && typeof itemValue === 'object'
              ? String(
                  (itemValue as Record<string, unknown>)['@id'] ??
                    (itemValue as Record<string, unknown>)['url'] ??
                    ''
                )
              : '';
        if (item['name'] !== expected.name || itemUrl !== expected.item)
          add(
            'fehler',
            'json-ld-brotkrumen-abgleich',
            `Breadcrumb ${index + 1} stimmt nicht mit der sichtbaren Spur überein.`
          );
      });
    }

    const faqSections = [...dom.window.document.querySelectorAll('section')];
    const faqSection = faqSections.find((section) => {
      const heading = (section.querySelector('h2')?.textContent ?? '').replace(/\s+/g, ' ').trim();
      return heading.startsWith('Häufige Fragen');
    });
    const visibleFaqs = faqSection
      ? [...faqSection.querySelectorAll('details')].map((detail) => ({
          question: (detail.querySelector('summary')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
          answer: (detail.querySelector('p')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        }))
      : [];
    const faqNodes = nodes.filter((node) => node['@type'] === 'FAQPage');
    for (const node of faqNodes) {
      const questions = Array.isArray(node['mainEntity'])
        ? (node['mainEntity'] as Array<Record<string, unknown>>)
        : [];
      if (questions.length === 0) {
        add('fehler', 'json-ld-faq', 'FAQPage ohne Fragen.');
        continue;
      }
      const incompleteQuestion = questions.find((question) => {
        const answer = (question['acceptedAnswer'] ?? {}) as Record<string, unknown>;
        return !question['name'] || !answer['text'];
      });
      if (incompleteQuestion) add('fehler', 'json-ld-faq', 'Frage ohne Text oder ohne Antwort.');
      if (questions.length !== visibleFaqs.length) {
        add(
          'fehler',
          'json-ld-faq-abgleich',
          'Anzahl der JSON-LD-Fragen weicht vom sichtbaren FAQ-Akkordeon ab.'
        );
        continue;
      }
      questions.forEach((question, index) => {
        const answer = (question['acceptedAnswer'] ?? {}) as Record<string, unknown>;
        const visible = visibleFaqs[index]!;
        if (
          question['name'] &&
          answer['text'] &&
          (question['name'] !== visible.question || answer['text'] !== visible.answer)
        ) {
          add(
            'fehler',
            'json-ld-faq-abgleich',
            `FAQ ${index + 1} weicht von Frage oder Antwort im sichtbaren Akkordeon ab.`
          );
        }
      });
    }
  } finally {
    dom.window.close();
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
    origin?: string;
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

  const toPath = (loc: string): string | null => {
    let url: URL;
    try {
      url = new URL(loc);
    } catch {
      add('fehler', 'sitemap-url', `Ungültige Sitemap-Adresse: ${loc}`);
      return null;
    }
    if (!/^https?:$/.test(url.protocol)) {
      add('fehler', 'sitemap-url', `Nicht-HTTP-Adresse in der Sitemap: ${loc}`);
      return null;
    }
    if (options.origin && url.origin !== options.origin)
      add('fehler', 'sitemap-host', `${loc} liegt außerhalb der Site-Origin ${options.origin}.`);

    let path = url.pathname || '/';
    const base = options.basePath.replace(/\/+$/, '');
    if (base) {
      if (path === base || path === `${base}/`) path = '/';
      else if (path.startsWith(`${base}/`)) path = path.slice(base.length) || '/';
      else add('fehler', 'sitemap-basepath', `${loc} liegt nicht unter dem Basis-Pfad ${base}.`);
    }
    return path;
  };

  const paths = locs.map(toPath);
  for (const [index, loc] of locs.entries()) {
    const path = paths[index];
    if (!path) continue;
    if (!options.exists(path)) add('fehler', 'sitemap-ziel', `${loc} hat keine ausgelieferte Datei.`);
    if (options.nonIndexable.includes(path))
      add('fehler', 'sitemap-noindex', `${loc} steht auf noindex, ist aber in der Sitemap.`);

    const knownCanonical = [...options.indexable, ...options.nonIndexable].find(
      (candidate) => candidate.replace(/\/+$/, '') === path.replace(/\/+$/, '')
    );
    if (knownCanonical && knownCanonical !== path)
      add('fehler', 'sitemap-canonical', `${loc} ist nicht kanonisch; erwartet wird ${knownCanonical}.`);
  }

  for (const path of options.indexable) {
    if (!paths.includes(path))
      add('fehler', 'sitemap-fehlend', `Indexierbare Seite ${path} fehlt in der Sitemap.`);
  }

  return findings;
}
