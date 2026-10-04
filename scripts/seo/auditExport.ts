/**
 * scripts/seo/auditExport.ts
 *
 * Prüft den gebauten Static Export (`out/`) gegen die Regeln in `checks.ts`.
 *
 *   npm run build && npm run seo:audit
 *
 * Exit-Code 1, sobald eine Regel der Stufe `fehler` verletzt ist. Hinweise
 * werden gemeldet, ohne den Lauf zu kippen — sie sind Entscheidungen des
 * Betreibers (z. B. ein längerer Titel), keine Defekte.
 *
 * Die Zusage, WELCHE Seiten es geben soll, kommt aus `lib/seo/inventory.ts` —
 * einer Erklärung des Betreibers, nicht aus dem Prüfling. Geprüft wird der
 * gebaute Export dagegen: Fehlt eine erklärte Seite, ist ein Titel doppelt
 * oder steht eine Seite auf noindex, obwohl sie indexierbar sein soll, meldet
 * das die Prüfung. Eine hier kopierte Liste wäre die dritte Stelle, an der
 * eine Seite vergessen werden kann.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { DEFAULT_PREVIEW_IMAGE } from '../../app/siteMetadata';
import { SITE_ORIGIN, SITE_BASE_PATH, SITE_NAME, siteUrl } from '../../lib/site';
import { indexablePages, nonIndexablePages, pageByPath, TECHNICAL_PAGES } from '../../lib/seo/inventory';
import { THIN_CONTENT_KINDS } from '../../lib/seo/types';
import {
  type Finding,
  type HeavyLibrary,
  checkCalculatorBundles,
  checkHeavyLibraries,
  checkInitialScriptBudget,
  checkPage,
  checkSitemap,
  checkStructuredData,
  exportFileCandidates,
  internalLinkTargets,
  metaContent,
  scriptSources,
  titleOf,
} from './checks';
import { analyzeInternalLinkGraph } from './linkGraph';

/** Seiten, die in den Index gehören — erklärt im Inventar, geprüft im Export. */
const INDEXIERBARE_SEITEN = indexablePages().map((page) => page.path);

/** Seiten ohne eigenen Inhalt für Ergebnislisten — sie tragen `noindex`. */
const NICHT_INDEXIERBARE_SEITEN = nonIndexablePages().map((page) => page.path);

/**
 * Technische Seiten der Auslieferung: von Next erzeugt, nirgends verlinkt und
 * nicht beworben. Für sie gilt nur eine Zusage — sie dürfen NICHT indexiert
 * werden. Prüfungen auf eigene Adresse, doppelte Titel und Erreichbarkeit
 * laufen ins Leere, weil alle drei Ausprägungen dieselbe Fehlerseite sind.
 */
const TECHNISCHE_SEITEN = TECHNICAL_PAGES;

/**
 * Werkzeugseiten dürfen ihre eigene schwere Bibliothek laden — die Ansicht
 * braucht sie. Für jede andere Seite ist eine solche Abhängigkeit ein Fehler:
 * Sie kostet Ladezeit und bringt der Seite nichts (§34, §35).
 */
const ERLAUBTE_BIBLIOTHEKEN: Record<string, readonly HeavyLibrary[]> = {
  '/tools/dach/': ['react-flow', 'dagre', 'elkjs'],
};

/** Gemessene Erstaufbau-Budgets (unkomprimierte Skripte inkl. Script-Preloads). */
const INITIAL_SCRIPT_BUDGETS: Record<string, number> = {
  default: 700 * 1024,
  '/elektrik-planung/': 750 * 1024,
  '/tools/heizung/': 900 * 1024,
  '/tools/dach/': 1100 * 1024,
  // Auch ohne Indexstatus soll die Chat-Ansicht das AI-SDK erst nach Klick laden.
  '/ki-assistent/': 700 * 1024,
};

/** Wortzahl, unter der eine Inhaltsseite als dünn gilt (Hinweis, kein Fehler). */
const WOERTER_MINDESTBESTAND = 300;

const OUT = 'out';

const BASE = SITE_BASE_PATH ? `${SITE_ORIGIN}${SITE_BASE_PATH}` : SITE_ORIGIN;

/** Seitenadresse einer Export-Datei (`out/a/index.html` → `/a/`). */
function pagePathOf(file: string): string {
  // `relative()` liefert unter Windows Rückstriche; Adressen im HTML stehen mit
  // Vorstrichen — ohne Normierung gilt dort jede Unterseite als unerreichbar.
  return `/${relative(OUT, file)
    .replace(/index\.html$/, '')
    .split(sep)
    .join('/')}`;
}

/**
 * Datei, die eine Seitenadresse bedient (`/a/` → `out/a/index.html`).
 *
 * Die Zuordnung ist formtreu: Adressen mit Schrägstrich verlangen die
 * Verzeichnisform (`exportFileCandidates` in `checks.ts` erklärt, warum eine
 * flache Datei diese Adresse auf GitHub Pages nicht bedient).
 */
function fileForPath(path: string): string | null {
  for (const candidate of exportFileCandidates(path)) {
    const file = join(OUT, candidate);
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

function listPages(): string[] {
  const pages: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === 'index.html') pages.push(full);
    }
  };
  walk(OUT);
  return pages;
}

/** Tatsächliche Sitemap-Ziele in Export-Schreibweise für den Linkgraph-Bericht. */
function sitemapPathsFromXml(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].flatMap((match) => {
    try {
      const url = new URL(match[1]!);
      let path = url.pathname || '/';
      if (SITE_BASE_PATH) {
        if (path === SITE_BASE_PATH || path === `${SITE_BASE_PATH}/`) path = '/';
        else if (path.startsWith(`${SITE_BASE_PATH}/`)) path = path.slice(SITE_BASE_PATH.length) || '/';
      }
      return [path];
    } catch {
      return [];
    }
  });
}

function main(): void {
  if (!existsSync(OUT)) {
    process.stderr.write(
      `\nDer Export fehlt. Erst bauen: NEXT_PUBLIC_BASE_PATH=${SITE_BASE_PATH || '/Camp'} npm run build\n`
    );
    process.exitCode = 1;
    return;
  }

  const findings: Finding[] = [];
  const pages = listPages();
  const indexablePaths = new Set(INDEXIERBARE_SEITEN);

  const titles = new Map<string, string>();
  const descriptions = new Map<string, string>();

  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    const path = pagePathOf(page);
    const indexable = indexablePaths.has(path);
    const technisch = TECHNISCHE_SEITEN.includes(path);

    const entry = pageByPath(path);
    const expectedTitle = entry
      ? entry.absoluteTitle
        ? entry.title
        : `${entry.title} | ${SITE_NAME}`
      : undefined;
    const canonical = `${BASE}${path}`;
    const previewImage = entry?.ogImage ?? DEFAULT_PREVIEW_IMAGE;
    findings.push(
      ...checkPage(page, html, {
        canonical,
        basePath: SITE_BASE_PATH,
        indexable,
        forbidCanonical: technisch,
        forbidSocialMetadata: technisch,
        checkSocialMetadata: !technisch,
        expectedTitle,
        expectedDescription: entry?.description,
        expectedSocialTitle: entry?.title,
        expectedSocialDescription: entry?.description,
        expectedSocialImage: siteUrl(previewImage.path),
        expectedSocialImageAlt: previewImage.alt,
        expectedSocialImageWidth: previewImage.width,
        expectedSocialImageHeight: previewImage.height,
        expectedSocialSiteName: SITE_NAME,
        expectedH1: entry?.h1,
      })
    );
    findings.push(
      ...checkStructuredData(page, html, {
        origin: SITE_ORIGIN,
        basePath: SITE_BASE_PATH,
        ...(entry?.indexability === 'index'
          ? {
              expectedTypes: entry.structuredData,
              expectedCanonical: canonical,
              expectedH1: entry.h1,
              expectedDescription: entry.description,
            }
          : {}),
      })
    );
    const resolveChunk = (source: string) => {
      const withoutOrigin = source.replace(/^https?:\/\/[^/]+/i, '');
      const relative = withoutOrigin.split('?')[0]!.replace(/^\/+/, '');
      const withoutBase =
        SITE_BASE_PATH && relative.startsWith(SITE_BASE_PATH.replace(/^\//, ''))
          ? relative.slice(SITE_BASE_PATH.replace(/^\//, '').length + 1)
          : relative;
      const file = join(OUT, withoutBase);
      return existsSync(file) ? readFileSync(file, 'utf8') : null;
    };
    findings.push(
      ...checkHeavyLibraries(page, html, {
        resolveChunk,
        allowed: ERLAUBTE_BIBLIOTHEKEN[path] ?? [],
      })
    );
    findings.push(
      ...checkCalculatorBundles(page, html, {
        resolveChunk,
        allowed: entry?.calculators ?? [],
      })
    );
    const hasExplicitScriptBudget = INITIAL_SCRIPT_BUDGETS[path] !== undefined;
    if (indexable || hasExplicitScriptBudget) {
      const initialScriptBytes = scriptSources(html).reduce((total, source) => {
        const code = resolveChunk(source);
        return code === null ? total : total + Buffer.byteLength(code, 'utf8');
      }, 0);
      findings.push(
        ...checkInitialScriptBudget(
          page,
          initialScriptBytes,
          INITIAL_SCRIPT_BUDGETS[path] ?? INITIAL_SCRIPT_BUDGETS.default!
        )
      );
    }

    // Dünne Seiten: Ein Hinweis, kein Fehler — die Entscheidung, ob eine kurze
    // Seite ihren Zweck erfüllt, ist eine redaktionelle, keine technische.
    if (!entry && !technisch) {
      findings.push({
        severity: 'fehler',
        file: page,
        rule: 'route-ohne-inventar',
        message: `${path} liefert HTML aus, fehlt aber im SEO-Inventar.`,
      });
    }
    if (entry && THIN_CONTENT_KINDS.includes(entry.kind) && entry.indexability === 'index') {
      const words = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 0).length;
      if (words < WOERTER_MINDESTBESTAND) {
        findings.push({
          severity: 'hinweis',
          file: page,
          rule: 'seite-duenn',
          message: `${words} Wörter — unter dem Mindestbestand von ${WOERTER_MINDESTBESTAND} für Seitenart "${entry.kind}".`,
        });
      }
    }

    // Technische Seiten (Fehlerseite) sind dreimal dieselbe Datei: Sie werden
    // weder auf doppelte Titel geprüft noch verlinkt oder beworben.
    if (technisch) continue;

    const title = titleOf(html) ?? '';
    const description = metaContent(html, 'name', 'description') ?? '';
    if (titles.has(title)) {
      findings.push({
        severity: 'fehler',
        file: page,
        rule: 'titel-doppelt',
        message: `Titel identisch mit ${titles.get(title)}.`,
      });
    } else titles.set(title, path);
    if (descriptions.has(description)) {
      findings.push({
        severity: 'fehler',
        file: page,
        rule: 'beschreibung-doppelt',
        message: `Beschreibung identisch mit ${descriptions.get(description)}.`,
      });
    } else descriptions.set(description, path);
  }

  const sitemapFile = join(OUT, 'sitemap.xml');
  const sitemapPaths: string[] = [];
  if (existsSync(sitemapFile)) {
    const sitemapXml = readFileSync(sitemapFile, 'utf8');
    findings.push(
      ...checkSitemap(sitemapFile, sitemapXml, {
        indexable: INDEXIERBARE_SEITEN,
        nonIndexable: [...NICHT_INDEXIERBARE_SEITEN, ...TECHNISCHE_SEITEN],
        basePath: SITE_BASE_PATH,
        origin: SITE_ORIGIN,
        exists: (path) => fileForPath(path) !== null,
      })
    );
    sitemapPaths.push(...sitemapPathsFromXml(sitemapXml));
  } else {
    findings.push({ severity: 'fehler', file: OUT, rule: 'sitemap', message: 'sitemap.xml fehlt.' });
  }

  const graph = analyzeInternalLinkGraph({
    pages: pages.map((file) => {
      const path = pagePathOf(file);
      return { path, html: readFileSync(file, 'utf8'), entry: pageByPath(path) };
    }),
    origin: SITE_ORIGIN,
    basePath: SITE_BASE_PATH,
    sitemapPaths,
    technicalPaths: TECHNISCHE_SEITEN,
  });
  for (const finding of graph.findings) {
    findings.push({
      severity: finding.severity,
      file: fileForPath(finding.path) ?? OUT,
      rule: finding.rule,
      message: finding.message,
    });
  }

  // Verweise auf exportierte Dateien (Skripte, Styles, Icons, Bilder) werden
  // zusätzlich zum HTML-Seiten-Graph gegen out/ geprüft. Seitenlinks und
  // Fragmente prüft der Graph präziser und ohne Canonicals als Link zu zählen.
  for (const page of pages) {
    for (const target of internalLinkTargets(readFileSync(page, 'utf8'), SITE_ORIGIN, SITE_BASE_PATH)) {
      if (!/\.[a-z0-9]+$/i.test(target)) continue;
      if (!fileForPath(target)) {
        findings.push({
          severity: 'fehler',
          file: page,
          rule: 'verweis-ohne-ziel',
          message: `${target} wird als interne Datei referenziert, aber nicht ausgeliefert.`,
        });
      }
    }
  }

  // Auch das soziale Vorschau-Bild muss als Datei im Export vorhanden sein.
  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    const image = metaContent(html, 'property', 'og:image');
    if (!image) continue;
    try {
      const imageUrl = new URL(image);
      const pathname =
        SITE_BASE_PATH && imageUrl.pathname.startsWith(`${SITE_BASE_PATH}/`)
          ? imageUrl.pathname.slice(SITE_BASE_PATH.length)
          : imageUrl.pathname;
      if (!fileForPath(pathname)) {
        findings.push({
          severity: 'fehler',
          file: page,
          rule: 'og-bild-ziel',
          message: `${image} wird als Vorschaubild referenziert, aber nicht exportiert.`,
        });
      }
    } catch {
      // checkPage meldet bereits ungültige oder nicht absolute Open-Graph-Bilder.
    }
  }

  if (!existsSync(join(OUT, 'robots.txt'))) {
    findings.push({ severity: 'fehler', file: OUT, rule: 'robots', message: 'robots.txt fehlt.' });
  } else {
    const robots = readFileSync(join(OUT, 'robots.txt'), 'utf8');
    if (!robots.includes(`${BASE}/sitemap.xml`)) {
      findings.push({
        severity: 'fehler',
        file: join(OUT, 'robots.txt'),
        rule: 'robots-sitemap',
        message: 'robots.txt verweist nicht auf die Sitemap unter dem Basis-Pfad.',
      });
    }
  }

  if (!existsSync(join(OUT, '.nojekyll'))) {
    findings.push({
      severity: 'hinweis',
      file: OUT,
      rule: 'nojekyll',
      message: '.nojekyll fehlt im Export (der Deploy-Workflow legt es an).',
    });
  }

  const failed = findings.filter((finding) => finding.severity === 'fehler');
  const notices = findings.filter((finding) => finding.severity === 'hinweis');

  process.stdout.write(`\nPrüfgrundlage: ${BASE}\nGeprüfte Seiten: ${pages.length}\n`);
  if (notices.length > 0) {
    process.stdout.write(`\nHinweise (${notices.length}):\n`);
    for (const notice of notices) {
      process.stdout.write(`  · ${notice.file} [${notice.rule}] ${notice.message}\n`);
    }
  }
  if (failed.length > 0) {
    process.stderr.write(`\nFehler (${failed.length}):\n`);
    for (const finding of failed) {
      process.stderr.write(`  × ${finding.file} [${finding.rule}] ${finding.message}\n`);
    }
    process.stderr.write('\nExport-Prüfung ROT.\n');
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    '\nExport-Prüfung grün: Kopfdaten, strukturierte Beschreibung, Verweise und Sitemap stimmen.\n'
  );
}

main();
