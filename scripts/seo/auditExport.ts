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
 * Die Liste der indexierbaren Seiten steht hier ausdrücklich und nicht
 * abgeleitet: Eine Prüfung, die ihre Erwartung aus dem Prüfling zieht, prüft
 * nichts. Wer eine Seite ergänzt, trägt sie hier und in `app/sitemap.ts` ein —
 * die Prüfung meldet die Abweichung, falls eine der beiden Stellen vergessen
 * wird.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { SITE_ORIGIN, SITE_BASE_PATH } from '../../lib/site';
import {
  type Finding,
  checkPage,
  checkSitemap,
  checkStructuredData,
  internalLinkTargets,
  metaContent,
} from './checks';

/** Seiten, die in den Index gehören — Gegenstück zu `app/sitemap.ts`. */
const INDEXIERBARE_SEITEN = [
  '/',
  '/elektrik-planung/',
  '/tools/dach/',
  '/tools/heizung/',
  '/guides/ausbau-fahrplan/',
  '/guides/camper-ausbauguide/',
  '/guides/holzausbau/',
  '/impressum/',
  '/datenschutz/',
];

/** Seiten ohne eigenen Inhalt für Ergebnislisten — sie tragen `noindex`. */
const NICHT_INDEXIERBARE_SEITEN = ['/design-system/', '/ki-assistent/'];

/**
 * Technische Seiten der Auslieferung: von Next erzeugt, nirgends verlinkt und
 * nicht beworben. Für sie gilt nur eine Zusage — sie dürfen NICHT indexiert
 * werden. Prüfungen auf eigene Adresse, doppelte Titel und Erreichbarkeit
 * laufen ins Leere, weil alle drei Ausprägungen dieselbe Fehlerseite sind.
 */
const TECHNISCHE_SEITEN = ['/404/', '/_not-found/'];

const OUT = 'out';

const BASE = SITE_BASE_PATH ? `${SITE_ORIGIN}${SITE_BASE_PATH}` : SITE_ORIGIN;

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
    const path = `/${relative(OUT, page).replace(/index\.html$/, '')}`;
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

  for (const path of pages.map((page) => `/${relative(OUT, page).replace(/index\.html$/, '')}`)) {
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
