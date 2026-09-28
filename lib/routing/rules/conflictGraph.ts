/**
 * Mission Stufe 3 — Konfliktgraph-Batching der Arbeitsreihenfolge.
 *
 * Belege:
 * - `docs/ROUTING-MULTIPHYSICS.md` §5.2 Stufe 3: Zuweisung als
 *   „greedy in deterministischer Kantenreihenfolge (Längenrang absteigend,
 *   Tie-Break `compareIds`)".
 * - `docs/ai/GPU-ROUTING-ARCH.md` §8: „Konfliktgraph-Batching — Ja —
 *   Ordnungsdisziplin in `routeAllCables`, weniger Nudge-Reflow".
 *
 * Die GEOMETRIE-Quelle bleibt der Produktivpfad: Dieses Modul ordnet nur
 * die REIHENFOLGE, in der `routeAllCables` seine Kanten verlegt — Routen,
 * Lanes und Tubes entstehen unverändert in `pathfinding.ts`.
 *
 * Warum Batching und nicht globaler Längenrang: Global „lange zuerst“ war
 * GEMESSEN schlecht (routeAll.ts, Kommentar 2026-09-09: Kreuzungen 42 → 58,
 * complex 28 → 41, +2 I6, +3 I7). Der Graph lokalisiert die Reihenfolge auf
 * Gruppen, die sich den Raum tatsächlich teilen; Kanten in getrennten
 * Komponenten behalten die bisherige Ordnung (kleinste Mitglieds-ID).
 *
 * Gate: `ROUTING_GATES.conflictGraphBatching` (Standard 0 = exakt die
 * bisherige `compareIds`-Reihenfolge — Golden Master byte-stabil).
 */

import { compareIds } from '../../sortOrder';
import { alternativeRouteGap, ROUTING_TOKENS, type RoutingTokens } from '../tokens';

/** Minimale Punktangabe (X/Y in px) — strukturell kompatibel zu allen `Point`-Typen. */
export type XY = { readonly x: number; readonly y: number };

export type ConflictCandidate = {
  /** Kanten-ID (eindeutig — doppelte IDs wirfen, Rule M). */
  readonly id: string;
  /** Knoten-ID der Quelle (Port-Bündel-Kontenzen: gleicher Knoten ⇒ Konflikt). */
  readonly source: string;
  /** Knoten-ID des Ziels. */
  readonly target: string;
  /** aufgelöster Quell-Port. */
  readonly from: XY;
  /** aufgelöster Ziel-Port. */
  readonly to: XY;
};

export type ConflictGraphOptions = {
  /**
   * Pad je Korridor-Achse (px). Zwei Korridore konkurrieren, wenn ihre
   * aufgeblähten AABBs sich schneiden ODER sie eine Anschlussstelle teilen.
   * Default `laneGrid` (16 px): eine Lanenbreite — Kanten, deren direkte
   * Korridore näher als eine Lane liegen, können dieselben Lanes wollen.
   */
  readonly pad?: number;
  readonly tokens?: RoutingTokens;
};

type Box = { minX: number; minY: number; maxX: number; maxY: number };

const requirePad = (pad: number): number => {
  if (!Number.isFinite(pad) || pad < 0) {
    throw new RangeError(`conflictGraph: Pad endlich und ≥ 0 erwartet, bekam ${pad}`);
  }
  return pad;
};

const corridorBox = (c: ConflictCandidate, pad: number): Box => ({
  minX: Math.min(c.from.x, c.to.x) - pad,
  minY: Math.min(c.from.y, c.to.y) - pad,
  maxX: Math.max(c.from.x, c.to.x) + pad,
  maxY: Math.max(c.from.y, c.to.y) + pad,
});

const boxesIntersect = (a: Box, b: Box): boolean =>
  a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;

/**
 * Adjazenz des Konfliktgraphen: Kante (e, f) ⇔ geteilte Anschlussstelle
 * (gleicher Knoten) ODER sich schneidende aufgeblähte Korridor-AABBs.
 * Nachbarn je Knoten aufsteigend nach `compareIds` (R5: stabile Reihenfolge).
 */
export function buildConflictAdjacency(
  candidates: readonly ConflictCandidate[],
  options?: ConflictGraphOptions
): Map<string, string[]> {
  const tokens = options?.tokens ?? ROUTING_TOKENS;
  const pad = requirePad(options?.pad ?? tokens.laneGrid);
  const ids = new Set<string>();
  for (const c of candidates) {
    if (ids.has(c.id)) throw new RangeError(`conflictGraph: doppelte Kanten-ID "${c.id}"`);
    ids.add(c.id);
  }
  const adjacency = new Map<string, string[]>();
  for (const c of candidates) adjacency.set(c.id, []);
  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i]!;
    const boxA = corridorBox(a, pad);
    for (let j = i + 1; j < candidates.length; j++) {
      const b = candidates[j]!;
      const sharedEndpoint =
        a.source === b.source || a.source === b.target || a.target === b.source || a.target === b.target;
      if (!sharedEndpoint && !boxesIntersect(boxA, corridorBox(b, pad))) continue;
      adjacency.get(a.id)!.push(b.id);
      adjacency.get(b.id)!.push(a.id);
    }
  }
  for (const list of adjacency.values()) list.sort(compareIds);
  return adjacency;
}

/**
 * Zusammenhangskomponenten des Konfliktgraphen — kanonisch: Mitglieder
 * aufsteigend nach `compareIds`, Komponenten aufsteigend nach ihrem ersten
 * Mitglied. Singleton-Komponenten sind erlaubt (Kanten ohne Konflikt).
 */
export function conflictComponents(
  candidates: readonly ConflictCandidate[],
  options?: ConflictGraphOptions
): string[][] {
  const adjacency = buildConflictAdjacency(candidates, options);
  const visited = new Set<string>();
  const components: string[][] = [];
  const canonical = candidates.map((c) => c.id).sort(compareIds);
  for (const id of canonical) {
    if (visited.has(id)) continue;
    const member: string[] = [];
    const stack = [id];
    visited.add(id);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      member.push(cur);
      for (const next of adjacency.get(cur) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        stack.push(next);
      }
    }
    member.sort(compareIds);
    components.push(member);
  }
  components.sort((a, b) => compareIds(a[0]!, b[0]!));
  return components;
}

/**
 * Greedy-Arbeitsreihenfolge (§5.2 Stufe 3):
 *
 * 1. Komponenten in kanonischer Ordnung (kleinste Mitglieds-ID zuerst) —
 *    Kanten in getrennten Komponenten bleiben zueinander in der bisherigen
 *    Ordnung, solange die Komponenten-Schlüssel das erlauben.
 * 2. Innerhalb einer Komponente: Längenrang absteigend (Manhattan der
 *    Anschlüsse), Tie-Break `compareIds`.
 *
 * Ergebnis ist eine Permutation der Eingabe (jede Kante genau einmal).
 */
export function greedyConflictOrder(
  candidates: readonly ConflictCandidate[],
  options?: ConflictGraphOptions
): string[] {
  const lengthById = new Map<string, number>();
  for (const c of candidates) lengthById.set(c.id, manhattan(c.from, c.to));
  const ordered: string[] = [];
  for (const component of conflictComponents(candidates, options)) {
    const ranked = [...component].sort((a, b) => lengthById.get(b)! - lengthById.get(a)! || compareIds(a, b));
    ordered.push(...ranked);
  }
  return ordered;
}

/** Manhattan-Länge der Anschlüsse (px) — derselbe Maßstab wie R-1. */
export const manhattan = (a: XY, b: XY): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/**
 * Alternative Fall-back-Korridorweite als Korridor-Schwelle (±48 px) —
 * Angebot als `pad`-Kandidat für Messungen (Probe), Default bleibt
 * `laneGrid`.
 */
export const conflictPadWide = (tokens: RoutingTokens = ROUTING_TOKENS): number =>
  alternativeRouteGap(tokens);
