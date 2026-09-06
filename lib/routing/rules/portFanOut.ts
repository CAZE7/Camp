import { laneOffset, type Point } from '../geometry';
import { ROUTING_TOKENS, type RoutingTokens } from '../tokens';
import { symmetricLaneIndex } from './laneRegistry';

/**
 * WP-9 (#398): Port Fan-Out — deterministische Sortierung mehrerer Kanten
 * an einem Handle (Schicht 2).
 *
 * Modell: Kanten am selben Port verlassen ihn als Bündel in der Reihenfolge
 * ihrer GEGENENDEN — wer weiter oben/links ankommt, verlässt den Port auch
 * oben/links. Damit kreuzen sich die Stubs direkt an der Quelle nicht.
 *
 * Sortierung (Vertrag, konsistent mit LaneRegistry WP-5 und ELK
 * `FIXED_ORDER` WP-4):
 *   1. Quer-Koordinate der Zielposition (bei horizontalem Austritt: y des
 *      Gegenübers; bei vertikalem: x)
 *   2. stabile Edge-ID als Tie-Breaker
 *
 * Der Versatz ist `symmetricLaneIndex × laneGrid` — dasselbe Raster wie
 * Bündel-Lanes und LaneRegistry (WP-2-Primitive `laneOffset`).
 *
 * Wörtlich aus `routeAll.portOrderedLaneOffsets` extrahierte Mechanik
 * (Migration, kein Neuentwurf) — der Router konsumiert ab jetzt diese
 * Funktionen; das Verhalten ist identisch (Golden Master unverändert).
 */

/** Austrittsrichtung des Ports (Seite der Node-Karte). */
export type PortAxis = 'horizontal' | 'vertical';

export type FanOutRequest = {
  edgeId: string;
  /** Position des Gegenendes (bestimmt die Reihenfolge am Port). */
  farEnd: Point;
};

export type FanOutAssignment = {
  edgeId: string;
  /** Reihenfolge am Port (0 = oben/links). */
  order: number;
  /** Symmetrischer Lane-Index um die Portmitte. */
  laneIndex: number;
  /** laneIndex × laneGrid. */
  offset: number;
};

/** Sortierschlüssel: Quer-Koordinate des Gegenübers, dann stabile ID. */
export function compareFanOutRequests(axis: PortAxis, a: FanOutRequest, b: FanOutRequest): number {
  const ka = axis === 'horizontal' ? a.farEnd.y : a.farEnd.x;
  const kb = axis === 'horizontal' ? b.farEnd.y : b.farEnd.x;
  if (ka !== kb) return ka - kb;
  return a.edgeId < b.edgeId ? -1 : a.edgeId > b.edgeId ? 1 : 0;
}

/**
 * Deterministische Fan-Out-Zuordnung eines Ports. Unabhängig von der
 * Eingabereihenfolge (gleicher Input ⇒ gleiche Reihenfolge, ADR 0010).
 */
export function assignFanOut(
  axis: PortAxis,
  requests: readonly FanOutRequest[],
  tokens: RoutingTokens = ROUTING_TOKENS
): FanOutAssignment[] {
  const sorted = [...requests].sort((a, b) => compareFanOutRequests(axis, a, b));
  return sorted.map((request, order) => {
    const laneIndex = symmetricLaneIndex(order, sorted.length);
    return {
      edgeId: request.edgeId,
      order,
      laneIndex,
      offset: laneOffset(laneIndex, tokens.laneGrid),
    };
  });
}

/**
 * ELK-Port-Reihenfolge (`FIXED_ORDER`, WP-4): dieselbe Sortierung liefert
 * die `elk.port.index`-Werte — Fan-Out am Port und ELK-Portordnung können
 * nicht divergieren (eine Quelle).
 */
export function fanOutPortIndices(axis: PortAxis, requests: readonly FanOutRequest[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of assignFanOut(axis, requests)) out.set(a.edgeId, a.order);
  return out;
}
