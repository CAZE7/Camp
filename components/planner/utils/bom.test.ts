import { describe, it, expect } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import type { CableEdgeData } from '../../edges/CableEdge';
import {
  BOM_CSV_HEADER,
  bomToCsv,
  bomToJson,
  bomToPlainText,
  buildBom,
  csvCell,
  edgeLengthOf,
  lengthsDiverge,
  FALLBACK_CABLE_METERS,
} from './bom';
import { PX_PER_METER } from '../../../lib/units';

const battery: Node = { id: 'b1', type: 'battery', position: { x: 0, y: 0 }, data: { label: 'Batterie' } };
const consumer: Node = {
  id: 'c1',
  type: 'consumer',
  position: { x: 400, y: 0 },
  data: { label: 'Kühlbox', watts: 45 },
};

function cable(id: string, data: Partial<CableEdgeData>): Edge<CableEdgeData> {
  return {
    id,
    source: 'b1',
    target: 'c1',
    sourceHandle: 'plus',
    targetHandle: 'plus',
    type: 'cableEdge',
    data: { edgeDomain: 'DC_12V', ...data } as CableEdgeData,
  } as Edge<CableEdgeData>;
}

const noRoute = () => undefined;

describe('edgeLengthOf — Quelle jeder Länge ist benennbar', () => {
  it('Nutzereintrag schlägt den gerouteten Zeichenweg (Nachtest Bug 7: 6,4 m zwischen Nachbarn)', () => {
    const length = edgeLengthOf(38.1 * PX_PER_METER, 22.1, 1);
    expect(length.meters).toBe(22.1);
    expect(length.source).toBe('stored');
    // Beide Quellen bleiben benennbar, die Abweichung wird gemeldet.
    expect(length.storedM).toBe(22.1);
    expect(length.routedM).toBeCloseTo(38.1, 6);
    expect(lengthsDiverge(length)).toBe(true);
  });

  it('bei einer Planungsannahme bleibt die konservative größere Länge', () => {
    const length = edgeLengthOf(38.1 * PX_PER_METER, 22.1, 1, true);
    expect(length.meters).toBeCloseTo(38.1, 6);
    expect(length.source).toBe('routed');
  });

  it('markiert eine fehlende Länge ausdrücklich als Platzhalter', () => {
    const length = edgeLengthOf(undefined, undefined, FALLBACK_CABLE_METERS);
    expect(length).toEqual({ meters: FALLBACK_CABLE_METERS, source: 'fallback' });
  });

  it('ignoriert ungültige eingetragene Längen (negativ, NaN, Text)', () => {
    expect(edgeLengthOf(undefined, -3, 1).source).toBe('fallback');
    expect(edgeLengthOf(undefined, Number.NaN, 1).source).toBe('fallback');
    expect(edgeLengthOf(undefined, '2 m', 1).source).toBe('fallback');
  });

  it('Planungsannahme bleibt als Annahme sichtbar', () => {
    expect(edgeLengthOf(undefined, 3, 1, true).source).toBe('assumed');
  });

  it('Abweichung unter 10 % ist kein Widerspruch', () => {
    expect(lengthsDiverge(edgeLengthOf(22.5 * PX_PER_METER, 22.1, 1))).toBe(false);
    expect(lengthsDiverge(edgeLengthOf(38.1 * PX_PER_METER, 22.1, 1))).toBe(true);
  });
});

describe('buildBom — deterministisch über einen Planstand', () => {
  const input = {
    nodes: [battery, consumer],
    edges: [cable('e1', { length: 2, crossSection: 4 })],
    waterNodes: [] as Node[],
    waterEdges: [] as Edge[],
  };

  it('zählt Bauteile und summiert Leitungen je Querschnitt', () => {
    const bom = buildBom(input, noRoute);
    expect(bom.counts).toEqual({ battery: 1, consumer: 1 });
    expect(bom.cableLengths).toEqual({ '4': 2 });
    expect(bom.lengthAssumptions).toEqual([]);
  });

  it('liefert identische Ergebnisse bei wiederholter Berechnung (Idempotenz)', () => {
    const first = buildBom(input, noRoute);
    const second = buildBom(input, noRoute);
    const third = buildBom(input, noRoute);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(bomToJson(second)).toBe(bomToJson(first));
  });

  it('führt eine fehlende Länge als Annahme auf', () => {
    const bom = buildBom({ ...input, edges: [cable('e1', { crossSection: 4 })] }, noRoute);
    expect(bom.lengthAssumptions).toHaveLength(1);
    expect(bom.lengthAssumptions[0]).toMatchObject({ label: 'Batterie → Kühlbox', source: 'fallback' });
  });

  it('verändert den Planstand nicht (keine Mutation der Eingabe)', () => {
    const snapshot = JSON.stringify(input);
    buildBom(input, noRoute);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('übernimmt die Routenlänge aus der injizierten Quelle, wenn keine Länge eingetragen ist', () => {
    const bom = buildBom({ ...input, edges: [cable('e1', { crossSection: 4 })] }, (id) =>
      id === 'e1' ? { length: 30 * PX_PER_METER } : undefined
    );
    expect(bom.cableLengths['4']).toBeCloseTo(30, 6);
  });

  it('eine eingetragene Länge schlägt den gerouteten Zeichenweg (Nachtest Bug 7)', () => {
    const bom = buildBom({ ...input, edges: [cable('e1', { length: 2, crossSection: 4 })] }, (id) =>
      id === 'e1' ? { length: 30 * PX_PER_METER } : undefined
    );
    expect(bom.cableLengths['4']).toBe(2);
    // Der Widerspruch bleibt als Längenhinweis sichtbar.
    expect(bom.lengthAssumptions).toHaveLength(1);
    expect(bom.lengthAssumptions[0]).toMatchObject({ source: 'stored', storedM: 2 });
  });

  it('leerer Plan ergibt eine leere Stückliste', () => {
    const bom = buildBom({ nodes: [], edges: [], waterNodes: [], waterEdges: [] }, noRoute);
    expect(bom).toEqual({ counts: {}, cableLengths: {}, pipeLengths: {}, lengthAssumptions: [] });
  });

  it('M5 & M10: sortiert Querschnitte aufsteigend, führt Sicherungen/Kabelschuhe/Hauptschalter und unterscheidet Sammelschienen-Rückweg vs. Karosseriemasse', () => {
    const busbarPlan = buildBom(
      {
        nodes: [
          battery,
          { id: 'shunt-1', type: 'shunt', position: { x: 100, y: 100 }, data: { label: 'Shunt' } },
          {
            id: 'fb',
            type: 'fuse',
            position: { x: 200, y: 0 },
            data: { label: 'Sicherungskasten', rating: 60 },
          },
          {
            id: 'f-main',
            type: 'fuse',
            position: { x: 100, y: 0 },
            data: { label: 'Hauptsicherung 150A', rating: 150, fuseType: 'ul248-classT' },
          },
          consumer,
        ],
        edges: [
          cable('e-main', { length: 0.2, crossSection: 35 }),
          {
            ...cable('e-branch', { length: 3, crossSection: 1.5, fuseSize: 10, fuseType: 'ato' }),
            source: 'fb',
            target: 'c1',
          },
        ],
        waterNodes: [],
        waterEdges: [],
      },
      noRoute
    );
    const parsed = JSON.parse(bomToJson(busbarPlan)) as {
      cables: Array<{ crossSection: number; length: number; modeledLength?: number; returnLength?: number }>;
    };
    expect(parsed.cables.map((c) => c.crossSection)).toEqual([1.5, 35]);
    // 1.5 mm²: 3 m Plus + 3 m Minus-Rückleitung wegen Shunt/Sammelschienen-Rückführung:
    expect(parsed.cables[0]).toMatchObject({
      crossSection: 1.5,
      length: 6,
      modeledLength: 3,
      returnLength: 3,
    });
    expect(busbarPlan.fuses?.some((f) => f.ratingA === 150)).toBe(true);
    expect(busbarPlan.fuses?.some((f) => f.ratingA === 10)).toBe(true);
    expect(busbarPlan.cableLugs?.length).toBeGreaterThan(0);
    expect(busbarPlan.recommendedItems?.some((r) => r.id === 'main-disconnect-switch')).toBe(true);

    // Karosseriemasse ohne Minus-Sammelschiene / Shunt: KEIN blindes ×2!
    const chassisPlan = buildBom(
      {
        nodes: [
          battery,
          { id: 'gnd', type: 'ground', position: { x: 0, y: 200 }, data: { label: 'Massepunkt' } },
          consumer,
        ],
        edges: [cable('e1', { length: 4, crossSection: 2.5, fuseSize: 10, fuseType: 'ato' })],
        waterNodes: [],
        waterEdges: [],
      },
      noRoute
    );
    expect(chassisPlan.cableLengths['2.5']).toBe(4);
    expect(chassisPlan.dcReturnLengths).toBeUndefined();
    expect(chassisPlan.chassisGroundReturnCount).toBe(1);
  });
});

describe('CSV-Export', () => {
  it('schützt Zellen vor Formelinjektion', () => {
    expect(csvCell('=HYPERLINK("x")')).toMatch(/^"?'=/);
    expect(csvCell('+49')).toBe("'+49");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@SUM')).toBe("'@SUM");
  });

  it('quotet Semikolons, Anführungszeichen und Zeilenumbrüche', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('sagt "hallo"')).toBe('"sagt ""hallo"""');
    expect(csvCell('Zeile\nZwei')).toBe('"Zeile\nZwei"');
  });

  it('jede Datenzeile hat genau so viele Spalten wie der Kopf', () => {
    const bom = buildBom(
      {
        nodes: [battery, consumer],
        edges: [cable('e1', { crossSection: 4 })], // ohne Länge ⇒ Längenhinweis
        waterNodes: [],
        waterEdges: [],
      },
      noRoute
    );
    const csv = bomToCsv(bom, { planFingerprint: 'abc123', documentStatus: 'Entwurf' });
    const lines = csv
      .replace(/^\uFEFF/, '')
      .trimEnd()
      .split('\r\n');
    expect(lines[0]).toBe(BOM_CSV_HEADER.join(';'));
    expect(lines.length).toBeGreaterThan(2);
    for (const line of lines) {
      // Einfache Zählung reicht hier: Testdaten enthalten keine Semikolons in Feldern.
      expect(line.split(';')).toHaveLength(BOM_CSV_HEADER.length);
    }
  });

  it('trägt Planstand und Dokumentstatus in jeder Zeile', () => {
    const bom = buildBom({ nodes: [battery], edges: [], waterNodes: [], waterEdges: [] }, noRoute);
    const csv = bomToCsv(bom, { planFingerprint: 'fp-42', documentStatus: 'Entwurf' });
    const rows = csv.split('\r\n').slice(1).filter(Boolean);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.endsWith(';fp-42;Entwurf')).toBe(true);
  });

  it('beginnt mit UTF-8-BOM, damit Excel die Umlaute richtig liest', () => {
    const bom = buildBom({ nodes: [], edges: [], waterNodes: [], waterEdges: [] }, noRoute);
    const csv = bomToCsv(bom, { planFingerprint: 'x', documentStatus: 'Entwurf' });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('M15: schreibt deutsches Dezimalkomma und gefüllte Menge bei Leitungen', () => {
    const bom = buildBom(
      {
        nodes: [battery, consumer],
        edges: [cable('e1', { crossSection: 1.5, length: 10 })],
        waterNodes: [],
        waterEdges: [],
      },
      noRoute
    );
    const csv = bomToCsv(bom, { planFingerprint: 'fp-15', documentStatus: 'Entwurf' });
    const leitungLine = csv.split('\r\n').find((line) => line.startsWith('Leitung;'));
    expect(leitungLine).toBeDefined();
    const cols = leitungLine!.split(';');
    expect(cols[2]).toBe('10,0');
    expect(cols[4]).toBe('1,5');
    expect(cols[5]).toBe('10,0');
  });

  it('N17 + N14: trennt Starter- und Aufbaubatterie und erzeugt deutschen Einkaufstext statt JSON', () => {
    const starter: Node = {
      id: 'starter-battery-1',
      type: 'battery',
      position: { x: 0, y: 0 },
      data: { label: 'Starterbatterie', role: 'starter', capacity: 90, chemistry: 'AGM' },
    };
    const house: Node = {
      id: 'battery-1',
      type: 'battery',
      position: { x: 200, y: 0 },
      data: { label: 'Aufbaubatterie', role: 'house', capacity: 100, chemistry: 'LiFePO4' },
    };
    const bom = buildBom(
      {
        nodes: [starter, house, consumer],
        edges: [cable('e1', { crossSection: 2.5, length: 4.5 })],
        waterNodes: [],
        waterEdges: [],
      },
      noRoute
    );
    const labels = (bom.componentItems ?? []).map((item) => item.label);
    expect(labels).toContain('Starterbatterie (90 Ah AGM)');
    expect(labels).toContain('Aufbaubatterie (100 Ah LiFePO4)');

    const text = bomToPlainText(bom);
    expect(text).toContain('Stückliste aus dem Camper-Elektroplaner');
    expect(text).toContain('1 × Starterbatterie (90 Ah AGM)');
    expect(text).toContain('1 × Aufbaubatterie (100 Ah LiFePO4)');
    expect(text).toContain('2,5 mm²');
    expect(text).not.toContain('```json');
    expect(text).not.toContain('"cableLengths"');
  });
});
