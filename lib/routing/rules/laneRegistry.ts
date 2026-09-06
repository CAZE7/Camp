import { laneOffset, type Segment } from '../geometry';
import { ROUTING_TOKENS, type RoutingTokens } from '../tokens';

/**
 * WP-5 (#394): Deterministisches Lane-System — LaneRegistry (Schicht 2).
 *
 * Ersetzt die ±40/±80-px-Ausweich-Heuristik (heute ±48/±96 als
 * `ALTERNATIVE_ROUTE_GAP`) als Mechanik der Lane-Vergabe: Statt dass jeder
 * Router Quer-Versätze selbst „würfelt", vergibt die Registry stabile
 * Lane-Indizes je Korridor; der Versatz ist immer `laneIndex × laneGrid`
 * (Geometrie-Primitive aus WP-2).
 *
 * Stabile Sortierung in 3 Stufen (ROUTING-V2.md §7):
 *   1. topologische Reihenfolge
 *   2. Zielposition (Quer-Koordinate des Gegenübers)
 *   3. stabile Edge-ID als letzter Tie-Breaker
 *
 * Garantie (testgesichert): Re-Layout, Undo/Redo und permutierte
 * Eingabereihenfolgen erzeugen IDENTISCHE Lane-Zuordnungen — keine
 * Lane-Flips (ADR 0010).
 *
 * Einbau-Reihenfolge: Die Router-Konsumenten wechseln in WP-6
 * (A*-Kostenmodell: „preferred lane") und WP-8 (gescopedes Nudging) auf
 * die Registry — hier bewusst noch kein Eingriff in den Bestandsrouter,
 * damit der Golden Master byte-identisch bleibt (Freeze-Disziplin;
 * bewusste Verbesserungen kommen mit eigener Begründung).
 */

/** Hauptrichtung eines Korridors. */
export type CorridorDirection = 'horizontal' | 'vertical';

/** Gemeinsamer Referenzverlauf mehrerer paralleler Trassen. */
export type Corridor = {
  /** Stabiler Schlüssel (Achse + gerasterte Referenzkoordinate + Spanne). */
  key: string;
  direction: CorridorDirection;
  /** Referenzkoordinate (y bei horizontal, x bei vertikal), aufs Grid gerastet. */
  coord: number;
  /** Überdeckte Spanne entlang der Achse. */
  from: number;
  to: number;
};

/** Anmeldung einer Kante an einem Korridor. */
export type LaneRequest = {
  edgeId: string;
  /**
   * Topologische Reihenfolge (Sortierstufe 1) — z. B. Layer-Index aus dem
   * ELK-Ergebnis oder Fluss-Rang (Quelle → Verbraucher). Kanten ohne
   * Topologie-Wissen melden 0 und werden über Stufe 2/3 geordnet.
   */
  topoOrder: number;
  /**
   * Zielposition (Sortierstufe 2): Quer-Koordinate des Gegenübers —
   * wer weiter oben/links ankommt, liegt auch im Korridor oben/links
   * (konsistent mit dem Port-Fan-Out, WP-9).
   */
  targetPosition: number;
};

export type LaneAssignment = {
  edgeId: string;
  corridor: Corridor;
  /** Stabiler Index, symmetrisch um 0 (…, −1, −0.5 … +0.5, +1, …). */
  laneIndex: number;
  /** laneIndex × laneGrid (WP-2-Primitive). */
  offset: number;
};

/** Vergleich der 3-Stufen-Sortierung — exportiert für WP-6/WP-9-Konsumenten. */
export function compareLaneRequests(a: LaneRequest, b: LaneRequest): number {
  if (a.topoOrder !== b.topoOrder) return a.topoOrder - b.topoOrder;
  if (a.targetPosition !== b.targetPosition) return a.targetPosition - b.targetPosition;
  return a.edgeId < b.edgeId ? -1 : a.edgeId > b.edgeId ? 1 : 0;
}

/**
 * Symmetrische Lane-Indizes um die Referenzlinie: Bündel bleiben zentriert
 * (identisches Raster wie die bestehenden Bündel-Lanes ±0,5/±1,5 …).
 */
export function symmetricLaneIndex(position: number, count: number): number {
  return position - (count - 1) / 2;
}

export class LaneRegistry {
  private readonly corridors = new Map<string, { corridor: Corridor; requests: LaneRequest[] }>();
  private readonly tokens: RoutingTokens;

  constructor(tokens: RoutingTokens = ROUTING_TOKENS) {
    this.tokens = tokens;
  }

  /**
   * Korridor-Schlüssel: Achse + Referenzkoordinate, aufs halbe laneGrid
   * gerastet (dasselbe Halbton-Raster wie `alignSharedCorridors`), plus
   * gerasterte Spanne — zwei disjunkte Abschnitte derselben Flucht bleiben
   * getrennte Korridore.
   */
  corridorFor(direction: CorridorDirection, coord: number, from: number, to: number): Corridor {
    const grid = this.tokens.laneGrid / 2;
    const snapped = Math.round(coord / grid) * grid;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    const key = `${direction}:${snapped}:${Math.floor(lo / this.tokens.laneGrid)}:${Math.ceil(
      hi / this.tokens.laneGrid
    )}`;
    return { key, direction, coord: snapped, from: lo, to: hi };
  }

  /** Korridor aus einem achsenparallelen Referenzsegment ableiten. */
  corridorForSegment(segment: Segment): Corridor | null {
    const [a, b] = segment;
    if (Math.abs(a.y - b.y) < Math.abs(a.x - b.x)) {
      return this.corridorFor('horizontal', a.y, a.x, b.x);
    }
    if (Math.abs(a.x - b.x) < Math.abs(a.y - b.y)) {
      return this.corridorFor('vertical', a.x, a.y, b.y);
    }
    return null; // Punkt oder exakte Diagonale — kein Korridor.
  }

  /** Kante an einem Korridor anmelden (idempotent je Edge-ID). */
  register(corridor: Corridor, request: LaneRequest): void {
    let entry = this.corridors.get(corridor.key);
    if (!entry) {
      entry = { corridor, requests: [] };
      this.corridors.set(corridor.key, entry);
    }
    const existing = entry.requests.findIndex((r) => r.edgeId === request.edgeId);
    if (existing >= 0) entry.requests[existing] = request;
    else entry.requests.push(request);
  }

  /**
   * Lane-Zuordnung aller Korridore — unabhängig von Anmelde-Reihenfolge:
   * Korridore nach Schlüssel, Kanten per 3-Stufen-Sortierung.
   */
  assign(): Map<string, LaneAssignment[]> {
    const out = new Map<string, LaneAssignment[]>();
    const keys = [...this.corridors.keys()].sort();
    for (const key of keys) {
      const entry = this.corridors.get(key)!;
      const sorted = [...entry.requests].sort(compareLaneRequests);
      out.set(
        key,
        sorted.map((request, position) => {
          const laneIndex = symmetricLaneIndex(position, sorted.length);
          return {
            edgeId: request.edgeId,
            corridor: entry.corridor,
            laneIndex,
            offset: laneOffset(laneIndex, this.tokens.laneGrid),
          };
        })
      );
    }
    return out;
  }

  /** Flache Sicht: Edge-ID → Zuordnung (eine je Korridor-Mitgliedschaft). */
  assignByEdge(): Map<string, LaneAssignment[]> {
    const byEdge = new Map<string, LaneAssignment[]>();
    for (const assignments of this.assign().values()) {
      for (const a of assignments) {
        const list = byEdge.get(a.edgeId) ?? [];
        list.push(a);
        byEdge.set(a.edgeId, list);
      }
    }
    // Deterministische Reihenfolge je Kante (Korridor-Schlüssel).
    for (const list of byEdge.values()) list.sort((x, y) => x.corridor.key.localeCompare(y.corridor.key));
    return byEdge;
  }
}
