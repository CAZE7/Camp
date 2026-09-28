import { describe, expect, it } from 'vitest';
import {
  buildConflictAdjacency,
  conflictComponents,
  conflictPadWide,
  greedyConflictOrder,
  type ConflictCandidate,
} from './conflictGraph';

/**
 * Mission Stufe 3 — Abnahme des Konfliktgraph-Batchings
 * (MULTIPHYSICS §5.2 Stufe 3: „greedy in deterministischer Kantenreihenfolge
 * (Längenrang absteigend, Tie-Break compareIds)“; GPU-ARCH §8: „Ordnungs-
 * disziplin in routeAllCables“).
 *
 * Verträge:
 * 1. Ergebnis ist immer eine Permutation der Eingabe (jede Kante genau einmal).
 * 2. Determinismus (R5): gleiche Eingabe (in beliebiger Reihenfolge) ⇒
 *    gleiche Arbeitsordnung — kanonische Komponenten, compareIds-Tie-Break.
 * 3. Getrennte Komponenten bleiben in globaler ID-Ordnung (Gate-frei =
 *    bisheriges Verhalten für unkorrelierte Kanten).
 * 4. Rule M: doppelte IDs / ungültige Pads werfen.
 */

/** Deterministischer PRNG (mulberry32) — fixer Seed, kein Math.random. */
const mulberry32 = (seed: number) => () => {
  let a = (seed += 0x6d2b79f5);
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
};

const cand = (
  id: string,
  source: string,
  target: string,
  from: { x: number; y: number },
  to: { x: number; y: number }
): ConflictCandidate => ({ id, source, target, from, to });

describe('buildConflictAdjacency', () => {
  it('geteilte Anschlussstelle ⇒ Kante, auch ohne Korridor-Overlap', () => {
    // Beide enden an n1, Korridore strahlen nach hinten weg (kein AABB-Overlap
    // mit pad 0).
    const list = [
      cand('e1', 'n1', 'n2', { x: 0, y: 0 }, { x: 0, y: 200 }),
      cand('e2', 'n1', 'n3', { x: 0, y: 0 }, { x: 200, y: 0 }),
    ];
    const adj = buildConflictAdjacency(list, { pad: 0 });
    expect(adj.get('e1')).toEqual(['e2']);
    expect(adj.get('e2')).toEqual(['e1']);
  });

  it('sich schneidende Korridore (AABB) konkurrieren, entfernte nicht', () => {
    const list = [
      cand('a', 'n1', 'n2', { x: 0, y: 0 }, { x: 100, y: 0 }), // waagerecht
      cand('b', 'n3', 'n4', { x: 50, y: -50 }, { x: 50, y: 50 }), // senkrecht kreuzend
      cand('c', 'n5', 'n6', { x: 0, y: 400 }, { x: 100, y: 400 }), // weit entfernt
    ];
    const adj = buildConflictAdjacency(list, { pad: 0 });
    expect(adj.get('a')).toEqual(['b']);
    expect(adj.get('b')).toEqual(['a']);
    expect(adj.get('c')).toEqual([]);
  });

  it('Pad-Option verschiebt die Schwelle (laneGrid-Default)', () => {
    // 20 px Abstand der Korridore: mit pad 0 getrennt, mit pad 16 konkurrierend.
    const list = [
      cand('a', 'n1', 'n2', { x: 0, y: 0 }, { x: 100, y: 0 }),
      cand('b', 'n3', 'n4', { x: 0, y: 20 }, { x: 100, y: 20 }),
    ];
    expect(buildConflictAdjacency(list, { pad: 0 }).get('a')).toEqual([]);
    expect(buildConflictAdjacency(list).get('a')).toEqual(['b']); // Default laneGrid = 16
    expect(conflictPadWide()).toBe(48); // alternativeRouteGap = 3 × laneGrid
  });

  it('Rule M: doppelte IDs und ungültige Pads werfen', () => {
    const dup = [
      cand('e', 'a', 'b', { x: 0, y: 0 }, { x: 1, y: 0 }),
      cand('e', 'c', 'd', { x: 0, y: 0 }, { x: 1, y: 0 }),
    ];
    expect(() => buildConflictAdjacency(dup)).toThrow(RangeError);
    const one = [cand('e', 'a', 'b', { x: 0, y: 0 }, { x: 1, y: 0 })];
    expect(() => buildConflictAdjacency(one, { pad: -1 })).toThrow(RangeError);
    expect(() => buildConflictAdjacency(one, { pad: Number.NaN })).toThrow(RangeError);
  });
});

describe('conflictComponents — kanonische Komponenten', () => {
  it('gliedert, sortiert Mitglieder und Komponenten deterministisch', () => {
    const list = [
      cand('e9', 'n1', 'n2', { x: 0, y: 0 }, { x: 50, y: 0 }),
      cand('e1', 'n1', 'n3', { x: 0, y: 0 }, { x: 0, y: 50 }), // Konflikt mit e9 (Port n1)
      cand('e5', 'n8', 'n9', { x: 400, y: 400 }, { x: 460, y: 400 }), // Singleton
    ];
    const comps = conflictComponents(list, { pad: 0 });
    expect(comps).toEqual([['e1', 'e9'], ['e5']]);
  });

  it('Eingabe-Reihenfolge ist egal (Permutations-Invarianz, Seed 77)', () => {
    const rnd = mulberry32(77);
    const base: ConflictCandidate[] = [];
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(rnd() * 300);
      const y = Math.floor(rnd() * 300);
      base.push(cand(`e${i}`, `n${Math.floor(i / 2)}`, `n${100 + i}`, { x, y }, { x: x + 40, y: y + 10 }));
    }
    const reference = greedyConflictOrder(base);
    for (let shuffle = 0; shuffle < 10; shuffle++) {
      const mixed = [...base];
      for (let i = mixed.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [mixed[i], mixed[j]] = [mixed[j]!, mixed[i]!];
      }
      expect(greedyConflictOrder(mixed)).toEqual(reference);
    }
  });
});

describe('greedyConflictOrder — §5.2-Stufenregel', () => {
  it('jede Kante genau einmal (Permutation)', () => {
    const list = [
      cand('e1', 'n1', 'n2', { x: 0, y: 0 }, { x: 100, y: 0 }),
      cand('e2', 'n1', 'n3', { x: 0, y: 0 }, { x: 10, y: 0 }),
      cand('e3', 'n7', 'n8', { x: 500, y: 0 }, { x: 520, y: 0 }),
    ];
    const order = greedyConflictOrder(list, { pad: 0 });
    expect([...order].sort()).toEqual(['e1', 'e2', 'e3']);
  });

  it('ohne Konflikte: exakt globale compareIds-Ordnung (Gate-frei = Ist-Verhalten)', () => {
    const list = [
      cand('edge-9', 'n1', 'n2', { x: 0, y: 0 }, { x: 10, y: 0 }),
      cand('edge-10', 'n3', 'n4', { x: 400, y: 0 }, { x: 410, y: 0 }),
      cand('edge-2', 'n5', 'n6', { x: 800, y: 0 }, { x: 810, y: 0 }),
    ];
    expect(greedyConflictOrder(list, { pad: 0 })).toEqual(['edge-10', 'edge-2', 'edge-9']);
  });

  it('innerhalb der Komponente: Längenrang absteigend (Manhattan), Tie-Break compareIds', () => {
    // Gleicher Port n1 ⇒ eine Komponente: e-lang (100) vor e-kurz (30);
    // zwei gleich lange Knoten kollidieren über compareIds.
    const list = [
      cand('b-eq', 'n1', 'nX', { x: 0, y: 0 }, { x: 40, y: 0 }),
      cand('a-eq', 'n1', 'nY', { x: 0, y: 0 }, { x: 40, y: 0 }),
      cand('short', 'n1', 'nZ', { x: 0, y: 0 }, { x: 30, y: 0 }),
      cand('long', 'n1', 'nW', { x: 0, y: 0 }, { x: 100, y: 0 }),
    ];
    expect(greedyConflictOrder(list, { pad: 0 })).toEqual(['long', 'a-eq', 'b-eq', 'short']);
  });

  it('Determinismus (R5): zwei Läufe bitidentisch, auch über Komponenten hinweg', () => {
    const rnd = mulberry32(20260928);
    const list: ConflictCandidate[] = [];
    for (let i = 0; i < 60; i++) {
      const x = Math.floor(rnd() * 500);
      const y = Math.floor(rnd() * 500);
      list.push(cand(`e${i}`, `n${Math.floor(rnd() * 8)}`, `n${200 + i}`, { x, y }, { x: x + 25, y: y + 5 }));
    }
    expect(greedyConflictOrder(list)).toEqual(greedyConflictOrder([...list].reverse()));
  });

  it('leere Eingabe ⇒ leere Ordnung', () => {
    expect(greedyConflictOrder([])).toEqual([]);
    expect(conflictComponents([])).toEqual([]);
  });
});
