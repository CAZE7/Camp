import { describe, expect, it } from 'vitest';

import { verifyPlan } from '../../lib/verify';
import {
  isStarterPlan,
  PLANNER_TEMPLATES,
  resolvePlannerTemplateId,
  shouldLoadStarterPlan,
  STARTER_TEMPLATE_ID,
  TEMPLATE_ALLROUNDER,
  TEMPLATE_KASTENWAGEN,
  templateIdFromSearch,
  TEMPLATES_DICT,
} from './templates';

describe('PLANNER_TEMPLATES', () => {
  it('führt die drei Ausbaustufen mit auflösbaren Deep-Links', () => {
    expect(PLANNER_TEMPLATES.map((template) => template.id)).toEqual(['minimalist', 'kastenwagen', 'autark']);
    for (const template of PLANNER_TEMPLATES) {
      expect(TEMPLATES_DICT[template.id], `Vorlage fehlt: ${template.id}`).toBeDefined();
      expect(templateIdFromSearch(template.href.slice(template.href.indexOf('?')))).toBe(template.id);
    }
  });

  it('beschreibt das Kastenwagen-Setup mit den Werten, die im Graphen stehen', () => {
    const battery = TEMPLATE_KASTENWAGEN.nodes.find((node) => node.id === 'battery-1');
    const solar = TEMPLATE_KASTENWAGEN.nodes.find((node) => node.id === 'solar-1');
    const booster = TEMPLATE_KASTENWAGEN.nodes.find((node) => node.id === 'charger-2');

    expect(battery?.data).toMatchObject({ capacity: 100, chemistry: 'LiFePO4' });
    expect(solar?.data).toMatchObject({ watts: 200 });
    expect(booster?.data).toMatchObject({ amps: 30 });
    expect(TEMPLATE_KASTENWAGEN.edges.length).toBeGreaterThan(10);
  });
});

describe('resolvePlannerTemplateId', () => {
  it('löst Kennungen und Aliasse schreibungsunabhängig auf', () => {
    expect(resolvePlannerTemplateId('kastenwagen')).toBe('kastenwagen');
    expect(resolvePlannerTemplateId(' Ladebooster-Solar ')).toBe('kastenwagen');
    expect(resolvePlannerTemplateId('wochenende')).toBe('minimalist');
    expect(resolvePlannerTemplateId('winter-autark')).toBe('autark');
    expect(resolvePlannerTemplateId('allrounder')).toBe('kastenwagen');
  });

  it('lehnt unbekannte Werte ausdrücklich ab statt still eine Vorlage zu laden', () => {
    expect(resolvePlannerTemplateId('gibts-nicht')).toBeNull();
    expect(resolvePlannerTemplateId('')).toBeNull();
    expect(resolvePlannerTemplateId(null)).toBeNull();
    expect(templateIdFromSearch('?template=gibts-nicht')).toBeNull();
    expect(templateIdFromSearch('')).toBeNull();
  });
});

describe('Starter-Plan', () => {
  it('ist das Kastenwagen-Setup und wird als unverändert erkannt', () => {
    expect(STARTER_TEMPLATE_ID).toBe('kastenwagen');
    expect(isStarterPlan(TEMPLATE_KASTENWAGEN.nodes, TEMPLATE_KASTENWAGEN.edges)).toBe(true);
    expect(isStarterPlan([], [])).toBe(false);
    expect(
      isStarterPlan(
        [...TEMPLATE_KASTENWAGEN.nodes, { id: 'extra', position: { x: 0, y: 0 }, data: {} }],
        TEMPLATE_KASTENWAGEN.edges
      )
    ).toBe(false);
  });

  it('lädt nur ohne gespeicherten Plan, ohne Deep-Link und bei leerer Fläche', () => {
    const basis = { hasPersistedPlan: false, nodeCount: 0, waterNodeCount: 0, hasEntryPlan: false };
    expect(shouldLoadStarterPlan(basis)).toBe(true);
    expect(shouldLoadStarterPlan({ ...basis, hasPersistedPlan: true })).toBe(false);
    expect(shouldLoadStarterPlan({ ...basis, hasEntryPlan: true })).toBe(false);
    expect(shouldLoadStarterPlan({ ...basis, nodeCount: 1 })).toBe(false);
    expect(shouldLoadStarterPlan({ ...basis, waterNodeCount: 1 })).toBe(false);
  });
});

/**
 * Nachtest 2026-10-16: „Vorlage: 0 h / 0 V / Nicht bestanden“.
 * Die drei kanonischen Vorlagen (plus der Allrounder, aus dem der
 * Kastenwagen abgeleitet ist) starten mit vollständigen Werten.
 * Aliasse im Dict zeigen auf dieselben Graphen und werden nicht doppelt geprüft.
 */
describe('Vorlagen tragen vollständige Startwerte (Nachtest)', () => {
  const entries = (['minimalist', 'kastenwagen', 'autark'] as const).map((name) => {
    const template = TEMPLATES_DICT[name];
    if (!template) throw new Error(`Vorlage fehlt: ${name}`);
    return [name, template] as const;
  });

  for (const [name, template] of entries) {
    it(`${name}: jeder Verbraucher hat Leistung und Nutzungsdauer > 0`, () => {
      const consumers = template.nodes.filter(
        (node) => node.type === 'consumer' || node.type === 'consumer230v'
      );
      expect(consumers.length).toBeGreaterThan(0);
      for (const node of consumers) {
        const data = node.data as { watts?: number; hours?: number; label?: string };
        expect(data.watts ?? 0, `${data.label} watts`).toBeGreaterThan(0);
        expect(data.hours ?? 0, `${data.label} hours`).toBeGreaterThan(0);
        expect(data.hours ?? 0, `${data.label} hours ≤ 24`).toBeLessThanOrEqual(24);
      }
    });

    it(`${name}: Solarmodule haben Arbeitsspannung/-strom, Batterien eine Kapazität`, () => {
      for (const node of template.nodes) {
        const data = node.data as Record<string, number | string | undefined>;
        if (node.type === 'solar') {
          expect(Number(data.voltage ?? 0), 'solar voltage').toBeGreaterThan(0);
          expect(Number(data.amps ?? 0), 'solar amps').toBeGreaterThan(0);
          expect(Number(data.watts ?? 0), 'solar watts').toBeGreaterThan(0);
        }
        if (node.type === 'battery') {
          // Keine erfundene Nennspannung in der Vorlage: Ohne Angabe nimmt
          // die Engine den Chemie-Standard an (12,8 V LiFePO4 / 12,0 V
          // Blei) — explizite 12 vs. 12,8 würden Starter- + Aufbaubatterie
          // fälschlich als „Mischspannung“ melden.
          expect(data.nominalVoltage, 'battery nominalVoltage bleibt Annahme').toBeUndefined();
          expect(Number(data.capacity ?? 0), 'battery capacity').toBeGreaterThan(0);
        }
        if (node.type === 'mpptController') {
          expect(Number(data.maxPvVoltage ?? 0), 'mppt maxPvVoltage').toBeGreaterThan(0);
        }
      }
    });

    it(`${name}: Knoten-IDs sind eindeutig und Kanten zeigen auf vorhandene Knoten`, () => {
      const ids = template.nodes.map((node) => node.id);
      expect(new Set(ids).size).toBe(ids.length);
      const idSet = new Set(ids);
      for (const edge of template.edges) {
        expect(idSet.has(edge.source), `source ${edge.source}`).toBe(true);
        expect(idSet.has(edge.target), `target ${edge.target}`).toBe(true);
      }
    });
  }
});

describe('Beispielplan des Erststarts (Nachtest live)', () => {
  it('vergibt jede Bezeichnung nur einmal', () => {
    for (const template of [TEMPLATE_KASTENWAGEN, TEMPLATE_ALLROUNDER]) {
      const designators = template.nodes.map((node) => (node.data as { designator?: string }).designator);
      expect(designators.every((value) => typeof value === 'string' && value !== '')).toBe(true);
      expect(new Set(designators).size).toBe(designators.length);
    }
    const starter = TEMPLATE_KASTENWAGEN.nodes.map(
      (node) => (node.data as { designator: string }).designator
    );
    expect(starter.filter((value) => value === 'G1')).toHaveLength(1);
    expect(starter.filter((value) => value === 'G2')).toHaveLength(1);
    expect(starter.filter((value) => value === 'W1')).toHaveLength(1);
    expect(starter.filter((value) => value === 'E1')).toHaveLength(1);
    expect(starter).toEqual(expect.arrayContaining(['G1.2', 'G2.2', 'W1.2', 'E1.2', 'E1.3']));
  });

  it('besteht den eigenen Prüfbericht ohne Fehlschlag und ohne Sicherung 0', () => {
    const fuse = TEMPLATE_KASTENWAGEN.nodes.find((node) => node.id === 'fusebox-1');
    expect((fuse?.data as { rating?: number }).rating).toBeGreaterThan(0);
    const report = verifyPlan({
      nodes: TEMPLATE_KASTENWAGEN.nodes,
      edges: TEMPLATE_KASTENWAGEN.edges,
    });
    expect(report.verdict).not.toBe('NON_COMPLIANT');
    expect(report.coverage.failed).toBe(0);
  });
});
