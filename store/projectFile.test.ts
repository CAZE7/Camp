import { describe, it, expect } from 'vitest';
import {
  PROJECT_FILE_FORMAT,
  PROJECT_FILE_MAX_BYTES,
  PROJECT_FILE_VERSION,
  parsePlannerProject,
  projectFileName,
  serializePlannerProject,
  type PlannerProjectContent,
} from './projectFile';

/** Kleiner, vollständiger Beispielplan: Batterie → Sicherung → Verbraucher. */
function samplePlan(): PlannerProjectContent {
  return {
    viewMode: 'electric',
    season: 'winter',
    nodes: [
      {
        id: 'battery-1',
        type: 'battery',
        position: { x: 80, y: 160 },
        data: { label: '12V Batterie', capacity: 100, chemistry: 'AGM' },
        // Messwerte der Darstellung — dürfen NICHT in der Datei landen.
        measured: { width: 180, height: 90 },
        width: 180,
        height: 90,
      },
      { id: 'cons-1', type: 'consumer', position: { x: 400, y: 160 }, data: { label: 'Kühlbox', watts: 45 } },
    ],
    edges: [
      {
        id: 'e1',
        source: 'battery-1',
        target: 'cons-1',
        sourceHandle: 'plus',
        targetHandle: 'plus',
        type: 'cableEdge',
        data: { length: 2, crossSection: 4, fuseSize: 10 },
      },
    ],
    waterNodes: [],
    waterEdges: [],
  };
}

/** Ausschnitt der Datei, den die Tests lesen (kein `any`). */
interface TestDocument {
  format: string;
  formatVersion: number;
  savedAt: string;
  plan: {
    viewMode: string;
    season: string;
    nodes: Array<{
      id: string;
      position: unknown;
      data: Record<string, unknown>;
      measured?: unknown;
      width?: unknown;
      height?: unknown;
    }>;
    edges: Array<{ id: string; source: string; target: string; data: Record<string, unknown> }>;
    waterNodes?: unknown[];
    waterEdges?: unknown[];
  };
}

function readDoc(text: string): TestDocument {
  return JSON.parse(text) as TestDocument;
}

function docWith(mutate: (doc: Record<string, unknown>) => void): string {
  const doc = JSON.parse(serializePlannerProject(samplePlan(), '2026-10-12T10:00:00.000Z')) as Record<
    string,
    unknown
  >;
  mutate(doc);
  return JSON.stringify(doc);
}

describe('Projektdatei — Export', () => {
  it('schreibt Format, Version und Zeitstempel', () => {
    const doc = readDoc(serializePlannerProject(samplePlan(), '2026-10-12T10:00:00.000Z'));
    expect(doc.format).toBe(PROJECT_FILE_FORMAT);
    expect(doc.formatVersion).toBe(PROJECT_FILE_VERSION);
    expect(doc.savedAt).toBe('2026-10-12T10:00:00.000Z');
    expect(doc.plan.season).toBe('winter');
  });

  it('entfernt Messwerte der Darstellung (measured/width/height)', () => {
    const doc = readDoc(serializePlannerProject(samplePlan()));
    const battery = doc.plan.nodes[0]!;
    expect(battery).not.toHaveProperty('measured');
    expect(battery).not.toHaveProperty('width');
    expect(battery).not.toHaveProperty('height');
    // Nutzerangaben bleiben erhalten.
    expect(battery.data.capacity).toBe(100);
  });

  it('ist deterministisch: gleicher Plan ⇒ gleiche Bytes', () => {
    const a = serializePlannerProject(samplePlan(), '2026-10-12T10:00:00.000Z');
    const b = serializePlannerProject(samplePlan(), '2026-10-12T10:00:00.000Z');
    expect(a).toBe(b);
  });

  it('erzeugt einen Dateinamen mit Datum', () => {
    expect(projectFileName(new Date('2026-10-12T08:00:00Z'))).toBe('camp-plan-2026-10-12.json');
  });
});

describe('Projektdatei — Round-trip', () => {
  it('erhält die fachlichen Daten exakt (Export → Import → Export)', () => {
    const first = serializePlannerProject(samplePlan(), '2026-10-12T10:00:00.000Z');
    const parsed = parsePlannerProject(first);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.warnings).toEqual([]);
    expect(parsed.plan.season).toBe('winter');
    expect(parsed.plan.nodes.map((n) => n.id)).toEqual(['battery-1', 'cons-1']);
    expect(parsed.plan.edges[0]?.data).toEqual({ length: 2, crossSection: 4, fuseSize: 10 });

    const second = serializePlannerProject(
      { ...parsed.plan, viewMode: parsed.plan.viewMode },
      '2026-10-12T10:00:00.000Z'
    );
    expect(second).toBe(first);
  });
});

describe('Projektdatei — Ablehnung fehlerhafter Dateien', () => {
  it('lehnt kein JSON ab', () => {
    const result = parsePlannerProject('{ kaputt');
    expect(result).toEqual({ ok: false, errors: ['Die Datei ist kein gültiges JSON.'] });
  });

  it('lehnt Fremdformate ab', () => {
    const result = parsePlannerProject(JSON.stringify({ format: 'andere-app', formatVersion: 1, plan: {} }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/keine Projektdatei/);
  });

  it('lehnt eine Datei ohne Versionsangabe ab', () => {
    const result = parsePlannerProject(docWith((doc) => delete doc.formatVersion));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/Dateiversion/);
  });

  it('lehnt eine NEUERE Dateiversion ab, statt sie zu raten', () => {
    const result = parsePlannerProject(docWith((doc) => (doc.formatVersion = PROJECT_FILE_VERSION + 1)));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/neueren Version/);
  });

  it('lehnt nicht ganzzahlige oder nicht-positive Versionen ab', () => {
    expect(parsePlannerProject(docWith((doc) => (doc.formatVersion = 1.5))).ok).toBe(false);
    expect(parsePlannerProject(docWith((doc) => (doc.formatVersion = 0))).ok).toBe(false);
  });

  it('lehnt zu große Dateien ab, bevor sie geparst werden', () => {
    const huge = ' '.repeat(PROJECT_FILE_MAX_BYTES + 1);
    const result = parsePlannerProject(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/groß/);
  });

  it('lehnt ungültige Ansichts- und Jahreszeitwerte ab', () => {
    const badView = parsePlannerProject(
      docWith((doc) => ((doc.plan as Record<string, unknown>).viewMode = 'xray'))
    );
    expect(badView.ok).toBe(false);
    const badSeason = parsePlannerProject(
      docWith((doc) => ((doc.plan as Record<string, unknown>).season = 'spring'))
    );
    expect(badSeason.ok).toBe(false);
  });

  it('lehnt einen Knoten mit ungültiger Position ab (kein NaN-Rendering)', () => {
    const result = parsePlannerProject(
      docWith((doc) => {
        const plan = doc.plan as { nodes: Array<Record<string, unknown>> };
        plan.nodes[1]!.position = { x: 'links', y: 0 };
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/cons-1/);
  });

  it('lehnt doppelte Knoten-IDs ab', () => {
    const result = parsePlannerProject(
      docWith((doc) => {
        const plan = doc.plan as { nodes: Array<Record<string, unknown>> };
        plan.nodes[1]!.id = 'battery-1';
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/mehrfach/);
  });

  it('lehnt Leitungen ab, die auf einen fehlenden Knoten verweisen', () => {
    const result = parsePlannerProject(
      docWith((doc) => {
        const plan = doc.plan as { edges: Array<Record<string, unknown>> };
        plan.edges[0]!.target = 'gibt-es-nicht';
      })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/fehlenden Knoten/);
  });

  it('ist bei Fehlern vollständig ablehnend: kein Teilimport', () => {
    // Ein gültiger Knoten plus ein kaputter ⇒ gesamter Import abgelehnt.
    const result = parsePlannerProject(
      docWith((doc) => {
        const plan = doc.plan as { nodes: unknown[] };
        plan.nodes.push({ id: '', type: 'consumer', position: { x: 0, y: 0 } });
      })
    );
    expect(result.ok).toBe(false);
  });
});

describe('Projektdatei — Bereinigung bekannter Felder', () => {
  it('verwirft Felder mit falschem Typ und meldet sie als Hinweis', () => {
    const result = parsePlannerProject(
      docWith((doc) => {
        const plan = doc.plan as { nodes: Array<{ data: Record<string, unknown> }> };
        plan.nodes[1]!.data.watts = 'viel';
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.nodes[1]?.data).not.toHaveProperty('watts');
    expect(result.warnings.join(' ')).toMatch(/watts/);
  });

  it('akzeptiert Dateien ohne Wasserbereich (ältere Pläne)', () => {
    const result = parsePlannerProject(
      docWith((doc) => {
        delete (doc.plan as Record<string, unknown>).waterNodes;
        delete (doc.plan as Record<string, unknown>).waterEdges;
      })
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.waterNodes).toEqual([]);
  });
});
