import { describe, it, expect } from 'vitest';
import { PLANNER_STORAGE_VERSION, migratePlannerPersisted, persistOptions } from './persistence';

/**
 * Vertragstest für den localStorage-Pfad des Planers.
 *
 * `version` + `migrate` in persistOptions sind die Schleuse für alte
 * Plan-Stände. Bis hierher prüfte nur storage.test.ts die Debounce-Runde —
 * die Migration selbst war ungetestet (Review-Befund, korrigierte Fassung
 * von „Persistenz-Versionierung").
 */

const validNode = { id: 'bat', type: 'battery', position: { x: 0, y: 0 }, data: {} };
const validEdge = { id: 'e1', source: 'bat', target: 'fuse', type: 'cableEdge', data: {} };

describe('persistOptions — Speicher-Vertrag', () => {
  it('fixiert Namen und Version (beide sind Teil des Contracts mit Alt-Ständen)', () => {
    expect(persistOptions.name).toBe('werft-planner-v1');
    expect(persistOptions.version).toBe(PLANNER_STORAGE_VERSION);
    expect(typeof persistOptions.migrate).toBe('function');
  });

  it('persistiert nur die extern sichtbaren Felder (partialize)', () => {
    const full = {
      ...migratePlannerPersisted({}, PLANNER_STORAGE_VERSION),
      viewMode: 'electric',
      season: 'summer',
      nodes: [],
      edges: [],
      waterNodes: [],
      waterEdges: [],
      isSidebarOpen: true,
      isInspectorOpen: false,
      backboneGrouping: true,
      // Interne Felder, die NICHT persistiert werden dürfen:
      undoStack: ['x'],
      systemMessage: 'nur Laufzeit',
    };
    const subset = persistOptions.partialize?.(full as never) as Record<string, unknown>;
    expect(Object.keys(subset).sort()).toEqual(
      [
        'backboneGrouping',
        'edges',
        'isInspectorOpen',
        'isSidebarOpen',
        'nodes',
        'season',
        'viewMode',
        'waterEdges',
        'waterNodes',
      ].sort()
    );
  });
});

describe('migratePlannerPersisted', () => {
  it('übernimmt einen wohlgeformten Stand vollständig', () => {
    const persisted = {
      viewMode: 'electric',
      season: 'winter',
      isSidebarOpen: false,
      isInspectorOpen: true,
      backboneGrouping: true,
      nodes: [validNode],
      edges: [validEdge],
      waterNodes: [validNode],
      waterEdges: [validEdge],
    };
    expect(migratePlannerPersisted(persisted, 1)).toEqual(persisted);
  });

  it('liefert für leeren/korrupten Gesamtstand ein leeres Partial (Store-Defaults greifen)', () => {
    expect(migratePlannerPersisted(null, 1)).toEqual({});
    expect(migratePlannerPersisted(undefined, 1)).toEqual({});
    expect(migratePlannerPersisted('kaputt', 1)).toEqual({});
  });

  it('filtert korrupte Knoten heraus, behält die gültigen', () => {
    const result = migratePlannerPersisted(
      {
        nodes: [
          validNode,
          { type: 'battery', position: { x: 0, y: 0 } }, // ohne id
          { id: 'ohne-position' }, // ohne position
          null,
          'string',
        ],
      },
      1
    );
    expect(result.nodes).toEqual([validNode]);
  });

  it('filtert Kanten ohne id/source/target heraus', () => {
    const result = migratePlannerPersisted(
      {
        edges: [
          validEdge,
          { id: 'nur-id' },
          { id: 'e2', source: 'a' }, // ohne target
          { source: 'a', target: 'b' }, // ohne id
        ],
      },
      1
    );
    expect(result.edges).toEqual([validEdge]);
  });

  it('lehnt unbekannte Enums und Nicht-Booleans ab statt sie zu „heilen"', () => {
    const result = migratePlannerPersisted(
      {
        viewMode: 'elektrisch',
        season: 'fruehjahr',
        isSidebarOpen: 'ja',
        nodes: 'keine-liste',
      },
      1
    );
    expect(result).toEqual({});
  });

  it('übernimmt keine unbekannten Felder', () => {
    const result = migratePlannerPersisted({ viewMode: 'water', plotzlichNeu: 42 }, 1);
    expect(result).toEqual({ viewMode: 'water' });
    expect('plotzlichNeu' in result).toBe(false);
  });

  it('verhält sich für die Alt-Version 0 identisch zu Version 1 (0→1 ist reine Validierung)', () => {
    const persisted = { viewMode: 'electric', nodes: [validNode, { kaputt: true }] };
    expect(migratePlannerPersisted(persisted, 0)).toEqual(migratePlannerPersisted(persisted, 1));
  });

  it('persistOptions.migrate delegiert auf migratePlannerPersisted', () => {
    const persisted = { season: 'winter', edges: [{ id: 'e', source: 'a', target: 'b' }] };
    expect(persistOptions.migrate?.(structuredClone(persisted), 1)).toEqual(persisted);
  });
});
