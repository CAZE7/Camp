import { describe, expect, it } from 'vitest';

import {
  checkHeavyLibraries,
  checkPage,
  checkSitemap,
  checkStructuredData,
  heavyLibrariesLoaded,
  internalLinkTargets,
  metaContent,
  scriptSources,
  titleOf,
  unescapeHtml,
} from './checks';

/**
 * Die Prüfregeln entscheiden über „grün“ oder „rot“ des Exports. Ein Fehler in
 * einer Regel wäre schlimmer als keine Regel: Er würde eine Abweichung
 * durchwinken oder eine saubere Seite melden. Deshalb wird jede Regel hier mit
 * einem erfundenen Verstoß und einem sauberen Gegenstück geprüft.
 */

const ORIGIN = 'https://example.test';
const BASE = '/Camp';

const SAUBERE_SEITE = `<!doctype html><html lang="de"><head>
<title>Eine saubere Seite mit ausreichender Laenge</title>
<meta name="description" content="${'x'.repeat(80)}"/>
<link rel="canonical" href="${ORIGIN}${BASE}/seite/"/>
<meta name="robots" content="index, follow"/>
<meta property="og:title" content="Titel"/>
<meta property="og:description" content="Beschreibung"/>
<meta property="og:url" content="${ORIGIN}${BASE}/seite/"/>
<meta property="og:image" content="${ORIGIN}${BASE}/og/seite.png"/>
<meta property="og:type" content="website"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="icon" href="${BASE}/icon.svg"/>
</head><body><main><h1>Überschrift</h1><h2>Abschnitt</h2><img src="a.png" alt="Beschreibung"/></main></body></html>`;

const OPTIONS = { canonical: `${ORIGIN}${BASE}/seite/`, basePath: BASE, indexable: true };

describe('checkPage', () => {
  it('meldet eine saubere Seite nicht', () => {
    expect(checkPage('out/seite/index.html', SAUBERE_SEITE, OPTIONS)).toEqual([]);
  });

  it('erkennt einen fehlenden Canonical', () => {
    const html = SAUBERE_SEITE.replace(/<link rel="canonical"[^>]*\/>/, '');
    expect(checkPage('f', html, OPTIONS).map((f) => f.rule)).toContain('canonical');
  });

  it('erkennt einen Canonical auf die falsche Adresse', () => {
    const html = SAUBERE_SEITE.replace(`${BASE}/seite/`, `${BASE}/andere/`);
    expect(checkPage('f', html, OPTIONS).map((f) => f.rule)).toContain('canonical-ziel');
  });

  it('erkennt fehlende oder mehrere Hauptüberschriften', () => {
    expect(
      checkPage('f', SAUBERE_SEITE.replace('<h1>Überschrift</h1>', ''), OPTIONS).map((f) => f.rule)
    ).toContain('h1');
    expect(
      checkPage('f', SAUBERE_SEITE.replace('<h2>', '<h1>zwei</h1><h2>'), OPTIONS).map((f) => f.rule)
    ).toContain('h1');
  });

  it('erkennt fehlende Vorschaukarten und ein fehlendes Icon', () => {
    const html = SAUBERE_SEITE.replace(/<meta property="og:image"[^>]*\/>/, '').replace(
      /<link rel="icon"[^>]*\/>/,
      ''
    );
    const rules = checkPage('f', html, OPTIONS).map((f) => f.rule);
    expect(rules).toContain('vorschaukarte');
    expect(rules).toContain('icon');
  });

  it('erkennt ein Vorschaubild außerhalb des Basis-Pfads', () => {
    const html = SAUBERE_SEITE.replace(`${BASE}/og/seite.png`, '/og/seite.png');
    expect(checkPage('f', html, OPTIONS).map((f) => f.rule)).toContain('og-bild-pfad');
  });

  it('erkennt ein Bild ohne Alternativtext', () => {
    const html = SAUBERE_SEITE.replace(' alt="Beschreibung"', '');
    expect(checkPage('f', html, OPTIONS).map((f) => f.rule)).toContain('bild-alternativtext');
  });

  it('verlangt noindex, wenn die Seite nicht indexiert werden soll', () => {
    const findings = checkPage('f', SAUBERE_SEITE, { ...OPTIONS, indexable: false });
    expect(findings.map((f) => f.rule)).toContain('crawler');
  });

  it('meldet einen zu langen Titel nur als Hinweis', () => {
    const html = SAUBERE_SEITE.replace('Eine saubere Seite mit ausreichender Laenge', 'x'.repeat(90));
    const findings = checkPage('f', html, OPTIONS);
    expect(findings.map((f) => f.rule)).toContain('titel-laenge');
    expect(findings.every((f) => f.rule !== 'titel-laenge' || f.severity === 'hinweis')).toBe(true);
  });
});

describe('checkStructuredData', () => {
  const graph = (nodes: unknown[], extra = '') =>
    `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': nodes,
    })}</script>${extra}`;

  it('meldet eine Seite ohne strukturierte Beschreibung', () => {
    expect(checkStructuredData('f', '<html></html>', { origin: ORIGIN, basePath: BASE })[0]?.rule).toBe(
      'strukturierte-daten'
    );
  });

  it('meldet ungültiges JSON', () => {
    const html = '<script type="application/ld+json">{kaputt}</script>';
    expect(checkStructuredData('f', html, { origin: ORIGIN, basePath: BASE })[0]?.rule).toBe('json-ld');
  });

  it('verlangt Pflichtfelder der Anwendung', () => {
    const html = graph([{ '@type': 'WebApplication', url: `${ORIGIN}${BASE}/` }]);
    const rules = checkStructuredData('f', html, { origin: ORIGIN, basePath: BASE }).map((f) => f.rule);
    expect(rules).toContain('json-ld-pflichtfeld');
  });

  it('verlangt Text und Antwort je Frage', () => {
    const html = graph([{ '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Frage?' }] }]);
    expect(checkStructuredData('f', html, { origin: ORIGIN, basePath: BASE }).map((f) => f.rule)).toContain(
      'json-ld-faq'
    );
  });

  it('erkennt fremde Adressen in der Beschreibung', () => {
    const html = graph([
      { '@type': 'WebSite', url: 'https://fremde-domain.test/', name: 'X', inLanguage: 'de-DE' },
    ]);
    expect(checkStructuredData('f', html, { origin: ORIGIN, basePath: BASE }).map((f) => f.rule)).toContain(
      'json-ld-adresse'
    );
  });

  it('lässt eine vollständige Beschreibung durch', () => {
    const html = graph([
      { '@type': 'WebSite', '@id': `${ORIGIN}${BASE}/#website`, url: `${ORIGIN}${BASE}/` },
      {
        '@type': 'WebPage',
        '@id': `${ORIGIN}${BASE}/seite/#webpage`,
        isPartOf: { '@id': `${ORIGIN}${BASE}/#website` },
      },
      {
        '@type': 'WebApplication',
        name: 'Rechner',
        url: `${ORIGIN}${BASE}/seite/`,
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'All',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Frage?',
            acceptedAnswer: { '@type': 'Answer', text: 'Antwort.' },
          },
        ],
      },
    ]);
    expect(checkStructuredData('f', html, { origin: ORIGIN, basePath: BASE })).toEqual([]);
  });
});

describe('checkSitemap', () => {
  const sitemap = (locs: string[]) =>
    `<urlset>${locs.map((loc) => `<url><loc>${loc}</loc></url>`).join('')}</urlset>`;

  const exists = (path: string) => ['/', '/a/', '/b/'].includes(path);
  const options = { indexable: ['/', '/a/', '/b/'], nonIndexable: [] as string[], basePath: BASE, exists };

  it('meldet eine fehlende indexierbare Seite', () => {
    const findings = checkSitemap('f', sitemap([`${ORIGIN}${BASE}/`]), {
      ...options,
      indexable: ['/', '/a/'],
    });
    expect(findings.map((f) => f.rule)).toContain('sitemap-fehlend');
  });

  it('meldet eine Adresse ohne Datei', () => {
    const findings = checkSitemap('f', sitemap([`${ORIGIN}${BASE}/fehlt/`]), { ...options, indexable: [] });
    expect(findings.map((f) => f.rule)).toContain('sitemap-ziel');
  });

  it('meldet eine noindex-Seite in der Sitemap', () => {
    const findings = checkSitemap('f', sitemap([`${ORIGIN}${BASE}/a/`]), {
      ...options,
      indexable: [],
      nonIndexable: ['/a/'],
    });
    expect(findings.map((f) => f.rule)).toContain('sitemap-noindex');
  });

  it('meldet doppelte Adressen', () => {
    const findings = checkSitemap('f', sitemap([`${ORIGIN}${BASE}/a/`, `${ORIGIN}${BASE}/a/`]), {
      ...options,
      indexable: ['/a/'],
    });
    expect(findings.map((f) => f.rule)).toContain('sitemap-doppelt');
  });

  it('lässt eine vollständige Sitemap durch', () => {
    const locs = ['/', '/a/', '/b/'].map((path) => `${ORIGIN}${BASE}${path}`);
    expect(checkSitemap('f', sitemap(locs), options)).toEqual([]);
  });
});

describe('checkHeavyLibraries', () => {
  const SEITE = `<html><head><script src="/_next/static/chunks/app.js"></script><script src="/_next/static/chunks/gsap.js"></script></head><body><h1>x</h1></body></html>`;
  const CHUNKS: Record<string, string> = {
    '/_next/static/chunks/app.js': 'console.log("app");',
    '/_next/static/chunks/gsap.js': 'var gsap=function(){},GreenSock=1;',
    '/_next/static/chunks/elk.js': 'require("elkjs");org.eclipse.elk={};',
  };
  const resolve = (source: string) => CHUNKS[source] ?? null;

  it('sammelt die Quelladressen der Skripte', () => {
    expect(scriptSources(SEITE)).toEqual(['/_next/static/chunks/app.js', '/_next/static/chunks/gsap.js']);
  });

  it('erkennt die geladenen großen Abhängigkeiten', () => {
    expect(heavyLibrariesLoaded(SEITE, resolve)).toEqual(['gsap']);
    expect(heavyLibrariesLoaded('<script src="/_next/static/chunks/elk.js"></script>', resolve)).toEqual([
      'elkjs',
    ]);
  });

  it('meldet eine schwere Abhängigkeit auf einer Inhaltsseite als Fehler', () => {
    const findings = checkHeavyLibraries('out/seite/index.html', SEITE, { resolveChunk: resolve });
    expect(findings).toHaveLength(1);
    expect(findings[0]!.rule).toBe('bundle-schwer');
    expect(findings[0]!.message).toContain('gsap');
  });

  it('lässt eine erlaubte Abhängigkeit auf einer Werkzeugseite durch', () => {
    expect(
      checkHeavyLibraries('out/tools/dach/index.html', SEITE, {
        resolveChunk: resolve,
        allowed: ['gsap'],
      })
    ).toEqual([]);
  });

  it('meldet eine saubere Seite nicht', () => {
    expect(
      checkHeavyLibraries('out/seite/index.html', '<script src="/_next/static/chunks/app.js"></script>', {
        resolveChunk: resolve,
      })
    ).toEqual([]);
  });

  it('verträgt ein Bündel, das nicht im Export liegt', () => {
    expect(heavyLibrariesLoaded('<script src="/fehlt.js"></script>', resolve)).toEqual([]);
  });
});

describe('Hilfsfunktionen', () => {
  it('liest Titel und Beschreibung unabhängig von der Attributreihenfolge', () => {
    expect(titleOf('<title>Hallo &amp; Welt</title>')).toBe('Hallo & Welt');
    expect(metaContent('<meta content="Wert" name="description">', 'name', 'description')).toBe('Wert');
    expect(metaContent('<meta name="description" content="Wert">', 'name', 'description')).toBe('Wert');
  });

  it('macht aus HTML-Maskierung echte Zeichen', () => {
    expect(unescapeHtml('a &amp; b &lt;c&gt;')).toBe('a & b <c>');
  });

  it('sammelt interne Ziele ohne Anker, Fremdadressen und Dateien', () => {
    const html = `
      <a href="#anker">Anker</a>
      <a href="/tools/dach/">relativ</a>
      <a href="${ORIGIN}${BASE}/elektrik-planung/#rechner">absolut mit Anker</a>
      <a href="https://fremde-domain.test/x">fremd</a>
      <a href="mailto:post@example.test">Mail</a>
      <a href="/sitemap.xml">Sitemap</a>`;
    expect(internalLinkTargets(html, `${ORIGIN}${BASE}`)).toEqual(['/elektrik-planung/', '/tools/dach/']);
  });

  it('zieht den Basis-Pfad ab, damit die Ziele gegen out/ prüfbar sind', () => {
    const html = `
      <a href="/Camp/tools/dach/">Basis-Pfad relativ</a>
      <a href="${ORIGIN}/Camp/impressum/">Basis-Pfad absolut</a>
      <a href="/Camp/">Startseite</a>
      <link rel="icon" href="/Camp/icon.svg"/>`;
    expect(internalLinkTargets(html, ORIGIN, BASE)).toEqual([
      '/',
      '/icon.svg',
      '/impressum/',
      '/tools/dach/',
    ]);
  });

  it('lässt einen Verweis ohne Basis-Pfad unverändert', () => {
    expect(internalLinkTargets('<a href="/a/">x</a>', ORIGIN, '')).toEqual(['/a/']);
  });
});
