import { describe, expect, it } from 'vitest';

import { pageByPath } from '../../lib/seo/inventory';
import { analyzeInternalLinkGraph, PLANNER_KNOWLEDGE_PATHS, PLANNER_PATH } from './linkGraph';

const ORIGIN = 'https://example.test';

function page(path: string, html: string, withInventory = false) {
  return { path, html, ...(withInventory ? { entry: pageByPath(path) } : {}) };
}

describe('interner Linkgraph aus dem HTML-Export', () => {
  it('zählt echte kontextuelle Anker, nicht Canonical- oder Ressourcentags', () => {
    const result = analyzeInternalLinkGraph({
      pages: [
        page(
          '/source/',
          `<head><link rel="canonical" href="${ORIGIN}/target/"/><link rel="icon" href="/icon.svg"/></head>
           <main><p>Weiterführender Kontext: <a href="/target/#abschnitt">Erklärung zum Thema</a>.</p></main>`
        ),
        page('/target/', '<main><h1 id="abschnitt">Zielseite</h1></main>'),
      ],
      origin: ORIGIN,
      sitemapPaths: ['/source/', '/target/'],
    });

    expect(result.edges).toEqual([
      expect.objectContaining({
        from: '/source/',
        to: '/target/',
        kind: 'contextual',
        anchorText: 'Erklärung zum Thema',
      }),
    ]);
    expect(result.findings.map((finding) => finding.rule)).not.toEqual(
      expect.arrayContaining(['interner-anker-tot', 'interner-link-tot'])
    );
  });

  it('erkennt tote Ziele, tote Fragmente und nicht-kanonische Varianten', () => {
    const result = analyzeInternalLinkGraph({
      pages: [
        page(
          '/source/',
          '<main><a href="/missing/">Fehlt</a><a href="/target/#fehlt">Abschnitt</a><a href="/target">Weiterleitung</a></main>'
        ),
        page('/target/', '<main><h1 id="vorhanden">Ziel</h1></main>'),
      ],
      origin: ORIGIN,
      sitemapPaths: [],
    });

    const sourceFindings = result.findings.filter((finding) => finding.path === '/source/');
    expect(sourceFindings.map((finding) => finding.rule)).toEqual(
      expect.arrayContaining(['interner-link-tot', 'interner-anker-tot', 'interner-link-redirect'])
    );
  });

  it('entfernt den GitHub-Pages-Basis-Pfad und klassifiziert Brotkrumen getrennt', () => {
    const result = analyzeInternalLinkGraph({
      pages: [
        page(
          '/source/',
          '<nav aria-label="Pfad"><ol><li><a href="/Camp/target/">Zielthema</a></li></ol></nav>'
        ),
        page('/target/', '<main><h1>Ziel</h1></main>'),
      ],
      origin: ORIGIN,
      basePath: '/Camp',
      sitemapPaths: [],
    });

    expect(result.edges).toEqual([
      expect.objectContaining({ from: '/source/', to: '/target/', kind: 'breadcrumb' }),
    ]);
    expect(result.findings.map((finding) => finding.rule)).not.toContain('interner-link-basepath');
  });

  it('meldet indexierbare Seiten ohne HTML-Eingang auch als Sitemap-only', () => {
    const result = analyzeInternalLinkGraph({
      pages: [page('/camper-elektrik/', '<main><h1>Pillar</h1></main>', true)],
      origin: ORIGIN,
      sitemapPaths: ['/camper-elektrik/'],
    });

    expect(result.orphanPages).toContain('/camper-elektrik/');
    expect(result.rootUnreachable).toContain('/camper-elektrik/');
    expect(result.sitemapOnly).toContain('/camper-elektrik/');
    expect(result.contextualOrphans).toContain('/camper-elektrik/');
  });

  it('erkennt einen verlinkten Seitencluster, der nur in einem unerreichbaren Inselgraphen hängt', () => {
    const result = analyzeInternalLinkGraph({
      pages: [
        page('/', '<main><h1>Start ohne Cluster-Link</h1></main>'),
        page('/insel/', '<main><a href="/camper-elektrik/230v/">230-V-Anlage</a></main>'),
        page('/camper-elektrik/230v/', '<main><h1>230-V-Anlage</h1></main>', true),
      ],
      origin: ORIGIN,
      sitemapPaths: ['/camper-elektrik/230v/'],
    });

    expect(result.orphanPages).not.toContain('/camper-elektrik/230v/');
    expect(result.rootUnreachable).toContain('/camper-elektrik/230v/');
    expect(
      result.findings.find(
        (finding) =>
          finding.path === '/camper-elektrik/230v/' && finding.rule === 'nicht-von-startseite-erreichbar'
      )
    ).toBeDefined();
  });

  it('sichert die Rückverbindung Rechner ↔ Planner und Planner → Grundlagen ab', () => {
    const plannerKnowledgeLinks = PLANNER_KNOWLEDGE_PATHS.map(
      (path) => `<a href="${path}">${path.split('/').filter(Boolean).at(-1)}</a>`
    ).join(' ');
    const planner = page(
      PLANNER_PATH,
      `<main><section><h2>Auslegung und Grundlagen vertiefen</h2>${plannerKnowledgeLinks}</section></main>`,
      true
    );
    const calculatorPage = page(
      '/camper-elektrik/kabelquerschnitt/',
      `<main><p><a href="${PLANNER_PATH}">Gesamtanlage im Planer zeichnen</a></p></main>`,
      true
    );
    const targets = PLANNER_KNOWLEDGE_PATHS.filter((path) => path !== calculatorPage.path).map((path) =>
      page(path, '<main><h1>Grundlage</h1></main>', true)
    );
    const result = analyzeInternalLinkGraph({
      pages: [planner, calculatorPage, ...targets],
      origin: ORIGIN,
      sitemapPaths: [PLANNER_PATH, '/camper-elektrik/kabelquerschnitt/', ...PLANNER_KNOWLEDGE_PATHS],
    });

    expect(calculatorPage.entry?.calculators?.length).toBeGreaterThan(0);
    expect(
      result.findings.filter(
        (finding) =>
          (finding.rule === 'rechner-ohne-planner-link' && finding.path === calculatorPage.path) ||
          (finding.rule === 'planner-ohne-wissenslink' && finding.path === PLANNER_PATH)
      )
    ).toEqual([]);
  });
});
