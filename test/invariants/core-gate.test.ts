import { describe, expect, it } from 'vitest';
import type { CoreInput, CoreNode } from '../../docs/research/routing-core/kernel';
import { publishableRoutes, routeAndValidate } from '../../scripts/verification/routing/coreGate';

/**
 * `core-gate.test.ts` — die Freigabekette des Kerns.
 *
 * Warum diese Tests so aussehen
 * =============================
 * Ein Gate, das nie `FAIL` sagt, ist keine Prüfung, sondern eine Zeremonie. Die
 * Tests hier prüfen deshalb **beide** Richtungen:
 *
 *  · Ein gültiger Plan kommt durch und liefert veröffentlichbare Routen.
 *  · Ein Plan, den der Kern (noch) nicht sauber löst, kommt **nicht** durch —
 *    und liefert dann auch keine Routen. Nicht „wenige", nicht „die guten":
 *    keine.
 *
 * Die Pläne sind absichtlich winzig. Der Kern ist auf dichten Plänen langsam
 * (das ist ein offener Punkt, §21), und ein Gate-Test, der 40 s läuft, wird
 * abgeschaltet.
 */

const node = (id: string, x: number, y: number, handles: CoreNode['handles']): CoreNode => ({
  id,
  rect: { x, y, width: 120, height: 80 },
  handles,
});

/** Zwei Bauteile nebeneinander, ein Kabel: der einfachste gültige Fall. */
const twoNodePlan = (): CoreInput => ({
  nodes: [
    node('a', 0, 0, [{ id: 'out', x: 120, y: 40, side: 'right' }]),
    node('b', 400, 0, [{ id: 'in', x: 400, y: 40, side: 'left' }]),
  ],
  edges: [{ id: 'e1', source: 'a', sourceHandle: 'out', target: 'b', targetHandle: 'in' }],
});

describe('Freigabekette: gültiger Plan', () => {
  it('gibt PASS und veröffentlichbare Routen', () => {
    const verdict = routeAndValidate(twoNodePlan());
    expect(verdict.reasons).toEqual([]);
    expect(verdict.status).toBe('PASS');
    expect(verdict.publishable).not.toBeNull();
    expect(verdict.publishable?.size).toBe(1);
  });

  it('die Route verbindet beide Anschlüsse exakt', () => {
    const verdict = routeAndValidate(twoNodePlan());
    const waypoints = verdict.publishable?.get('e1');
    expect(waypoints?.[0]).toEqual({ x: 120, y: 40 });
    expect(waypoints?.[waypoints.length - 1]).toEqual({ x: 400, y: 40 });
  });

  it('`publishableRoutes` ist der kurze Weg zu denselben Routen', () => {
    const routes = publishableRoutes(twoNodePlan());
    expect(routes?.size).toBe(1);
  });
});

describe('Freigabekette: ungültiges oder unvollständiges Ergebnis', () => {
  /**
   * Ein Anschluss, der nicht existiert: der Kern meldet die Kante als
   * unroutable **mit Grund**. Das Gate muss daraus `FAIL` machen — und darf
   * nicht etwa die andere Kante veröffentlichen.
   */
  const missingHandlePlan = (): CoreInput => ({
    nodes: [
      node('a', 0, 0, [{ id: 'out', x: 120, y: 40, side: 'right' }]),
      node('b', 400, 0, [{ id: 'in', x: 400, y: 40, side: 'left' }]),
    ],
    edges: [
      { id: 'e1', source: 'a', sourceHandle: 'out', target: 'b', targetHandle: 'in' },
      { id: 'e2', source: 'a', sourceHandle: 'gibtsnicht', target: 'b', targetHandle: 'in' },
    ],
  });

  it('FAILt bei unvollständiger Lösung und veröffentlicht nichts', () => {
    const verdict = routeAndValidate(missingHandlePlan());
    expect(verdict.status).toBe('FAIL');
    expect(verdict.publishable).toBeNull();
    expect(publishableRoutes(missingHandlePlan())).toBeNull();
    expect(verdict.reasons.some((reason) => reason.includes('unvollständig'))).toBe(true);
  });

  it('nennt die fehlende Kante und ihren Grund', () => {
    const verdict = routeAndValidate(missingHandlePlan());
    expect(verdict.result.unroutable.map((entry) => entry.id)).toContain('e2');
    const reason = verdict.result.unroutable.find((entry) => entry.id === 'e2')?.reason ?? '';
    expect(reason.length).toBeGreaterThan(0);
    // Ein Grund, kein Platzhalter: er nennt den Anschluss.
    expect(reason).toContain('gibtsnicht');
  });

  it('jedes FAIL trägt mindestens einen Klartext-Grund', () => {
    const verdict = routeAndValidate(missingHandlePlan());
    expect(verdict.reasons.length).toBeGreaterThan(0);
    for (const reason of verdict.reasons) expect(reason.trim().length).toBeGreaterThan(0);
  });
});

describe('Freigabekette: gesperrte Leitungen', () => {
  const lockedPlan = (): CoreInput => ({
    nodes: [
      node('a', 0, 0, [{ id: 'out', x: 120, y: 40, side: 'right' }]),
      node('b', 400, 0, [{ id: 'in', x: 400, y: 40, side: 'left' }]),
    ],
    edges: [
      {
        id: 'e1',
        source: 'a',
        sourceHandle: 'out',
        target: 'b',
        targetHandle: 'in',
        locked: true,
        lockedWaypoints: [
          { x: 120, y: 40 },
          { x: 144, y: 40 },
          { x: 144, y: 100 },
          { x: 400, y: 100 },
          { x: 400, y: 40 },
        ],
      },
    ],
  });

  it('übernimmt eine gesperrte Route bitgenau', () => {
    const verdict = routeAndValidate(lockedPlan());
    const waypoints = verdict.result.routes.get('e1')?.waypoints ?? [];
    const expected = lockedPlan().edges[0]?.lockedWaypoints ?? [];
    expect(waypoints).toHaveLength(expected.length);
    waypoints.forEach((point, i) => {
      expect(point.x).toBe(expected[i]?.x);
      expect(point.y).toBe(expected[i]?.y);
    });
  });
});

describe('Freigabekette: Determinismus', () => {
  it('zwei Läufe liefern dieselben Routen und dasselbe Urteil', () => {
    const first = routeAndValidate(twoNodePlan());
    const second = routeAndValidate(twoNodePlan());
    expect(second.status).toBe(first.status);
    expect([...(second.publishable?.get('e1') ?? [])]).toEqual([...(first.publishable?.get('e1') ?? [])]);
  });
});
