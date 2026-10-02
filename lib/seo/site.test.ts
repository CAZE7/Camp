import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FAQS,
  ROUTES,
  breadcrumbTrail,
  disallowedPaths,
  jsonLdGraph,
  pageMetadata,
  sitemapUrls,
  type SeoPath,
} from './pages';
import { BASE_PATH, HOME_TITLE, OG_IMAGE, SITE_NAME, SITE_ORIGIN, absoluteUrl } from './site';

/**
 * Das SEO-Gate. Geprüft werden die Eigenschaften, die ein Crawler oder ein
 * Audit messbar liest — Eindeutigkeit, Länge, kanonische Form,
 * Indexierungs-Aussage — und die Regel, dass Structured Data nichts behaupten
 * darf, was die Seite nicht hergibt.
 */

const PATHS = Object.keys(ROUTES) as SeoPath[];
const INDEXABLE = PATHS.filter((p) => ROUTES[p].indexable);
const BRAND_SUFFIX = ` | ${SITE_NAME}`;

const CRAWLER_DIRECTIVES = {
  index: true,
  follow: true,
  'max-snippet': -1,
  'max-image-preview': 'large',
  'max-video-preview': -1,
};

function graph(path: SeoPath): Record<string, unknown> {
  return jsonLdGraph(path);
}

function nodes(path: SeoPath): Record<string, unknown>[] {
  return graph(path)['@graph'] as Record<string, unknown>[];
}

function types(path: SeoPath): unknown[] {
  return nodes(path).map((node) => node['@type']);
}

/** Sammelt Schlüssel verschachtelt — ein verbotenes Feld im Baum zählt mit. */
function allKeys(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) allKeys(entry, acc);
    return acc;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      acc.push(key);
      allKeys(child, acc);
    }
  }
  return acc;
}

describe('Routen-Tabelle', () => {
  it('deckt jede Route mit einem eigenen Titel ab', () => {
    expect(new Set(PATHS.map((p) => ROUTES[p].title)).size).toBe(PATHS.length);
  });

  it('vergiebt keine doppelte Description über die indexierbaren Routen', () => {
    expect(new Set(INDEXABLE.map((p) => ROUTES[p].description)).size).toBe(INDEXABLE.length);
  });

  it('hält jede Title-Ausgabe inklusive Markenname unter 60 Zeichen', () => {
    for (const path of PATHS) {
      const rendered = `${ROUTES[path].title}${BRAND_SUFFIX}`;
      expect(rendered.length, `${path}: ${rendered}`).toBeLessThanOrEqual(60);
    }
  });

  it('hält jede indexierbare Description im Ausgabebereich der Suchergebnisse', () => {
    for (const path of INDEXABLE) {
      const length = ROUTES[path].description.length;
      expect(length, `${path} ist ${length} Zeichen`).toBeGreaterThanOrEqual(110);
      expect(length, `${path} ist ${length} Zeichen`).toBeLessThanOrEqual(160);
    }
  });

  it('gibt jeder Route einen Brotnamen', () => {
    for (const path of PATHS) expect(ROUTES[path].crumb.length).toBeGreaterThan(0);
  });
});

describe('kanonische URLs', () => {
  it('setzt die Home auf den Base-Path mit Abschluss-Schrägstrich', () => {
    expect(absoluteUrl('/')).toBe(`${SITE_ORIGIN}/`);
  });

  it('hängt jeder Unterseite den Schrägstrich an, weil der Export Verzeichnisform baut', () => {
    for (const path of PATHS.filter((p) => p !== '/')) {
      expect(absoluteUrl(path)).toBe(`${SITE_ORIGIN}${path}/`);
    }
  });

  it('verdoppelt den Base-Path in keiner kanonischen URL', () => {
    for (const url of sitemapUrls()) {
      expect(url.startsWith(`${SITE_ORIGIN}/`)).toBe(true);
      expect(url).not.toContain(`${BASE_PATH}${BASE_PATH}`);
      expect(url.slice(SITE_ORIGIN.length)).not.toContain('//');
    }
  });
});

describe('pageMetadata', () => {
  it('setzt Canonical, Description und OG-URL auf dieselbe kanonische Adresse', () => {
    for (const path of PATHS) {
      const meta = pageMetadata(path);
      const url = absoluteUrl(path);
      expect(meta.alternates?.canonical).toBe(url);
      expect(meta.openGraph?.url).toBe(url);
      expect(meta.description).toBe(ROUTES[path].description);
    }
  });

  it('weist indexierbaren Seiten die Snippet-Direktiven zu, übergibt die anderen nur folgend', () => {
    for (const path of PATHS) {
      const expected = ROUTES[path].indexable ? CRAWLER_DIRECTIVES : { index: false, follow: true };
      expect(pageMetadata(path).robots, path).toEqual(expected);
    }
  });

  it('hängt den Markennamen an OG- und Twitter-Titel an, weil das Layout-Template dort nicht greift', () => {
    for (const path of PATHS) {
      const meta = pageMetadata(path);
      expect(meta.openGraph?.title).toBe(`${ROUTES[path].title}${BRAND_SUFFIX}`);
      expect(meta.twitter?.title).toBe(`${ROUTES[path].title}${BRAND_SUFFIX}`);
    }
  });

  it('verweist überall auf dasselbe Open-Graph-Bild', () => {
    for (const path of PATHS) {
      expect(pageMetadata(path).openGraph?.images).toEqual([{ ...OG_IMAGE }]);
    }
  });
});

describe('Sitemap und robots', () => {
  it('führt in der Sitemap exakt die indexierbaren Routen', () => {
    expect(sitemapUrls()).toEqual(INDEXABLE.map(absoluteUrl));
  });

  it('schließt in robots nur die nicht-indexierbaren Routen aus', () => {
    expect(disallowedPaths()).toEqual(PATHS.filter((p) => !ROUTES[p].indexable));
  });
});

describe('Structured Data', () => {
  const FORBIDDEN_KEYS = ['aggregateRating', 'review', 'reviews', 'dateModified', 'author', 'logo'];

  it('wirft einen einzigen @graph mit @context aus', () => {
    for (const path of PATHS) {
      expect(graph(path)['@context']).toBe('https://schema.org');
      expect(Array.isArray(graph(path)['@graph'])).toBe(true);
    }
  });

  it('erfindet keine Bewertungen, Datums oder Logos', () => {
    for (const path of PATHS) {
      for (const key of allKeys(graph(path))) {
        expect(FORBIDDEN_KEYS, `${path} enthält ${key}`).not.toContain(key);
      }
    }
  });

  it('gibt jeden Knoten mit Typ aus', () => {
    for (const path of PATHS) {
      for (const node of nodes(path)) expect(typeof node['@type']).toBe('string');
    }
  });

  it('trägt Organization, WebSite und WebPage auf jeder Route', () => {
    for (const path of PATHS) {
      const list = types(path);
      expect(list).toContain('Organization');
      expect(list).toContain('WebSite');
      expect(list).toContain('WebPage');
    }
  });

  it('verknüpft die Seite per @id mit Website und Publisher statt lose Blöcke zu lassen', () => {
    for (const path of PATHS) {
      const page = nodes(path).find((node) => node['@type'] === 'WebPage') as Record<
        string,
        { '@id'?: string }
      >;
      expect(page.isPartOf?.['@id']).toBe(`${SITE_ORIGIN}/#website`);
      expect(page.publisher?.['@id']).toBe(`${SITE_ORIGIN}/#organization`);
    }
  });

  it('zeichnet die drei Werkzeuge als WebApplication mit eigener URL auf der Seite', () => {
    const tools: SeoPath[] = ['/elektrik-planung', '/tools/dach', '/tools/heizung'];
    for (const path of tools) {
      const app = nodes(path).find((node) => node['@type'] === 'WebApplication');
      expect(app, `${path} ohne WebApplication`).toBeDefined();
      expect(app?.url).toBe(absoluteUrl(path));
      expect(app?.isPartOf).toEqual({ '@id': `${absoluteUrl(path)}#webpage` });
    }
  });

  it('gibt Guides als Article aus und keine andere Route', () => {
    for (const path of PATHS) {
      expect(types(path).includes('Article'), path).toBe(ROUTES[path].kind === 'guide');
    }
  });

  it('setzt BreadcrumbList auf jede Unterseite und nicht auf die Home', () => {
    for (const path of PATHS) {
      expect(types(path).includes('BreadcrumbList'), path).toBe(path !== '/');
    }
  });
});

describe('FAQ — Schema und Seitentext aus derselben Quelle', () => {
  const withFaq = PATHS.filter((p) => FAQS[p]);

  it('wirft FAQPage nur für Routen mit hinterlegten Fragen', () => {
    for (const path of PATHS) {
      expect(types(path).includes('FAQPage'), path).toBe(Boolean(FAQS[path]));
    }
  });

  it('liefert je Frage eine Antwort, die im Graph textgleich wiederkehrt', () => {
    for (const path of withFaq) {
      const faq = nodes(path).find((node) => node['@type'] === 'FAQPage') as {
        mainEntity: Record<string, unknown>[];
      };
      const entries = FAQS[path] ?? [];
      expect(faq.mainEntity).toHaveLength(entries.length);
      entries.forEach((entry, index) => {
        const item = faq.mainEntity[index];
        expect(item, `${path} Frage ${index + 1} fehlt im Graph`).toBeDefined();
        expect(item?.['@type']).toBe('Question');
        expect(item?.name).toBe(entry.question);
        expect((item?.acceptedAnswer as { text: string }).text).toBe(entry.answer);
      });
    }
  });

  it('verweist der WebPage-Knoten auf den FAQ-Knoten derselben Seite', () => {
    for (const path of withFaq) {
      const page = nodes(path).find((node) => node['@type'] === 'WebPage') as {
        mainEntity: { '@id': string };
      };
      expect(page.mainEntity['@id']).toBe(`${absoluteUrl(path)}#faq`);
    }
  });

  it('behauptet beim Spannungsfall keine Normgrenze, die der Code nicht setzt', () => {
    const answers = Object.values(FAQS)
      .flatMap((entries) => entries ?? [])
      .map((entry) => entry.answer);
    const stufen = answers.find((text) => text.includes('Zielband'));
    expect(stufen, 'keine Antwort zu den ΔU-Stufen').toBeDefined();
    expect(stufen).toContain('keine Normwerte');
  });
});

describe('Brotkrumen', () => {
  it('verweist auf keine Route, die nicht indexierbar ist', () => {
    const blocked = PATHS.filter((p) => !ROUTES[p].indexable);
    for (const path of INDEXABLE) {
      for (const item of breadcrumbTrail(path)) {
        expect(blocked.some((b) => item.url === absoluteUrl(b))).toBe(false);
      }
    }
  });

  it('beginnt auf jeder Unterseite bei der Start-Route', () => {
    for (const path of PATHS.filter((p) => p !== '/')) {
      expect(breadcrumbTrail(path)[0]?.url).toBe(absoluteUrl('/'));
    }
  });
});

describe('Open-Graph-Bild', () => {
  it('liegt tatsächlich im Auslieferungsordner', () => {
    const fileName = OG_IMAGE.url.replace(`${SITE_ORIGIN}/`, '');
    expect(existsSync(resolve(process.cwd(), 'public', fileName))).toBe(true);
  });

  it('hat die Standardmaße 1200×630', () => {
    expect(OG_IMAGE.width).toBe(1200);
    expect(OG_IMAGE.height).toBe(630);
  });
});

/**
 * Drift-Wächter: jede `page.tsx` im App-Router braucht einen Eintrag in der
 * Routen-Tabelle — sonst wächst die Seite um eine Route ohne Titel,
 * Description und Sitemap-Eintrag.
 */
function pageRoutes(dir: string, base: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    if (entry.isFile() && entry.name === 'page.tsx') found.push(base === '' ? '/' : base);
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('(') || entry.name.startsWith('[') || entry.name === 'api') continue;
    found.push(...pageRoutes(`${dir}/${entry.name}`, `${base}/${entry.name}`));
  }
  return found;
}

describe('Routen-Abdeckung', () => {
  it('kennt jede Route, die der App-Router ausliefert', () => {
    expect([...new Set(pageRoutes(resolve(process.cwd(), 'app'), ''))].sort()).toEqual([...PATHS].sort());
  });

  it('hält den Root-Titel des Layouts deckungsgleich zur Home-Route', () => {
    expect(HOME_TITLE).toBe(ROUTES['/'].title);
  });
});
