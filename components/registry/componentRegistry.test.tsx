import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sparkles } from 'lucide-react';
import type { Node } from 'reactflow';
import {
  BUILTIN_COMPONENT_SPECS,
  ComponentSpecError,
  assertValidSpec,
  buildNodeTypes,
  componentCount,
  getComponentSpec,
  hasComponentSpec,
  labelOfType,
  listComponentSpecs,
  listSelectableSpecs,
  registerComponent,
  unregisterComponent,
  type ComponentSpec,
} from './index';
import { Sidebar } from '../Sidebar';
import { nodeDomains, nodeMinimapColor } from '../planner/utils/domainFilter';
import { NODE_TYPES } from '../planner/constants';

/**
 * components/registry/componentRegistry.test.tsx
 *
 * Zwei Fragen werden hier beantwortet (AGENTS.md K4):
 *
 *   1. Ist die Registry in sich konsistent und gegen Unsinn abgesichert?
 *   2. Lässt sich ein neues Bauteil **wirklich isoliert** ergänzen — also
 *      ohne Änderung an Sidebar, NODE_TYPES, Stückliste oder Domänen-Filter?
 *
 * Frage 2 ist der eigentliche Nachweis: der Test registriert ein Bauteil,
 * das im Produktionscode nirgends vorkommt, und prüft, dass alle Konsumenten
 * es kennen.
 */

/** Minimale, gültige Spec für Tests. */
const testSpec = (overrides: Partial<ComponentSpec> = {}): ComponentSpec => ({
  id: 'testHeatPump',
  label: 'Test-Wärmepumpe',
  category: 'Geräte',
  description: 'Nur für Tests registriertes Bauteil.',
  purpose: 'Belegt, dass neue Bauteile isoliert ergänzbar sind.',
  mode: 'electric',
  domains: ['DC_12V'],
  icon: Sparkles,
  node: () => <div data-testid="test-heat-pump-node">Wärmepumpe</div>,
  handles: [
    { id: 'plus', type: 'target', domain: 'DC_12V' },
    { id: 'minus', type: 'target', domain: 'DC_12V' },
  ],
  defaults: { watts: 350 },
  ...overrides,
});

describe('Registry — Konsistenz der eingebauten Bauteile', () => {
  it('registriert alle eingebauten Bauteile genau einmal', () => {
    expect(componentCount()).toBe(BUILTIN_COMPONENT_SPECS.length);
    const ids = BUILTIN_COMPONENT_SPECS.map((spec) => spec.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('jede eingebaute Spec ist gültig', () => {
    for (const spec of BUILTIN_COMPONENT_SPECS) {
      expect(() => assertValidSpec(spec)).not.toThrow();
    }
  });

  it('deckt die Bauteiltypen ab, die Auto-Wire und Vorlagen erzeugen', () => {
    // Diese Typen entstehen automatisch (lib/autoWire.ts) und müssen in der
    // Stückliste und im Canvas benennbar sein.
    for (const type of ['battery', 'busbar', 'shunt', 'fuse', 'mpptController', 'ground']) {
      expect(hasComponentSpec(type), `${type} fehlt in der Registry`).toBe(true);
    }
  });

  it('bietet Alt-Typen weiter an, aber nicht mehr zum Einfügen', () => {
    // `charger` stammt aus früheren Plänen: darstellbar und benennbar,
    // aber nicht mehr in der Sidebar.
    expect(hasComponentSpec('charger')).toBe(true);
    expect(getComponentSpec('charger')?.selectable).toBe(false);
    expect(listSelectableSpecs('electric').map((spec) => spec.id)).not.toContain('charger');
  });

  it('trennt Elektrik- und Wasser-Bauteile', () => {
    const electric = listComponentSpecs('electric');
    const water = listComponentSpecs('water');
    expect(electric.length).toBeGreaterThan(0);
    expect(water.length).toBeGreaterThan(0);
    expect(electric.length + water.length).toBe(componentCount());
    for (const spec of water) {
      expect(spec.domains).toEqual(['WATER']);
    }
  });

  it('liefert für unbekannte Typen einen ehrlichen Rückfallwert', () => {
    expect(getComponentSpec('gibtsNicht')).toBeUndefined();
    expect(labelOfType('gibtsNicht')).toBe('Unbekanntes Bauteil');
    expect(labelOfType(undefined, 'Platzhalter')).toBe('Platzhalter');
  });
});

describe('Registry — Laufzeitvalidierung', () => {
  it('lehnt fehlende Pflichtfelder ab', () => {
    expect(() => assertValidSpec(testSpec({ label: '' }))).toThrow(ComponentSpecError);
    expect(() => assertValidSpec(testSpec({ purpose: '   ' }))).toThrow(/purpose fehlt/);
    expect(() => assertValidSpec(testSpec({ domains: [] }))).toThrow(/domains fehlt/);
  });

  it('lehnt ungültige IDs ab', () => {
    expect(() => assertValidSpec(testSpec({ id: '' }))).toThrow(ComponentSpecError);
    expect(() => assertValidSpec(testSpec({ id: '2fast' }))).toThrow(/id fehlt/);
    expect(() => assertValidSpec(testSpec({ id: 'mit-strich' }))).toThrow(/id fehlt/);
  });

  it('lehnt doppelte Anschlüsse ab', () => {
    const duplicate = testSpec({
      handles: [
        { id: 'plus', type: 'target', domain: 'DC_12V' },
        { id: 'plus', type: 'target', domain: 'DC_12V' },
      ],
    });
    expect(() => assertValidSpec(duplicate)).toThrow(/doppelter Anschluss/);
  });

  it('lehnt gemischte Domänen zwischen Modus und Anschlüssen ab', () => {
    const wrongWater = testSpec({
      id: 'testMixed',
      mode: 'water',
      domains: ['WATER'],
      handles: [{ id: 'plus', type: 'target', domain: 'DC_12V' }],
    });
    expect(() => assertValidSpec(wrongWater)).toThrow(/Wasser-Bauteil mit elektrischem Anschluss/);

    const wrongElectric = testSpec({
      handles: [{ id: 'in', type: 'target', domain: 'WATER' }],
    });
    expect(() => assertValidSpec(wrongElectric)).toThrow(/Elektrik-Bauteil mit Wasseranschluss/);
  });

  it('verhindert stilles Überschreiben einer vorhandenen ID', () => {
    expect(() => registerComponent(testSpec({ id: 'battery' }))).toThrow(/bereits registriert/);
    // Die vorhandene Definition bleibt unverändert.
    expect(getComponentSpec('battery')?.label).toBe('Batterie');
  });

  it('nennt im Fehlertext die betroffene ID', () => {
    try {
      assertValidSpec(testSpec({ id: 'testKaputt', label: '' }));
      expect.unreachable('hätte werfen müssen');
    } catch (error) {
      expect((error as Error).message).toContain('testKaputt');
    }
  });
});

describe('Registry — ein neues Bauteil ist isoliert ergänzbar', () => {
  afterEach(() => {
    unregisterComponent('testHeatPump');
  });

  it('erscheint in der Sidebar, ohne dass Sidebar.tsx geändert wird', () => {
    registerComponent(testSpec());

    render(<Sidebar />);
    for (const toggle of screen.getAllByRole('button', { expanded: false })) {
      fireEvent.click(toggle);
    }

    const tile = screen
      .getAllByTestId('sidebar-item')
      .find((element) => element.getAttribute('data-component-type') === 'testHeatPump');

    expect(tile, 'Neues Bauteil fehlt in der Sidebar').toBeDefined();
    expect(tile).toHaveAttribute('data-component-label', 'Test-Wärmepumpe');
    expect(tile?.textContent).toContain('Test-Wärmepumpe');
  });

  it('ist im Canvas darstellbar, ohne dass constants.ts geändert wird', () => {
    registerComponent(testSpec());
    const types = buildNodeTypes();
    expect(types.testHeatPump).toBeDefined();
    expect(Object.keys(types).length).toBe(componentCount());
  });

  it('wird vom Domänen-Filter und der Minimap eingeordnet', () => {
    registerComponent(testSpec({ domains: ['AC_230V'] }));
    const node = { id: 'n1', type: 'testHeatPump', position: { x: 0, y: 0 }, data: {} } as Node;

    expect(nodeDomains(node)).toEqual(['AC_230V']);
    // Farbe kommt aus der Domäne, nicht aus einer Typ-Tabelle.
    expect(nodeMinimapColor(node)).toBe(nodeMinimapColor({ ...node, type: 'consumer230v' } as Node));
  });

  it('liefert Label und Zweck für die Stückliste', () => {
    registerComponent(testSpec());
    const spec = getComponentSpec('testHeatPump');
    expect(spec?.label).toBe('Test-Wärmepumpe');
    expect(spec?.purpose).toContain('isoliert ergänzbar');
  });

  it('nach dem Entfernen ist das Bauteil überall wieder weg', () => {
    registerComponent(testSpec());
    expect(hasComponentSpec('testHeatPump')).toBe(true);

    unregisterComponent('testHeatPump');

    expect(hasComponentSpec('testHeatPump')).toBe(false);
    expect(buildNodeTypes().testHeatPump).toBeUndefined();
    expect(listSelectableSpecs('electric').map((spec) => spec.id)).not.toContain('testHeatPump');
  });
});

describe('Registry — Konsumenten bleiben synchron', () => {
  it('NODE_TYPES kennt genau die registrierten Bauteile', () => {
    // NODE_TYPES wird beim Import einmalig gebaut; die eingebauten Bauteile
    // müssen vollständig enthalten sein.
    for (const spec of BUILTIN_COMPONENT_SPECS) {
      expect(NODE_TYPES[spec.id], `NODE_TYPES fehlt ${spec.id}`).toBeDefined();
    }
  });

  it('jede Sidebar-Kachel entspricht einer Registry-Spec', () => {
    render(<Sidebar />);
    for (const toggle of screen.getAllByRole('button', { expanded: false })) {
      fireEvent.click(toggle);
    }
    for (const tile of screen.getAllByTestId('sidebar-item')) {
      const type = tile.getAttribute('data-component-type') as string;
      expect(hasComponentSpec(type), `Kachel ${type} ohne Spec`).toBe(true);
    }
  });

  it('Label in Sidebar und Stückliste stammen aus derselben Quelle', () => {
    // Genau hier lief es vorher auseinander: die Stückliste nannte den Shunt
    // „Batteriemonitor mit Shunt“, die Sidebar „Batteriemonitor (Shunt)“.
    const shunt = getComponentSpec('shunt');
    expect(shunt?.label).toBe('Batteriemonitor (Shunt)');
    expect(labelOfType('shunt')).toBe(shunt?.label);
  });
});
