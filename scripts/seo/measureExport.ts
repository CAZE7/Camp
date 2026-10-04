/**
 * scripts/seo/measureExport.ts
 *
 * Vermisst den gebauten Export (`out/`) — Wortzahl, Überschriften, Verweise,
 * Verschachtelungstiefe und die im Erstaufbau geladenen Bündel. Der Audit
 * (`auditExport.ts`) beantwortet „ist es richtig?"; dieses Werkzeug
 * beantwortet „wie groß, wie tief, wie gut verlinkt?".
 *
 * Die Messung läuft ohne Browser auf dem ausgelieferten HTML. Damit misst sie
 * genau das, was ein Suchmaschinen-Crawler ohne JavaScript sieht — die
 * belastbarste Grundlage für Thin-Content-, Waisen- und Bundle-Aussagen.
 *
 *   npm run build && npx tsx scripts/seo/measureExport.ts
 *
 * Die Zahlen sind die Grundlage des Berichts (`scripts/seo/report.ts`) und
 * werden hier berechnet, damit sie nicht von Hand gepflegt werden müssen.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { pageByPath, PAGES } from '../../lib/seo/inventory';
import { THIN_CONTENT_KINDS, type PageKind } from '../../lib/seo/types';
import { heavyLibrariesLoaded, metaContent, scriptSources, titleOf } from './checks';
import { analyzeInternalLinkGraph } from './linkGraph';

export const OUT = 'out';

/** Wortzahl, unter der eine Inhaltsseite im Bericht als dünn gilt. */
export const THIN_WORDS = 300;

export type PageMeasurement = {
  path: string;
  kind: PageKind | 'technisch';
  priority: string;
  indexable: boolean;
  title: string;
  titleLength: number;
  descriptionLength: number;
  h1Count: number;
  h2Count: number;
  words: number;
  inbound: number;
  outbound: number;
  depth: number | null;
  scriptCount: number;
  scriptBytes: number;
  heavy: readonly string[];
};

export type ExportMeasurement = {
  pages: readonly PageMeasurement[];
  sitemapEntries: number;
  robotsPresent: boolean;
  summary: {
    totalPages: number;
    indexable: number;
    pillar: number;
    calculator: number;
    orphans: readonly string[];
    rootUnreachable: readonly string[];
    thin: readonly PageMeasurement[];
    duplicateTitles: readonly string[];
    duplicateDescriptions: readonly string[];
    inboundCoverage: number;
    averageInbound: number;
    maxDepth: number;
    heavyOnContentPages: readonly { path: string; heavy: readonly string[] }[];
    noJsPagesWithContent: number;
  };
};

/** Alle Seiten des Exports (`out/**\/index.html`). */
export function exportPages(dir = OUT): string[] {
  const pages: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === 'index.html') pages.push(full);
    }
  };
  walk(dir);
  return pages.sort();
}

/** Pfadschreibweise einer Exportdatei (`out/a/index.html` → `/a/`). */
export function pagePathOf(file: string, dir = OUT): string {
  return `/${relative(dir, file)
    .replace(/index\.html$/, '')
    .split(sep)
    .join('/')}`;
}

/** Sichtbarer Text ohne Skripte, Stile und Auszeichnung. */
export function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Wortzahl der sichtbaren Seite — ohne JavaScript, wie ein Crawler sie sieht. */
export function wordCount(html: string): number {
  const text = visibleText(html);
  return text === '' ? 0 : text.split(' ').length;
}

function headingCount(html: string, level: number): number {
  return (html.match(new RegExp(`<h${level}[\\s>]`, 'gi')) ?? []).length;
}

function resolveChunk(dir: string, basePath: string, source: string): string | null {
  const withoutOrigin = source.replace(/^https?:\/\/[^/]+/, '');
  let relativePath = withoutOrigin.split('?')[0]!.replace(/^\//, '');
  const base = basePath.replace(/^\/|\/$/g, '');
  if (base && relativePath.startsWith(`${base}/`)) relativePath = relativePath.slice(base.length + 1);
  const file = join(dir, relativePath);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

/**
 * Vermisst den Export. `basePath` ist der Basis-Pfad der Auslieferung
 * (`/Camp` bei GitHub Pages), `origin` die Herkunft für die Verweisprüfung.
 */
export function measureExport(
  options: {
    dir?: string;
    basePath?: string;
    origin?: string;
  } = {}
): ExportMeasurement {
  const dir = options.dir ?? OUT;
  const basePath = options.basePath ?? '';
  const origin = options.origin ?? 'https://example.invalid';

  const files = exportPages(dir);
  const raw = files.map((file) => ({ file, path: pagePathOf(file, dir), html: readFileSync(file, 'utf8') }));

  const titles = new Map<string, string[]>();
  const descriptions = new Map<string, string[]>();

  const measurements: PageMeasurement[] = raw.map(({ file, path, html }) => {
    const entry = pageByPath(path);
    const title = titleOf(html) ?? '';
    const description = metaContent(html, 'name', 'description') ?? '';
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    // Technische Seiten (dieselbe Fehlerseite dreimal) tragen zwangsläufig
    // denselben Titel — sie zählen nicht als Dublette.
    if (entry) {
      titles.set(normalizedTitle, [...(titles.get(normalizedTitle) ?? []), path]);
      descriptions.set(normalizedDescription, [...(descriptions.get(normalizedDescription) ?? []), path]);
    }

    const sources = [...new Set(scriptSources(html))];
    const bytes = sources.reduce((sum, source) => {
      const code = resolveChunk(dir, basePath, source);
      return code === null ? sum : sum + Buffer.byteLength(code, 'utf8');
    }, 0);

    return {
      path,
      kind: entry?.kind ?? 'technisch',
      priority: entry?.priority ?? '—',
      indexable: entry?.indexability === 'index',
      title,
      titleLength: normalizedTitle.length,
      descriptionLength: normalizedDescription.length,
      h1Count: headingCount(html, 1),
      h2Count: headingCount(html, 2),
      words: wordCount(html),
      inbound: 0,
      outbound: 0,
      depth: null,
      scriptCount: sources.length,
      scriptBytes: bytes,
      heavy:
        entry?.indexability === 'index'
          ? heavyLibrariesLoaded(html, (source) => resolveChunk(dir, basePath, source))
          : [],
      file,
    };
  });

  const byPath = new Map(measurements.map((page) => [page.path, page]));
  const sitemapXml = existsSync(join(dir, 'sitemap.xml'))
    ? readFileSync(join(dir, 'sitemap.xml'), 'utf8')
    : '';
  const sitemapPaths = [...sitemapXml.matchAll(/<loc>([^<]*)<\/loc>/g)].flatMap((match) => {
    try {
      const pathname = new URL(match[1]!).pathname || '/';
      if (!basePath) return [pathname];
      if (pathname === basePath || pathname === `${basePath}/`) return ['/'];
      return pathname.startsWith(`${basePath}/`) ? [pathname.slice(basePath.length) || '/'] : [pathname];
    } catch {
      return [];
    }
  });
  const graph = analyzeInternalLinkGraph({
    pages: raw.map(({ path, html }) => ({ path, html, entry: pageByPath(path) })),
    origin,
    basePath,
    sitemapPaths,
  });
  const inboundSources = new Map<string, Set<string>>();
  const outboundTargets = new Map<string, Set<string>>();
  const targetsBySource = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    const incoming = inboundSources.get(edge.to) ?? new Set<string>();
    incoming.add(edge.from);
    inboundSources.set(edge.to, incoming);

    const outgoing = outboundTargets.get(edge.from) ?? new Set<string>();
    outgoing.add(edge.to);
    outboundTargets.set(edge.from, outgoing);

    const targets = targetsBySource.get(edge.from) ?? new Set<string>();
    targets.add(edge.to);
    targetsBySource.set(edge.from, targets);
  }
  for (const page of measurements) {
    page.inbound = inboundSources.get(page.path)?.size ?? 0;
    page.outbound = outboundTargets.get(page.path)?.size ?? 0;
  }

  // Tiefe ab der Startseite: nur echte HTML-Anker zählen, keine Canonicals,
  // Icons oder Social-Metadata.
  const queue: { path: string; depth: number }[] = [{ path: '/', depth: 0 }];
  const seen = new Set(['/']);
  while (queue.length > 0) {
    const { path, depth } = queue.shift()!;
    const page = byPath.get(path);
    if (page) page.depth = depth;
    for (const target of targetsBySource.get(path) ?? []) {
      if (seen.has(target)) continue;
      seen.add(target);
      queue.push({ path: target, depth: depth + 1 });
    }
  }

  const indexable = measurements.filter((page) => page.indexable);
  const thin = indexable.filter(
    (page) => THIN_CONTENT_KINDS.includes(page.kind as PageKind) && page.words < THIN_WORDS
  );
  const orphans = [...graph.orphanPages];
  const heavyOnContentPages = indexable
    .filter((page) => page.heavy.length > 0 && page.kind !== 'werkzeug')
    .map((page) => ({ path: page.path, heavy: page.heavy }));

  return {
    pages: measurements,
    sitemapEntries: existsSync(join(dir, 'sitemap.xml'))
      ? (readFileSync(join(dir, 'sitemap.xml'), 'utf8').match(/<loc>/g) ?? []).length
      : 0,
    robotsPresent: existsSync(join(dir, 'robots.txt')),
    summary: {
      totalPages: measurements.length,
      indexable: indexable.length,
      pillar: indexable.filter((page) => page.kind === 'pillar').length,
      calculator: indexable.filter((page) => page.kind === 'rechner').length,
      orphans,
      rootUnreachable: [...graph.rootUnreachable],
      thin,
      duplicateTitles: [...titles.entries()]
        .filter(([, paths]) => paths.length > 1)
        .flatMap(([title, paths]) => paths.map((path) => `${path} — ${title}`)),
      duplicateDescriptions: [...descriptions.entries()]
        .filter(([, paths]) => paths.length > 1)
        .flatMap(([, paths]) => paths),
      inboundCoverage:
        indexable.length === 0
          ? 0
          : indexable.filter((page) => page.path === '/' || page.inbound > 0).length / indexable.length,
      averageInbound:
        indexable.length === 0
          ? 0
          : indexable.reduce((sum, page) => sum + page.inbound, 0) / indexable.length,
      maxDepth: measurements.reduce((max, page) => Math.max(max, page.depth ?? 0), 0),
      heavyOnContentPages,
      noJsPagesWithContent: indexable.filter((page) => page.words > 0 && page.h1Count === 1).length,
    },
  };
}

/** Markdown-Tabelle der Seitenmessung — für Bericht und schnelle Sicht. */
export function measurementTable(measurement: ExportMeasurement): string {
  const head =
    '| Seite | Art | Wörter | H1/H2 | ein/aus | Tiefe | JS (KB) | schwer |\n|---|---|---:|---|---:|---:|---:|---|';
  const rows = measurement.pages
    .filter((page) => page.kind !== 'technisch')
    .map(
      (page) =>
        `| \`${page.path}\` | ${page.kind} | ${page.words} | ${page.h1Count}/${page.h2Count} | ${page.inbound}/${page.outbound} | ${page.depth ?? '—'} | ${Math.round(page.scriptBytes / 1024)} | ${page.heavy.join(', ') || '—'} |`
    );
  return [head, ...rows].join('\n');
}

function main(): void {
  // Wer die Ausgabe durch `head` leitet, schließt die Pipe — das ist kein Fehler.
  process.stdout.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code !== 'EPIPE') throw error;
  });

  const measurement = measureExport({
    basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
    origin: 'https://caze7.github.io',
  });
  process.stdout.write(`\nGemessene Seiten: ${measurement.summary.totalPages}\n`);
  process.stdout.write(`Indexierbar: ${measurement.summary.indexable}\n`);
  process.stdout.write(
    `No-JS-HTML mit sichtbarem Text und genau einer H1: ${measurement.summary.noJsPagesWithContent}/${measurement.summary.indexable}\n`
  );
  process.stdout.write(
    `Pillar: ${measurement.summary.pillar} · Rechner: ${measurement.summary.calculator}\n`
  );
  process.stdout.write(`Waisen (ohne Eingang): ${measurement.summary.orphans.length}\n`);
  process.stdout.write(`Von Startseite unerreichbar: ${measurement.summary.rootUnreachable.length}\n`);
  process.stdout.write(`Dünne Seiten (< ${THIN_WORDS} Wörter): ${measurement.summary.thin.length}\n`);
  process.stdout.write(
    `Interne Verlinkung: ${(measurement.summary.inboundCoverage * 100).toFixed(0)} % der Seiten mit eingehendem Verweis, ø ${measurement.summary.averageInbound.toFixed(1)} eingehende Verweise\n`
  );
  process.stdout.write(
    `Schwere Bündel auf Inhaltsseiten: ${measurement.summary.heavyOnContentPages.length}\n`
  );
  process.stdout.write(`\n${measurementTable(measurement)}\n`);
}

// Nur ausführen, wenn direkt gestartet (nicht beim Import durch den Bericht).
if (process.argv[1]?.includes('measureExport')) main();

export { PAGES };
