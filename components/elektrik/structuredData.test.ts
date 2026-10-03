import { describe, expect, it, vi } from 'vitest';

import { siteUrl } from '@/lib/site';

import { ELEKTRIK_FAQ, PAGE_DESCRIPTION, PAGE_H1 } from './electricContent';
import { buildElektrikPlanungJsonLd, serializeJsonLd } from './structuredData';

/**
 * Die strukturierte Beschreibung ist eine Zusage an Maschinen. Geprüft wird
 * deshalb nicht nur, dass sie gültiges JSON ist, sondern dass die Pflichtfelder
 * der verwendeten Typen belegt sind und die Adressen stimmen — ein Tippfehler
 * in der Adresse würde sonst erst in einem externen Prüfwerkzeug auffallen.
 */
describe('buildElektrikPlanungJsonLd', () => {
  const graph = buildElektrikPlanungJsonLd();
  const nodes = graph['@graph'];
  const byType = (type: string) => nodes.filter((node) => node['@type'] === type);

  it('verknüpft die Knoten über @id statt Adressen zu wiederholen', () => {
    const ids = nodes.map((node) => node['@id']);
    expect(new Set(ids).size).toBe(ids.length);

    const page = byType('WebPage')[0]!;
    expect(page['isPartOf']).toEqual({ '@id': `${siteUrl('/')}#website` });
    expect(page['mainEntity']).toEqual({
      '@id': `${siteUrl('/elektrik-planung/')}#webapplication`,
    });
  });

  it('beschreibt die Anwendung mit Kategorie, System und kostenlosem Angebot', () => {
    const application = byType('WebApplication')[0]!;

    expect(application['name']).toBe(PAGE_H1);
    expect(application['applicationCategory']).toBe('UtilityApplication');
    expect(application['operatingSystem']).toBe('All');
    expect(application['browserRequirements']).toBe('HTML5, JavaScript');
    expect(application['isAccessibleForFree']).toBe(true);
    expect(application['offers']).toEqual({ '@type': 'Offer', price: '0', priceCurrency: 'EUR' });
  });

  it('führt jede Frage genau einmal als Question mit Antwort', () => {
    const faq = byType('FAQPage')[0]!;
    const questions = faq['mainEntity'] as Array<Record<string, unknown>>;

    expect(questions).toHaveLength(ELEKTRIK_FAQ.length);
    expect(questions.map((question) => question['name'])).toEqual(
      ELEKTRIK_FAQ.map((entry) => entry.question)
    );
    for (const [index, question] of questions.entries()) {
      expect(question['@type']).toBe('Question');
      expect(question['acceptedAnswer']).toEqual({
        '@type': 'Answer',
        text: ELEKTRIK_FAQ[index]!.answer,
      });
    }
  });

  it('nennt die Beschreibung der Seite, die auch im Kopfbereich steht', () => {
    const page = byType('WebPage')[0]!;
    expect(page['name']).toBe(PAGE_H1);
    expect(page['description']).toBe(PAGE_DESCRIPTION);
    expect(page['url']).toBe(siteUrl('/elektrik-planung/'));
  });

  it('serialisiert ohne Zeichen, die das Skriptelement beenden könnten', () => {
    const serialized = serializeJsonLd(graph);

    expect(serialized).not.toContain('</script');
    expect(serialized).not.toContain('<');
    expect((JSON.parse(serialized) as { '@context': string })['@context']).toBe('https://schema.org');
  });
});

describe('serializeJsonLd', () => {
  it('maskiert öffnende spitze Klammern in Textinhalten, ohne den Inhalt zu verändern', () => {
    const serialized = serializeJsonLd({
      '@context': 'https://schema.org',
      '@graph': [{ '@type': 'Thing', name: 'Leitung < 6 mm²' }],
    });

    expect(serialized).toContain('\\u003c');
    expect((JSON.parse(serialized) as { '@graph': Array<{ name: string }> })['@graph'][0]!.name).toBe(
      'Leitung < 6 mm²'
    );
  });
});

/**
 * Die Adressbildung hängt am Basis-Pfad der Auslieferung. Der wird beim Import
 * gelesen, deshalb wird das Modul für diesen Fall frisch geladen.
 */
describe('mit Basis-Pfad der Auslieferung', () => {
  it('bildet alle Adressen unter dem Basis-Pfad', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/Camp');

    try {
      const module = await import('./structuredData');
      const graph = module.buildElektrikPlanungJsonLd();
      const page = graph['@graph'].find((node) => node['@type'] === 'WebPage')!;

      expect(page['@id']).toBe('https://caze7.github.io/Camp/elektrik-planung/#webpage');
      expect(page['url']).toBe('https://caze7.github.io/Camp/elektrik-planung/');
      expect(page['isPartOf']).toEqual({ '@id': 'https://caze7.github.io/Camp/#website' });
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
