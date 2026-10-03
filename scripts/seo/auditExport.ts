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

import { SITE_ORIGIN, SITE_BASE_PATH } from '../../lib/site';
import { indexablePages, nonIndexablePages, pageByPath, TECHNICAL_PAGES } from '../../lib/seo/inventory';
import {
  type Finding,
  type HeavyLibrary,
  checkHeavyLibraries,
  checkPage,
  checkSitemap,
  checkStructuredData,
  internalLinkTargets,
  metaContent,
} from './checks';

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

/** Wortzahl, unter der eine Inhaltsseite als dünn gilt (Hinweis, kein Fehler). */
const WOERTER_MINDESTBESTAND = 300;

/** Seitenarten, für die der Mindestbestand gilt — Rechtliches und Ansichten ausgenommen. */
const ARTEN_MIT_MINDESTBESTAND = ['pillar', 'cluster', 'rechner', 'ratgeber', 'werkzeug'];

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

/** Datei, die eine Seitenadresse bedient (`/a/` → `out/a/index.html`). */
function fileForPath(path: string): string | null {
  const relativePath = path.replace(/^\/+/, '').replace(/\/$/, '');
  const candidates = [
    join(OUT, relativePath, 'index.html'),
    join(OUT, `${relativePath}.html`),
    join(OUT, relativePath),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
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
  const nonIndexablePaths = new Set(NICHT_INDEXIERBARE_SEITEN);

  const titles = new Map<string, string>();
  const descriptions = new Map<string, string>();
  const reachable = new Set<string>(['/']);

  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    const path = pagePathOf(page);
    const indexable = indexablePaths.has(path);
    const technisch = TECHNISCHE_SEITEN.includes(path);

    findings.push(
      ...checkPage(page, html, {
        canonical: `${BASE}${path}`,
        basePath: SITE_BASE_PATH,
        indexable,
        checkCanonical: !technisch,
      })
    );
    findings.push(...checkStructuredData(page, html, { origin: SITE_ORIGIN, basePath: SITE_BASE_PATH }));
    findings.push(
      ...checkHeavyLibraries(page, html, {
        resolveChunk: (source) => {
          const relative = source.split('?')[0]!.replace(/^\//, '');
          const withoutBase =
            SITE_BASE_PATH && relative.startsWith(SITE_BASE_PATH.replace(/^\//, ''))
              ? relative.slice(SITE_BASE_PATH.replace(/^\//, '').length + 1)
              : relative;
          const file = join(OUT, withoutBase);
          return existsSync(file) ? readFileSync(file, 'utf8') : null;
        },
        allowed: ERLAUBTE_BIBLIOTHEKEN[path] ?? [],
      })
    );

    // Dünne Seiten: Ein Hinweis, kein Fehler — die Entscheidung, ob eine kurze
    // Seite ihren Zweck erfüllt, ist eine redaktionelle, keine technische.
    const entry = pageByPath(path);
    if (entry && ARTEN_MIT_MINDESTBESTAND.includes(entry.kind) && entry.indexability === 'index') {
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

    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
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

  // Erreichbarkeit: Breitensuche über interne Verweise ab der Startseite.
  const queue = ['/'];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const file = fileForPath(current);
    if (!file) continue;
    for (const target of internalLinkTargets(readFileSync(file, 'utf8'), SITE_ORIGIN, SITE_BASE_PATH)) {
      if (reachable.has(target)) continue;
      reachable.add(target);
      queue.push(target);
    }
  }

  for (const path of pages.map(pagePathOf)) {
    if (!reachable.has(path) && !nonIndexablePaths.has(path) && !TECHNISCHE_SEITEN.includes(path)) {
      const file = fileForPath(path)!;
      findings.push({
        severity: 'fehler',
        file,
        rule: 'verwaiste-seite',
        message: `${path} ist über keinen internen Verweis erreichbar.`,
      });
    }
  }

  // Verweise auf Ziele, die der Export nicht ausliefert.
  for (const page of pages) {
    for (const target of internalLinkTargets(readFileSync(page, 'utf8'), SITE_ORIGIN, SITE_BASE_PATH)) {
      if (!fileForPath(target)) {
        findings.push({
          severity: 'fehler',
          file: page,
          rule: 'verweis-ohne-ziel',
          message: `${target} wird verlinkt, aber nicht ausgeliefert.`,
        });
      }
    }
  }

  if (existsSync(join(OUT, 'sitemap.xml'))) {
    findings.push(
      ...checkSitemap(join(OUT, 'sitemap.xml'), readFileSync(join(OUT, 'sitemap.xml'), 'utf8'), {
        indexable: INDEXIERBARE_SEITEN,
        nonIndexable: NICHT_INDEXIERBARE_SEITEN,
        basePath: SITE_BASE_PATH,
        exists: (path) => fileForPath(path) !== null,
      })
    );
  } else {
    findings.push({ severity: 'fehler', file: OUT, rule: 'sitemap', message: 'sitemap.xml fehlt.' });
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
