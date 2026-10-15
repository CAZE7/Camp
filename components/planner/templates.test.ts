import { describe, expect, it } from 'vitest';

import {
  isStarterPlan,
  PLANNER_TEMPLATES,
  resolvePlannerTemplateId,
  shouldLoadStarterPlan,
  STARTER_TEMPLATE_ID,
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
