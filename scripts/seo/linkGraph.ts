import { JSDOM } from 'jsdom';

import { pageByPath } from '../../lib/seo/inventory';
import { childTopics, topicOf, TOPICS } from '../../lib/seo/topics';
import type { PageEntry, PageKind } from '../../lib/seo/types';

export const PLANNER_PATH = '/elektrik-planung/';

/** Wissensziele, auf die der zentrale Elektroplaner fachlich zurückverweisen soll. */
export const PLANNER_KNOWLEDGE_PATHS = [
  '/camper-elektrik/kabelquerschnitt/',
  '/camper-elektrik/spannungsabfall/',
  '/camper-elektrik/sicherungen/',
  '/camper-elektrik/batterie/',
] as const;

export type InternalLinkKind = 'navigation' | 'contextual' | 'breadcrumb' | 'related-content';

export type LinkGraphPage = {
  path: string;
  html: string;
  entry?: PageEntry;
};

export type LinkGraphEdge = {
  from: string;
  to: string;
  kind: InternalLinkKind;
  href: string;
  anchorText: string;
};

export type LinkGraphFinding = {
  severity: 'fehler' | 'hinweis';
  path: string;
  rule: string;
  message: string;
};

export type LinkGraphAnalysis = {
  edges: readonly LinkGraphEdge[];
  findings: readonly LinkGraphFinding[];
  orphanPages: readonly string[];
  rootUnreachable: readonly string[];
  contextualOrphans: readonly string[];
  sitemapOnly: readonly string[];
  pagesWithoutOutbound: readonly string[];
  contextualInbound: ReadonlyMap<string, readonly string[]>;
  allInbound: ReadonlyMap<string, readonly string[]>;
};

const CONTEXTUAL_KINDS = new Set<InternalLinkKind>(['contextual', 'related-content']);
const CONTEXTUAL_PAGE_KINDS = new Set<PageKind>([
  'pillar',
  'cluster',
  'rechner',
  'werkzeug',
  'ratgeber',
  'vertrauen',
]);

function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

function normalizeWhitespace(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function classifyLink(anchor: HTMLAnchorElement): InternalLinkKind {
  const nav = anchor.closest('nav');
  if (nav) {
    const label = normalizeWhitespace(nav.getAttribute('aria-label')).toLocaleLowerCase('de-DE');
    if (label === 'pfad' || label.includes('breadcrumb')) return 'breadcrumb';
    if (label.includes('weiterführ') || label.includes('themen')) return 'related-content';
    return 'navigation';
  }

  const section = anchor.closest('section');
  const sectionHeading = section?.querySelector('h2, h3');
  const heading = normalizeWhitespace(sectionHeading?.textContent).toLocaleLowerCase('de-DE');
  if (/weiter im thema|alle themen dieser übersicht|verwandte themen|weiterlesen/.test(heading)) {
    return 'related-content';
  }

  return anchor.closest('main') ? 'contextual' : 'navigation';
}

function routePath(pathname: string, basePath: string): { path: string | null; reason?: 'basepath' } {
  const base = normalizeBasePath(basePath);
  if (!base) return { path: pathname || '/' };
  if (pathname === base || pathname === `${base}/`) return { path: '/' };
  if (!pathname.startsWith(`${base}/`)) return { path: null, reason: 'basepath' };
  return { path: pathname.slice(base.length) || '/' };
}

function edgeKey(edge: LinkGraphEdge): string {
  return `${edge.from}\u0000${edge.to}\u0000${edge.kind}`;
}

function addFinding(
  findings: LinkGraphFinding[],
  path: string,
  rule: string,
  message: string,
  severity: LinkGraphFinding['severity'] = 'fehler'
): void {
  findings.push({ path, rule, message, severity });
}

function hasMeaningfulEdge(edges: readonly LinkGraphEdge[], from: string, to: string): boolean {
  return edges.some((edge) => edge.from === from && edge.to === to && CONTEXTUAL_KINDS.has(edge.kind));
}

/**
 * Analysiert echte `<a>`-Verweise im statischen HTML. Canonicals, Icons,
 * Preloads und andere `<link href>`-Ressourcen zählen damit nicht als
 * interne Einbindung einer Seite.
 */
export function analyzeInternalLinkGraph(input: {
  pages: readonly LinkGraphPage[];
  origin: string;
  basePath?: string;
  sitemapPaths: readonly string[];
  technicalPaths?: readonly string[];
}): LinkGraphAnalysis {
  const technicalPaths = new Set(input.technicalPaths ?? []);
  const basePath = normalizeBasePath(input.basePath ?? '');
  const origin = input.origin.replace(/\/+$/, '');
  const byPath = new Map(input.pages.map((page) => [page.path, page]));
  const documents = new Map(input.pages.map((page) => [page.path, new JSDOM(page.html).window.document]));
  const findings: LinkGraphFinding[] = [];
  const edges: LinkGraphEdge[] = [];
  const edgeKeys = new Set<string>();

  for (const source of input.pages) {
    const document = documents.get(source.path);
    if (!document) continue;

    for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const href = anchor.getAttribute('href')?.trim();
      if (!href || /^(?:mailto:|tel:|javascript:|data:)/i.test(href)) continue;

      let url: URL;
      try {
        url = new URL(href, `${origin}${basePath}${source.path}`);
      } catch {
        addFinding(
          findings,
          source.path,
          'interner-link-ungueltig',
          `Interner Link ist keine gültige URL: ${href}`
        );
        continue;
      }
      if (url.origin !== origin) continue;

      const resolved = routePath(url.pathname, basePath);
      if (!resolved.path) {
        if (resolved.reason === 'basepath') {
          addFinding(
            findings,
            source.path,
            'interner-link-basepath',
            `${href} liegt außerhalb des Auslieferungs-Basis-Pfads "${basePath}".`
          );
        }
        continue;
      }

      const targetPath = resolved.path;
      const targetPage = byPath.get(targetPath);
      if (!targetPage) {
        const withoutSlash = targetPath.length > 1 ? targetPath.replace(/\/+$/, '') : targetPath;
        const slashCandidate = targetPath.endsWith('/') ? withoutSlash : `${targetPath}/`;
        const candidate = byPath.get(slashCandidate);
        if (candidate) {
          addFinding(
            findings,
            source.path,
            'interner-link-redirect',
            `${href} zeigt auf eine nicht-kanonische Variante; verwende ${slashCandidate}.`
          );
          continue;
        }

        const caseCandidate = input.pages.find(
          (page) => page.path.toLocaleLowerCase('en-US') === targetPath.toLocaleLowerCase('en-US')
        );
        if (caseCandidate) {
          addFinding(
            findings,
            source.path,
            'interner-link-case',
            `${href} unterscheidet sich in Groß-/Kleinschreibung von ${caseCandidate.path}.`
          );
          continue;
        }

        // Verweise auf Dateien werden vom Export-Prüfer separat gegen out/
        // geprüft; die Linkgraph-Knoten sind ausschließlich HTML-Seiten.
        if (!/\.[a-z0-9]+$/i.test(targetPath)) {
          addFinding(
            findings,
            source.path,
            'interner-link-tot',
            `${href} hat kein ausgeliefertes Seitenziel.`
          );
        }
        continue;
      }

      const fragment = decodeURIComponent(url.hash.slice(1));
      if (fragment) {
        const targetDocument = documents.get(targetPath);
        if (targetDocument && !targetDocument.getElementById(fragment)) {
          addFinding(
            findings,
            source.path,
            'interner-anker-tot',
            `${href} verweist auf den nicht vorhandenen Abschnitt "${fragment}" auf ${targetPath}.`
          );
        }
      }

      if (source.entry?.indexability === 'index' && targetPage.entry?.indexability === 'noindex') {
        addFinding(
          findings,
          source.path,
          'interner-link-noindex',
          `${href} verlinkt von einer indexierbaren Seite auf die noindex-Ansicht ${targetPath}.`
        );
      } else if (source.entry?.indexability === 'index' && technicalPaths.has(targetPath)) {
        addFinding(
          findings,
          source.path,
          'interner-link-technisch',
          `${href} verlinkt von einer indexierbaren Seite auf die technische Fehlerroute ${targetPath}.`
        );
      }

      if (targetPath === source.path) continue;
      const edge: LinkGraphEdge = {
        from: source.path,
        to: targetPath,
        kind: classifyLink(anchor),
        href,
        anchorText: normalizeWhitespace(anchor.textContent),
      };
      const key = edgeKey(edge);
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        edges.push(edge);
      }
    }
  }

  const indexable = input.pages.filter((page) => page.entry?.indexability === 'index');
  const allInbound = new Map<string, string[]>();
  const contextualInbound = new Map<string, string[]>();
  const outbound = new Map<string, string[]>();

  for (const page of indexable) {
    allInbound.set(page.path, []);
    contextualInbound.set(page.path, []);
    outbound.set(page.path, []);
  }
  for (const edge of edges) {
    if (allInbound.has(edge.to)) {
      const inbound = allInbound.get(edge.to)!;
      if (!inbound.includes(edge.from)) inbound.push(edge.from);
      if (CONTEXTUAL_KINDS.has(edge.kind)) {
        const contextual = contextualInbound.get(edge.to)!;
        if (!contextual.includes(edge.from)) contextual.push(edge.from);
      }
    }
    if (outbound.has(edge.from)) {
      const links = outbound.get(edge.from)!;
      if (!links.includes(edge.to)) links.push(edge.to);
    }
  }

  const targetsBySource = new Map<string, Set<string>>();
  for (const edge of edges) {
    const targets = targetsBySource.get(edge.from) ?? new Set<string>();
    targets.add(edge.to);
    targetsBySource.set(edge.from, targets);
  }
  const rootReachable = new Set<string>(['/']);
  const queue = ['/'];
  while (queue.length > 0) {
    const source = queue.shift()!;
    for (const target of targetsBySource.get(source) ?? []) {
      if (rootReachable.has(target)) continue;
      rootReachable.add(target);
      queue.push(target);
    }
  }
  const rootUnreachable = indexable
    .filter((page) => page.path !== '/' && !rootReachable.has(page.path))
    .map((page) => page.path);

  const orphanPages = indexable
    .filter((page) => page.path !== '/' && (allInbound.get(page.path)?.length ?? 0) === 0)
    .map((page) => page.path);
  const sitemapPaths = new Set(input.sitemapPaths);
  const sitemapOnly = indexable
    .filter((page) => sitemapPaths.has(page.path) && (allInbound.get(page.path)?.length ?? 0) === 0)
    .map((page) => page.path);
  const contextualOrphans = indexable
    .filter((page) => {
      if (page.path === '/' || page.entry?.kind === 'rechtliches') return false;
      if (!page.entry || !CONTEXTUAL_PAGE_KINDS.has(page.entry.kind)) return false;
      return (contextualInbound.get(page.path)?.length ?? 0) === 0;
    })
    .map((page) => page.path);
  const pagesWithoutOutbound = indexable
    .filter((page) => (outbound.get(page.path)?.length ?? 0) === 0)
    .map((page) => page.path);

  for (const path of orphanPages) {
    addFinding(findings, path, 'verwaiste-seite', `${path} hat keinen eingehenden HTML-Link.`);
  }
  for (const path of rootUnreachable) {
    addFinding(
      findings,
      path,
      'nicht-von-startseite-erreichbar',
      `${path} ist von der Startseite aus über HTML-Links nicht erreichbar.`
    );
  }
  for (const path of contextualOrphans) {
    addFinding(
      findings,
      path,
      'kontextuelle-verwaiste-seite',
      `${path} ist nur über Navigation, Breadcrumb oder Sitemap erreichbar — es fehlt eine kontextuelle/inhaltliche Einbindung.`
    );
  }
  for (const path of pagesWithoutOutbound) {
    addFinding(
      findings,
      path,
      'seite-ohne-outbound',
      `${path} hat keinen ausgehenden HTML-Link zu einer anderen Seite.`
    );
  }

  // Pillar/Cluster-Verbindungen kommen aus dem Themenbaum und werden gegen die
  // tatsächlich gerenderten Links geprüft, nicht gegen eine zweite Handliste.
  for (const pillar of TOPICS.filter((topic) => topic.role === 'pillar')) {
    if (!pillar.path) continue;
    for (const child of childTopics(pillar.id)) {
      const descendants = [child, ...childTopics(child.id)];
      for (const topic of descendants) {
        if (topic.role !== 'cluster' || !topic.path || !pageByPath(topic.path)) continue;
        if (!hasMeaningfulEdge(edges, pillar.path, topic.path)) {
          addFinding(
            findings,
            pillar.path,
            'pillar-ohne-cluster-link',
            `${pillar.path} verlinkt das Cluster ${topic.path} nicht kontextuell oder als Related Content.`
          );
        }
      }
    }
  }

  // Jedes Cluster verweist kontextuell oder im Related-Block an sein direktes
  // Elternthema zurück; Breadcrumbs allein erfüllen die Rückverbindung nicht.
  for (const page of indexable) {
    if (page.entry?.kind !== 'cluster') continue;
    const topic = topicOf(page.entry.topicId);
    const parentPath = topic.parent ? topicOf(topic.parent).path : undefined;
    if (parentPath && !hasMeaningfulEdge(edges, page.path, parentPath)) {
      addFinding(
        findings,
        page.path,
        'cluster-ohne-pillar-ruecklink',
        `${page.path} hat keine kontextuelle/inhaltliche Rückverbindung zu ${parentPath}.`
      );
    }
  }

  for (const page of indexable) {
    if (page.path === PLANNER_PATH || !page.entry?.calculators?.length) continue;
    if (!hasMeaningfulEdge(edges, page.path, PLANNER_PATH)) {
      addFinding(
        findings,
        page.path,
        'rechner-ohne-planner-link',
        `${page.path} enthält einen Rechner, aber keinen kontextuellen/inhaltlichen Link zum Elektroplaner.`
      );
    }
  }

  for (const knowledgePath of PLANNER_KNOWLEDGE_PATHS) {
    if (!hasMeaningfulEdge(edges, PLANNER_PATH, knowledgePath)) {
      addFinding(
        findings,
        PLANNER_PATH,
        'planner-ohne-wissenslink',
        `${PLANNER_PATH} verlinkt die relevante Wissensseite ${knowledgePath} nicht kontextuell.`
      );
    }
  }

  for (const document of documents.values()) {
    document.defaultView?.close();
  }

  return {
    edges,
    findings,
    orphanPages,
    rootUnreachable,
    contextualOrphans,
    sitemapOnly,
    pagesWithoutOutbound,
    contextualInbound,
    allInbound,
  };
}
