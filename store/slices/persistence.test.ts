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
    // AUDIT PERSIST-001: Validierte Kanten werden normalisiert — fehlendes
    // `data` wird zum einheitlichen leeren Objekt (kein undefined downstream).
    expect(persistOptions.migrate?.(structuredClone(persisted), 1)).toEqual({
      ...persisted,
      edges: [{ id: 'e', source: 'a', target: 'b', data: {} }],
    });
  });

  it('DOM-003: Schema-Validierung entfernt falsch getippte bekannte Felder', () => {
    const persisted = {
      nodes: [
        {
          id: 'ok',
          type: 'battery',
          position: { x: 0, y: 0 },
          data: { label: 'Aufbau', capacity: 100, chemistry: 'AGM' },
        },
        {
          id: 'muell',
          type: 'battery',
          position: { x: 1, y: 1 },
          data: { label: 'Alt', capacity: 'viel', chemistry: 42, watts: 'unklar' },
        },
      ],
    };
    const result = migratePlannerPersisted(persisted, 1);
    const ok = result.nodes?.find((n) => n.id === 'ok');
    const muell = result.nodes?.find((n) => n.id === 'muell');
    expect(ok?.data).toEqual({ label: 'Aufbau', capacity: 100, chemistry: 'AGM' });
    // Falsch getippte BEKANNTE Felder fliegen raus (Leseschicht fällt auf
    // dokumentierte Defaults), unbekannte bleiben:
    expect(muell?.data).toEqual({ label: 'Alt' });
  });
});

describe('Version 1 → 2: Layout-Fallback-Maße heilen', () => {
  const poisoned = {
    id: 'elk-opfer',
    type: 'battery',
    position: { x: 0, y: 0 },
    data: {},
    width: 120,
    height: 80,
  };

  it('pinnt den Versionsschritt (bewusst hart — Migration alter Stände hängt daran)', () => {
    expect(PLANNER_STORAGE_VERSION).toBe(2);
  });

  it('streicht exakt 120×80 (Elektrik- und Wasser-Knoten)', () => {
    const result = migratePlannerPersisted(
      { nodes: [poisoned], waterNodes: [{ ...poisoned, id: 'w-opfer' }] },
      1
    );
    const node = result.nodes?.[0];
    const water = result.waterNodes?.[0];
    // Regression: Der Layout-Adapter schrieb Engine-Boxen als width/height
    // zurück — vergiftete Pläne blieben (inklusive Reload) dauerhaft winzig.
    expect(node).not.toHaveProperty('width');
    expect(node).not.toHaveProperty('height');
    expect(water).not.toHaveProperty('width');
    expect(water).not.toHaveProperty('height');
    expect(node?.id).toBe('elk-opfer');
  });

  it('lässt echte Maße unangetastet (inklusive Fast-Treffern)', () => {
    const result = migratePlannerPersisted(
      {
        nodes: [
          { ...poisoned, id: 'echt', width: 192, height: 120 },
          { ...poisoned, id: 'fast-breit', width: 120, height: 81 },
          { ...poisoned, id: 'fast-hoch', width: 121, height: 80 },
          { ...poisoned, id: 'ohne', width: undefined, height: undefined },
        ],
      },
      1
    );
    const byId = new Map((result.nodes ?? []).map((n) => [n.id, n]));
    expect(byId.get('echt')).toMatchObject({ width: 192, height: 120 });
    expect(byId.get('fast-breit')).toMatchObject({ width: 120, height: 81 });
    expect(byId.get('fast-hoch')).toMatchObject({ width: 121, height: 80 });
    expect(byId.get('ohne')?.width).toBeUndefined();
    expect(byId.get('ohne')?.height).toBeUndefined();
  });
});
