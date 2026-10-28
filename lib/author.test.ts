import { describe, expect, it } from 'vitest';

import { SITE_LEGAL } from './siteLegal';
import {
  AUTHOR_PROFILE_PATH,
  authorByline,
  authorMatchesProvider,
  authorNodeId,
  authorPersonNode,
  authorProfileUrl,
  SITE_AUTHOR,
} from './author';

/**
 * Autorenangabe.
 *
 * Sie ist eine Aussage über eine Person und steht an drei Stellen (Fußzeile
 * jeder Inhaltsseite, Autorenvorstellung, JSON-LD). Der Test hält die drei
 * zusammen und prüft, dass nur belegte Angaben darin stehen: ein Name, der mit
 * dem Anbieter im Impressum übereinstimmt, ein Satz zur Grundlage — und keine
 * erfundene Qualifikation.
 */
describe('SITE_AUTHOR', () => {
  it('nennt dieselbe Person wie das Impressum', () => {
    // Zwei Dateien, ein Mensch: Laufen die Namen auseinander, widersprechen
    // sich Impressum und Autorenzeile — und niemand merkt es.
    expect(authorMatchesProvider()).toBe(true);
    expect(SITE_AUTHOR.name).toBe(SITE_LEGAL.providerName);
  });

  it('beschreibt die Grundlage mit den beiden belegten Angaben', () => {
    for (const form of [SITE_AUTHOR.background, SITE_AUTHOR.backgroundFirstPerson]) {
      expect(form).toContain('Camper');
      expect(form).toContain('Universität');
    }
    // Beide Formen sagen dasselbe — die eine fürs JSON-LD, die andere für die
    // sichtbare Vorstellung. Weicht eine ab, ist eine der beiden falsch.
    expect(SITE_AUTHOR.background).toContain('studiert');
    expect(SITE_AUTHOR.backgroundFirstPerson).toContain('studiere');
  });

  it('erfindet keine Titel, Grade oder Arbeitgeber', () => {
    // Diese Marker würden eine Qualifikation behaupten, die nicht geliefert
    // wurde. Kommt eine echte Angabe dazu, gehört sie hierher — nicht in einen
    // Fließtext, den niemand prüft.
    const text = [SITE_AUTHOR.role, SITE_AUTHOR.background, SITE_AUTHOR.backgroundFirstPerson].join(' ');
    expect(text).not.toMatch(/\b(Dr\.|Prof\.|Dipl\.|Ing\.|B\.Eng\.|M\.Sc\.|B\.Sc\.)\b/);
    expect(text).not.toMatch(/Elektrofachkraft|Sachverständig|zertifiziert/i);
  });

  it('zeigt in der Fußzeile Name und Rolle, ohne den Anspruch zu überziehen', () => {
    expect(authorByline()).toBe(`Von ${SITE_AUTHOR.name}, ${SITE_AUTHOR.role}`);
  });
});

describe('authorPersonNode', () => {
  it('ist ein Person-Knoten mit stabiler @id und absoluter Adresse', () => {
    const node = authorPersonNode();
    expect(node['@type']).toBe('Person');
    expect(node['@id']).toBe(authorNodeId());
    expect(node['@id']).toBe('https://elektroplaner-camper.de/#author');
    expect(node.name).toBe(SITE_LEGAL.providerName);
    expect(node.url).toBe(authorProfileUrl());
    expect(node.url).toBe(`https://elektroplaner-camper.de${AUTHOR_PROFILE_PATH}`);
  });

  it('verweist auf die Organisation statt sie neu zu beschreiben', () => {
    const node = authorPersonNode();
    // Ein zweiter Organization-Datensatz neben dem im Layout wäre eine zweite
    // Wahrheit über denselben Gegenstand.
    expect(node.worksFor).toEqual({ '@id': 'https://elektroplaner-camper.de/#organization' });
    expect(node).not.toHaveProperty('alumniOf');
    expect(node).not.toHaveProperty('knowsAbout');
  });

  it('beschreibt die Person in einem Satz, der zur sichtbaren Vorstellung passt', () => {
    expect(authorPersonNode().description).toBe(`${SITE_AUTHOR.name} ${SITE_AUTHOR.background}.`);
  });
});
