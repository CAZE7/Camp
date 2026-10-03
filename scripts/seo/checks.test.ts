import { describe, expect, it } from 'vitest';

import {
  calculatorBundlesLoaded,
  checkCalculatorBundles,
  checkHeavyLibraries,
  checkInitialScriptBudget,
  checkPage,
  checkSitemap,
  checkStructuredData,
  exportFileCandidates,
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
<meta property="og:site_name" content="Werft"/>
<meta property="og:locale" content="de_DE"/>
<meta property="og:image" content="${ORIGIN}${BASE}/og/seite.png"/>
<meta property="og:image:alt" content="Vorschaubild"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:type" content="website"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="Titel"/>
<meta name="twitter:description" content="Beschreibung"/>
<meta name="twitter:image" content="${ORIGIN}${BASE}/og/seite.png"/>
<meta name="twitter:image:alt" content="Vorschaubild"/>
<link rel="icon" href="${BASE}/icon.svg"/>
</head><body><main><h1>Überschrift</h1><h2>Abschnitt</h2><p>${'x'.repeat(100)}</p><img src="a.png" alt="Beschreibung"/></main></body></html>`;

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

  it('vergleicht Titel, Beschreibung und H1 mit den erwarteten Inventardaten', () => {
    const findings = checkPage('f', SAUBERE_SEITE, {
      ...OPTIONS,
      expectedTitle: 'Anderer Titel',
      expectedDescription: 'Andere Beschreibung',
      expectedH1: 'Andere H1',
    });
    expect(findings.map((finding) => finding.rule)).toEqual(
      expect.arrayContaining(['titel-inventar', 'beschreibung-inventar', 'h1-inventar'])
    );
  });

  it('verbietet Canonical und Social-Metadata auf technischen Fehlerseiten', () => {
    const noindex = SAUBERE_SEITE.replace('index, follow', 'noindex, follow').replace(
      /<meta (?:property="og:[^"]+"|name="twitter:[^"]+")[^>]*\/>/g,
      ''
    );
    const cleanErrorPage = noindex.replace(/<link rel="canonical"[^>]*\/>/, '');
    const options = {
      ...OPTIONS,
      indexable: false,
      forbidCanonical: true,
      forbidSocialMetadata: true,
      checkSocialMetadata: false,
    };
    expect(checkPage('404', cleanErrorPage, options)).toEqual([]);

    const inherited = cleanErrorPage.replace(
      '</head>',
      `<link rel="canonical" href="${ORIGIN}${BASE}/"/><meta property="og:title" content="Home"/></head>`
    );
    expect(checkPage('404', inherited, options).map((finding) => finding.rule)).toEqual(
      expect.arrayContaining(['canonical-verboten', 'vorschaukarte-verboten'])
    );
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

  it('meldet seitenspezifische Schema-Typen, die das Inventar nicht ankündigt', () => {
    const html = graph([{ '@type': 'WebPage' }, { '@type': 'NewsArticle' }]);
    const rules = checkStructuredData('f', html, {
      origin: ORIGIN,
      basePath: BASE,
      expectedTypes: ['WebPage'],
    }).map((finding) => finding.rule);
    expect(rules).toContain('json-ld-inventar');
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
        url: `${ORIGIN}${BASE}/seite/`,
        name: 'Überschrift',
        description: 'Beschreibung der Testseite.',
        isPartOf: { '@id': `${ORIGIN}${BASE}/#website` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Startseite', item: `${ORIGIN}${BASE}/` },
          { '@type': 'ListItem', position: 2, name: 'Überschrift', item: `${ORIGIN}${BASE}/seite/` },
        ],
      },
      {
        '@type': 'WebApplication',
        name: 'Überschrift',
        description: 'Beschreibung der Testseite.',
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
    const visible = `
      <nav aria-label="Pfad"><ol>
        <li><a href="${BASE}/">Startseite</a></li>
        <li><span aria-current="page">Überschrift</span></li>
      </ol></nav>
      <main><h1>Überschrift</h1>
        <section><h2>Häufige Fragen</h2>
          <details><summary>Frage?</summary><p>Antwort.</p></details>
        </section>
      </main>`;
    const options = {
      origin: ORIGIN,
      basePath: BASE,
      expectedTypes: ['WebPage', 'BreadcrumbList', 'WebApplication', 'FAQPage'],
      expectedCanonical: `${ORIGIN}${BASE}/seite/`,
      expectedH1: 'Überschrift',
      expectedDescription: 'Beschreibung der Testseite.',
    };
    expect(checkStructuredData('f', html + visible, options)).toEqual([]);
    expect(
      checkStructuredData('f', html + visible.replace('Antwort.', 'Andere Antwort.'), options).map(
        (finding) => finding.rule
      )
    ).toContain('json-ld-faq-abgleich');
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

  it('meldet noindex- und technische Fehlerseiten in der Sitemap', () => {
    const findings = checkSitemap('f', sitemap([`${ORIGIN}${BASE}/a/`, `${ORIGIN}${BASE}/404/`]), {
      ...options,
      indexable: [],
      nonIndexable: ['/a/', '/404/'],
      exists: (path) => path === '/a/' || path === '/404/',
    });
    expect(findings.filter((finding) => finding.rule === 'sitemap-noindex')).toHaveLength(2);
  });

  it('meldet doppelte Adressen', () => {
    const findings = checkSitemap('f', sitemap([`${ORIGIN}${BASE}/a/`, `${ORIGIN}${BASE}/a/`]), {
      ...options,
      indexable: ['/a/'],
    });
    expect(findings.map((f) => f.rule)).toContain('sitemap-doppelt');
  });

  it('verlangt den eigenen Host und die kanonische Verzeichnisform', () => {
    const findings = checkSitemap('f', sitemap(['https://other.test/Camp/a']), {
      ...options,
      indexable: ['/a/'],
      origin: ORIGIN,
      exists: () => true,
    });
    expect(findings.map((finding) => finding.rule)).toEqual(
      expect.arrayContaining(['sitemap-host', 'sitemap-canonical', 'sitemap-fehlend'])
    );
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

describe('Calculator-Code-Split', () => {
  const page = '<script src="/chunks/article.js"></script><script src="/chunks/calculators.js"></script>';

  it('zählt Script- und Module-Preloads zum initialen Download', () => {
    expect(
      scriptSources(
        '<link rel="preload" as="script" href="/preload.js"/><link rel="modulepreload" href="/module.js"/>'
      )
    ).toEqual(['/preload.js', '/module.js']);
  });
  const chunks: Record<string, string> = {
    '/chunks/article.js': 'console.log("Textseite");',
    '/chunks/calculators.js': 'id="rechner-strom" id="batterie-energie" id="solar-ertrag"',
  };
  const resolve = (source: string) => chunks[source] ?? null;

  it('erkennt Rechner anhand ihrer eindeutigen Eingabekennungen', () => {
    expect(calculatorBundlesLoaded(page, resolve)).toEqual([
      'batteriekapazitaet',
      'kabelquerschnitt',
      'solaranlage',
    ]);
  });

  it('verbietet nicht gerenderte Rechner auf SEO-Seiten, erlaubt inventarisierte Rechner', () => {
    const findings = checkCalculatorBundles('out/article/index.html', page, { resolveChunk: resolve });
    expect(findings).toHaveLength(3);
    expect(findings.every((finding) => finding.rule === 'rechner-bundle')).toBe(true);
    expect(
      checkCalculatorBundles('out/calc/index.html', page, {
        resolveChunk: resolve,
        allowed: ['batteriekapazitaet', 'kabelquerschnitt', 'solaranlage'],
      })
    ).toEqual([]);
  });

  it('hält die gemessene Erstaufbaugröße innerhalb eines klaren Seitenbudgets', () => {
    expect(checkInitialScriptBudget('out/article/index.html', 700 * 1024, 700 * 1024)).toEqual([]);
    expect(checkInitialScriptBudget('out/article/index.html', 701 * 1024, 700 * 1024)[0]?.rule).toBe(
      'initial-js-budget'
    );
    expect(() => checkInitialScriptBudget('out/article/index.html', -1, 700)).toThrow(RangeError);
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

describe('exportFileCandidates', () => {
  it('verlangt für Adressen mit Schrägstrich die Verzeichnisform', () => {
    // Der Befund vom 2026-10-03: Ein flacher Export liefert `a.html` aus, die
    // Adresse `/a/` beantwortet GitHub Pages damit aber mit 404. Wäre die
    // flache Datei hier eine gültige Antwort, bliebe der Lauf grün.
    expect(exportFileCandidates('/camper-elektrik/')).toEqual(['camper-elektrik/index.html']);
    expect(exportFileCandidates('/')).toEqual(['index.html']);
  });

  it('ordnet Adressen ohne Schrägstrich der flachen Datei zu', () => {
    expect(exportFileCandidates('/camper-elektrik')).toEqual([
      'camper-elektrik.html',
      'camper-elektrik/index.html',
    ]);
  });

  it('behandelt Dateien mit Endung als Dateien, nicht als Seiten', () => {
    expect(exportFileCandidates('/icon.svg')).toEqual(['icon.svg']);
    expect(exportFileCandidates('/_next/static/chunks/abc.js')).toEqual(['_next/static/chunks/abc.js']);
  });
});
