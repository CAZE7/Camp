import { describe, it, expect } from 'vitest';
import { PX_PER_METER, meters } from '../units';
import { DEFAULT_EDGE_LENGTH, MIN_PLANNING_LENGTH, planningLength, type PointOf } from './primitives';

/**
 * `planningLength` ist die eine Regel für „wie lang wird diese Leitung?"
 * (dreißigste Fassung). Sie schätzt, sie erfindet nicht: Ohne eingetragene
 * Länge und ohne Positionen kommt `undefined` zurück, und der Aufrufer
 * entscheidet, welcher Ersatzwert in seinem Zusammenhang richtig ist.
 */
describe('planningLength — die eine Längenregel', () => {
  const at = (positions: Record<string, { x: number; y: number }>): PointOf => {
    return (id) => positions[id];
  };

  it('nimmt die eingetragene Länge, wenn eine da ist', () => {
    const length = planningLength({ source: 'a', target: 'b', data: { length: 2.5 } }, at({}));
    expect(length).toBe(2.5);
  });

  it('nimmt die eingetragene Länge auch als Zahl aus Altdaten (JSON-String)', () => {
    const length = planningLength({ source: 'a', target: 'b', data: { length: '2.5' as never } }, at({}));
    expect(length).toBe(2.5);
  });

  it('schätzt die Luftlinie aus den Knotenpositionen', () => {
    const length = planningLength(
      { source: 'a', target: 'b' },
      at({ a: { x: 0, y: 0 }, b: { x: 300, y: 400 } })
    );
    expect(length).toBeCloseTo(500 / PX_PER_METER, 6); // 3-4-5-Dreieck
  });

  it('hält den Boden ein, wenn zwei Knoten auf derselben Position stehen', () => {
    // Gestapelte Karten und Altdaten ohne Koordinaten ergäben sonst 0 m — und
    // damit rechnerisch keinen Spannungsfall.
    const length = planningLength(
      { source: 'a', target: 'b' },
      at({ a: { x: 100, y: 100 }, b: { x: 100, y: 100 } })
    );
    expect(length).toBe(MIN_PLANNING_LENGTH);
    expect(MIN_PLANNING_LENGTH).toBe(1);
  });

  it('sagt „nicht ableitbar", wenn eine Position fehlt — der Aufrufer entscheidet', () => {
    expect(planningLength({ source: 'a', target: 'b' }, at({ a: { x: 0, y: 0 } }))).toBeUndefined();
    expect(planningLength({ source: 'a', target: 'b' }, at({}))).toBeUndefined();
  });

  it('behandelt eine fehlende y-Koordinate wie 0, statt NaN zu liefern', () => {
    const length = planningLength(
      { source: 'a', target: 'b' },
      at({ a: { x: 0, y: 0 }, b: { x: 250 } as { x: number; y: number } })
    );
    expect(length).toBe(2.5);
  });

  it('lässt den Ersatzwert des Aufrufers unangetastet (hier der Dokumentationswert)', () => {
    // Die Regel selbst kennt keinen Ersatzwert; das ist bewusst, damit
    // Dimensionierung (1 m), AC (2 m) und Anzeige (Route) ihren eigenen
    // begründeten Wert wählen können.
    expect(DEFAULT_EDGE_LENGTH).toBe(meters(1));
  });
});
