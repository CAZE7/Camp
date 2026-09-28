import { describe, expect, it } from 'vitest';
import { GOLDEN_PLANS } from '../goldenmaster/plans';
import {
  countDomainConflicts,
  probePlan,
  routingDomainOfEdge,
  type DomainConflictEntry,
} from './domainProbe';
import type { RouteEdgeRef } from '../../components/edges/utils/routeAll';
import type { Segment } from '../../lib/routing/geometry';

/**
 * ROUTE-003 (Domänen-Trennregeln) — die Sonde muss sehen, was sie behauptet.
 *
 * Anlass (2026-09-28): Die Sonde las die Domäne ausschließlich aus
 * `edge.data.edgeDomain` und fiel sonst auf `dc12` zurück. AutoWire-Kanten
 * tragen das Feld nicht — jede 230-V-Leitung ohne Feld galt damit als
 * Gleichstrom, und die Sonde meldete „0 zu nah", obwohl es Stellen unter
 * 24 px gibt. Dieser Test pinnt drei Dinge:
 *
 *   1. die Domänen-Ableitung (Knotentyp + Handle, persistierte Domäne zuerst)
 *      — inklusive des Blindflecks als Regressionsfall,
 *   2. die Zähl-Semantik der Sonde am konstruierten Fall (parallel = zählt,
 *      Kreuzung = zählt nicht, gleiche Domäne = keine Paar-Regel),
 *   3. die gemessenen Zahlen der sechs Referenzpläne als **Ratchet**: sie
 *      dürfen sinken (dann Erwartung nachziehen), niemals steigen.
 */

const hSeg = (y: number, x0 = 0, x1 = 100): Segment => [
  { x: x0, y },
  { x: x1, y },
];
const vSeg = (x: number, y0 = 0, y1 = 100): Segment => [
  { x, y: y0 },
  { x, y: y1 },
];

const entry = (
  id: string,
  domain: DomainConflictEntry['domain'],
  ...segments: Segment[]
): DomainConflictEntry => ({
  id,
  domain,
  segments,
});

describe('routingDomainOfEdge — die eine Domänen-Ableitung', () => {
  const nodes = new Map([
    ['shore', { id: 'shore', type: 'shorePower' }],
    ['inv', { id: 'inv', type: 'inverter' }],
    ['bat', { id: 'bat', type: 'battery' }],
    ['tank', { id: 'tank', type: 'water' }],
  ]);

  it('leitet aus Knotentyp + Handle ab, wenn `data.edgeDomain` fehlt (Blindfleck 2026-09-28)', () => {
    const edge: RouteEdgeRef = {
      id: 'e-shore-inv',
      source: 'shore',
      target: 'inv',
      sourceHandle: 'plus',
      targetHandle: 'ac_in',
    };
    expect(routingDomainOfEdge(edge, nodes)).toBe('ac230');
  });

  it('behält die persistierte Domäne bei — auch `water`, das kein Handle abbildet', () => {
    const edge: RouteEdgeRef = {
      id: 'e-water',
      source: 'tank',
      target: 'bat',
      data: { edgeDomain: 'water' },
    };
    expect(routingDomainOfEdge(edge, nodes)).toBe('water');
  });

  it('unterstellt nichts bei unbekannten Knoten', () => {
    const edge: RouteEdgeRef = { id: 'e-x', source: 'unknown-a', target: 'unknown-b' };
    // `edgeDomainOf` fällt konservativ auf DC_12V — die Sonde meldet dann dc12,
    // nicht `undefined`: dieselbe Basis wie Anzeige und Sizing.
    expect(routingDomainOfEdge(edge, nodes)).toBe('dc12');
  });
});

describe('countDomainConflicts — Zähl-Semantik', () => {
  it('zählt parallele gemischte Segmente unter der Paar-Clearance', () => {
    const result = countDomainConflicts([entry('a', 'ac230', hSeg(100)), entry('b', 'dc12', hSeg(108))]);
    expect(result.mixedPairs).toBe(1);
    expect(result.tooClose).toBe(1);
    expect(result.closest).toEqual({ pair: 'a × b', gap: 8 });
  });

  it('zählt eine Kreuzung als Kreuzung, nicht als zu nah (ADR 0009)', () => {
    // Echte Durchkreuzung (der senkrechte Strang läuft über die Waagerechte
    // hinaus) — ein T-Kontakt wäre dagegen eine Berührung und damit 'weighted'.
    const result = countDomainConflicts([
      entry('a', 'ac230', hSeg(100)),
      entry('b', 'dc12', vSeg(50, 80, 120)),
    ]);
    expect(result.crossing).toBe(1);
    expect(result.tooClose).toBe(0);
  });

  it('zählt eine Berührung (T-Kontakt) als zu nah, nicht als Kreuzung', () => {
    const result = countDomainConflicts([entry('a', 'ac230', hSeg(100)), entry('b', 'dc12', vSeg(50))]);
    expect(result.crossing).toBe(0);
    expect(result.tooClose).toBe(1);
  });

  it('ignoriert gleiche Domänen und Paare ohne Regel (Solar ↔ DC)', () => {
    const same = countDomainConflicts([entry('a', 'dc12', hSeg(100)), entry('b', 'dc12', hSeg(108))]);
    expect(same.mixedPairs).toBe(0);
    const solar = countDomainConflicts([entry('a', 'electrical', hSeg(100)), entry('b', 'dc12', hSeg(108))]);
    expect(solar.mixedPairs).toBe(0); // electrical ↔ dc12 hat keine Paar-Regel
  });

  it('lässt ausreichenden Abstand durch', () => {
    const result = countDomainConflicts([entry('a', 'ac230', hSeg(100)), entry('b', 'dc12', hSeg(130))]);
    expect(result.mixedPairs).toBe(1);
    expect(result.tooClose).toBe(0);
  });
});

describe('domainProbe — Referenzpläne (Ratchet)', () => {
  /**
   * Gemessen 2026-09-28 mit der korrigierten Ableitung. Sinkt eine Zahl,
   * gehört die neue Zahl hierher (Ratchet nach unten); steigt sie, ist das
   * ein Rückschritt in der Domänentrennung — nicht die Erwartung anpassen.
   */
  const RATCHET: Record<string, { mixedPairs: number; crossing: number; tooClose: number }> = {
    simple: { mixedPairs: 0, crossing: 0, tooClose: 0 },
    camper: { mixedPairs: 0, crossing: 0, tooClose: 0 },
    solar: { mixedPairs: 0, crossing: 0, tooClose: 0 },
    inverter: { mixedPairs: 9, crossing: 0, tooClose: 0 },
    acdc: { mixedPairs: 33, crossing: 2, tooClose: 5 },
    complex: { mixedPairs: 38, crossing: 10, tooClose: 18 },
  };

  it.each(Object.keys(GOLDEN_PLANS))('%s', (plan) => {
    const result = probePlan(plan);
    expect(result, `Sonde liefert kein Ergebnis für ${plan}`).not.toBeNull();
    expect({
      mixedPairs: result!.mixedPairs,
      crossing: result!.crossing,
      tooClose: result!.tooClose,
    }).toEqual(RATCHET[plan]);
  });

  it('die Summe über alle Pläne bleibt eingefroren', () => {
    const rows = Object.keys(GOLDEN_PLANS).map(probePlan);
    const sum = (key: 'mixedPairs' | 'crossing' | 'tooClose'): number =>
      rows.reduce((acc, row) => acc + (row?.[key] ?? 0), 0);
    expect([sum('mixedPairs'), sum('crossing'), sum('tooClose')]).toEqual([80, 12, 23]);
  });

  it('benennt das engste Paar der Referenzpläne', () => {
    const closest = Object.keys(GOLDEN_PLANS)
      .map(probePlan)
      .map((row) => row?.closest)
      .filter((c): c is { pair: string; gap: number } => c !== undefined)
      .sort((a, b) => a.gap - b.gap)[0];
    expect(closest).toEqual({ pair: 'e-busbar-fuse × e-shore-inv', gap: 0.8 });
  });
});
