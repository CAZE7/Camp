/**
 * lib/seo/content/beispiele/beispiele.test.ts — die Beispiel-Seiten gegen
 * die Vorlagen verankern.
 *
 * Die drei `/beispiele/`-Seiten kopieren Werte aus
 * `components/planner/templates.ts`. Dieser Test erzwingt, dass die Kopie
 * handschriftlich bleibt UND bei Änderungen an den Vorlagen rot wird —
 * dann muss der Redaktionstext bewusst nachgezogen werden.
 *
 * Die Fragmente sind bewusst teils weich (Name, Kapazität, „0,5 m"): Sie
 * prüfen die Eckwerte, nicht jede Fußnote. Geprüft wird der gerenderte
 * Text (Überschriften + Absätze + alle Tabellenzeilen).
 */

import { describe, expect, it } from 'vitest';

import {
  PLANNER_TEMPLATES,
  TEMPLATE_AUTARK,
  TEMPLATE_KASTENWAGEN,
  TEMPLATE_MINIMALIST,
  type PlannerTemplate,
} from '../../../../components/planner/templates';

type TemplateGraph = {
  nodes: readonly { type?: string; data: Record<string, unknown> }[];
  edges: readonly { data?: Record<string, unknown> }[];
};

const de = (value: number): string => value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
import { BEISPIEL_AUTARK_CONTENT } from './grosses-autark-setup';
import { BEISPIEL_KASTENWAGEN_CONTENT } from './autarker-kastenwagen';
import { BEISPIEL_WOCHENEND_CONTENT } from './wochenend-camper';
import type { SeoPageContent } from '../../types';

function renderText(page: SeoPageContent): string {
  const chunks: string[] = [page.title, page.h1, page.lead];
  for (const section of page.sections) {
    chunks.push(section.heading ?? '');
    if (section.body) chunks.push(...section.body);
    if (section.list) chunks.push(...section.list.items);
    if (section.table) {
      chunks.push(
        section.table.caption ?? '',
        ...section.table.head,
        ...(section.table.note ? [section.table.note] : [])
      );
      for (const row of section.table.rows) chunks.push(...row);
    }
    if (section.callout) chunks.push(section.callout.text);
    for (const sub of section.subsections ?? []) chunks.push(sub.heading, ...sub.body);
    for (const link of section.links ?? []) chunks.push(link.label, link.description ?? '');
  }
  for (const faq of page.faq ?? []) chunks.push(faq.question, faq.answer);
  return chunks.join('\n');
}

function pageTextFor(id: string): { page: SeoPageContent; text: string } {
  const pages: Record<string, SeoPageContent> = {
    minimalist: BEISPIEL_WOCHENEND_CONTENT,
    kastenwagen: BEISPIEL_KASTENWAGEN_CONTENT,
    autark: BEISPIEL_AUTARK_CONTENT,
  };
  const page = pages[id];
  if (!page) throw new Error(`Keine Beispiel-Seite für Vorlage ${id}`);
  return { page, text: renderText(page) };
}

const FAELLE: readonly { graph: TemplateGraph; id: string }[] = [
  { graph: TEMPLATE_MINIMALIST as unknown as TemplateGraph, id: 'minimalist' },
  { graph: TEMPLATE_KASTENWAGEN as unknown as TemplateGraph, id: 'kastenwagen' },
  { graph: TEMPLATE_AUTARK as unknown as TemplateGraph, id: 'autark' },
];

for (const { graph, id } of FAELLE) {
  const vorlage: PlannerTemplate | undefined = PLANNER_TEMPLATES.find((entry) => entry.id === id);
  if (!vorlage) throw new Error(`PLANNER_TEMPLATES ohne ${id}`);
  describe(`Beispiel-Seite zu ${vorlage.label}`, () => {
    const { page, text } = pageTextFor(id);

    it('beschreibt dieselbe Vorlage: Name, Deep-Link, Batteriewerte', () => {
      const batterie = graph.nodes.find((node) => node.type === 'battery' && node.data.role === 'house');
      expect(batterie).toBeDefined();
      expect(text).toContain(`${String(batterie?.data.capacity)} Ah`);
      expect(text).toContain(`${de(Number(batterie?.data.nominalVoltage))} V`);
      expect(text).toContain(vorlage.label);
      expect(text).toContain(vorlage.href);
    });

    it('führt jede Kante der Vorlage mit Länge, Querschnitt und Schutz', () => {
      for (const edge of graph.edges) {
        const data = edge.data ?? {};
        expect(text).toContain(`${de(Number(data.length))} m`);
        expect(text).toContain(`${de(Number(data.crossSection))} mm²`);
        if (typeof data.fuseSize === 'number') {
          expect(text).toContain(`${String(data.fuseSize)} A`);
        }
      }
    });

    it('hält die Tagesenergie als W×h-Summe der Startwerte fest', () => {
      const verbraucher = graph.nodes.filter(
        (node) => node.type === 'consumer' || node.type === 'consumer230v'
      );
      const tagesWh = verbraucher.reduce(
        (sum, node) => sum + Number(node.data.watts) * Number(node.data.hours),
        0
      );
      const formatiert = tagesWh.toLocaleString('de-DE', { maximumFractionDigits: 0 });
      expect(text).toContain(formatiert);
    });

    it('erläutert die Annahmen und Grenzen offen', () => {
      // Keine Beispiel-Seite ohne die „Startwerte sind Annahmen"-Offenlegung.
      const textAll = [...(page.assumptions ?? []), ...(page.limits ?? [])].join(' ');
      expect(textAll).toMatch(/Startwerte/);
    });
  });
}

describe('Beispiel-Schaltplan und Datenblatt teilen sich dieselbe Vorlage', () => {
  it('die Autark-Seite verlinkt auf die Schwester-Seite schaltplan-beispiel', () => {
    const related = BEISPIEL_AUTARK_CONTENT.related?.map((link) => link.href) ?? [];
    expect(related).toContain('/camper-elektrik/schaltplan-beispiel/');
  });

  it('die Kastenwagen-Seite benennt das Erststart-Setup', () => {
    expect(BEISPIEL_KASTENWAGEN_CONTENT.lead).toContain('ersten Öffnen des Planers');
  });
});
