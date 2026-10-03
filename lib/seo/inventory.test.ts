import { describe, expect, it } from 'vitest';

import { coverageMatrix, coverageSummary, openGaps, undeclaredTargets } from './coverage';
import { indexablePages, nonIndexablePages, PAGES, pageByPath } from './inventory';
import { OPPORTUNITIES } from './opportunities';
import { childTopics, topicOf, TOPICS, topicTrail } from './topics';
import { DESCRIPTION_MAX, TITLE_MAX } from '../../scripts/seo/checks';

/**
 * Der Vertrag der SEO-Datenebene.
 *
 * Diese Tests brauchen keinen Bau: Sie prüfen die Erklärungen selbst — dass
 * jede Seite genau einmal deklariert ist, jede Anfrage auf eine ausgelieferte
 * Seite zeigt, jede Themenkennung existiert und keine Pflichtangabe fehlt.
 * Die Prüfung des gebauten Exports leistet `scripts/seo/auditExport.ts`; hier
 * geht es um die Quelle, aus der Sitemap, Verlinkung und Bericht entstehen.
 */
describe('Seiteninventar', () => {
  it('deklariert jede Seite genau einmal', () => {
    const paths = PAGES.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(path.startsWith('/'), `Pfad ohne führenden Schrägstrich: ${path}`).toBe(true);
      expect(path.endsWith('/'), `Pfad ohne abschließenden Schrägstrich: ${path}`).toBe(true);
    }
  });

  it('führt jede indexierbare Seite mit Titel, Beschreibung und Sitemap-Angabe', () => {
    for (const page of indexablePages()) {
      expect(page.sitemap, `Sitemap-Angabe fehlt: ${page.path}`).toBeDefined();
      if (page.title !== undefined) expect(page.title.length).toBeLessThanOrEqual(TITLE_MAX);
      if (page.description !== undefined)
        expect(page.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    }
  });

  it('führt Nicht-Indexierbares ohne Sitemap-Angabe', () => {
    for (const page of nonIndexablePages()) {
      expect(page.sitemap, `Noindex-Seite in der Sitemap: ${page.path}`).toBeUndefined();
    }
  });

  it('ordnet jede Seite einem bekannten Thema zu', () => {
    for (const page of PAGES) {
      expect(() => topicOf(page.topicId as Parameters<typeof topicOf>[0])).not.toThrow();
    }
  });

  it('löst jeden Pfad wieder auf', () => {
    for (const page of PAGES) {
      expect(pageByPath(page.path)?.path).toBe(page.path);
    }
  });
});

describe('Themenbaum', () => {
  it('vergibt eindeutige Kennungen', () => {
    const ids = TOPICS.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('bildet jeden Elternverweis auf ein vorhandenes Thema ab', () => {
    for (const topic of TOPICS) {
      if (topic.parent) expect(() => topicOf(topic.parent!)).not.toThrow();
    }
  });

  it('baut den Weg zur Wurzel ohne Schleife', () => {
    for (const topic of TOPICS) {
      const trail = topicTrail(topic.id);
      expect(trail[0]!.parent).toBeUndefined();
      expect(trail[trail.length - 1]!.id).toBe(topic.id);
    }
  });

  it('verbindet jedes Unterthema mit einer Seite', () => {
    for (const topic of TOPICS) {
      if (topic.role === 'cluster') {
        expect(topic.path, `Cluster ohne Seite: ${topic.id}`).toBeDefined();
        expect(pageByPath(topic.path!), `Cluster-Seite fehlt im Inventar: ${topic.path}`).toBeDefined();
      }
    }
  });

  it('findet das Pillar-Thema des Elektrik-Baums', () => {
    expect(topicOf('camper-elektrik').role).toBe('pillar');
    expect(childTopics('camper-elektrik').length).toBeGreaterThan(5);
  });
});

describe('Suchintentionen', () => {
  it('zeigt jede Anfrage auf eine deklarierte Seite', () => {
    expect(undeclaredTargets()).toEqual([]);
  });

  it('vergibt eindeutige Kennungen', () => {
    const ids = OPPORTUNITIES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lässt keine offene P0-Intention zu', () => {
    expect(coverageSummary().openPriority0).toEqual([]);
  });

  it('begründet jede nicht abgedeckte Anfrage mit einem nächsten Schritt', () => {
    for (const row of coverageMatrix()) {
      if (row.coverage === 'abgedeckt') {
        expect(row.action, `Abgedeckt, aber ohne Handlung: ${row.id}`).toBe('keine');
        expect(row.gap, `Abgedeckt, aber mit Lücke: ${row.id}`).toBeNull();
      } else {
        expect(row.action, `Lücke ohne Handlung: ${row.id}`).not.toBe('keine');
        expect(row.gap, `Lücke ohne Beschreibung: ${row.id}`).not.toBeNull();
      }
    }
  });

  it('führt jede Anfrage einer Zeile auf eine Seite, die es gibt', () => {
    for (const row of openGaps()) {
      if (row.page) expect(pageByPath(row.page), `Zielseite fehlt: ${row.page}`).toBeDefined();
    }
  });

  it('zählt die Abdeckung vollständig', () => {
    const summary = coverageSummary();
    expect(summary.covered + summary.partial + summary.missing).toBe(summary.total);
    expect(summary.total).toBe(OPPORTUNITIES.length);
  });
});
