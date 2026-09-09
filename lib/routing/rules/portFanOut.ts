import { laneOffset, type Point } from '../geometry';
import { ROUTING_TOKENS, type RoutingTokens } from '../tokens';

/**
 * WP-9 (#398) / ROUTE-BUG-2 (2026-09-09): Port Fan-Out — deterministische
 * Lane-Vergabe mehrerer Kanten an einem Handle (Schicht 2).
 *
 * Modell: Kanten am selben Port verlassen ihn als Bündel. Der Lane-Wert
 * (px, vorzeichenbehaftet) wirkt im Router zweifach (`portFrame`):
 *
 * 1. **Staffelung** — die Kante knickt erst nach `stubMin + |lane|` px ab.
 *    Trennt die Trassen von Kanten, die direkt nach dem Stub abknicken.
 * 2. **Seitenschritt** — um `lane` px senkrecht zur Port-Achse. Trennt die
 *    Trassen von Kanten, die erst einmal entlang der Port-Achse weiterlaufen.
 *
 * Beides zusammen ist nötig: Nur die Staffelung lässt achsparallele Kanten
 * auf derselben Linie (gemessen 372 px doppelte Belegung), nur der
 * Seitenschritt lässt sofort abknickende Kanten auf derselben Trasse.
 * Die gemeinsame Strecke bleibt auf den Port-Stub beschränkt
 * (dokumentierte Bündel-Ausnahme in `checkEdgeEdgeOverlaps`).
 *
 * Reihenfolge: nach dem Quer-Versatz des Gegenübers — wer weiter oben/links
 * ankommt, liegt auch im Bündel innen. Damit ist die Lane-Koordinate monoton
 * im Zielort und die Stubs überkreuzen sich nicht (deterministisch,
 * Tie-Breaker Edge-ID, ADR 0010).
 *
 * Warum kein Quer-Versatz senkrecht zur Port-Richtung? Weil die erste Trasse
 * nach dem Abknicken GENAU in diese Richtung zeigt: Ein seitlicher Versatz
 * würde dann nur den Knickpunkt verschieben, die Trassen lägen weiterhin
 * übereinander (gemessen: bis 78 px doppelte Belegung).
 */

/** Eine Kante, wie der Port-Fan-Out sie sieht. */
export type FanOutRequest = {
  edgeId: string;
  /**
   * Quer-Versatz des Gegenendes relativ zum Port, projiziert auf die
   * Port-Senkrechte (px): `(Gegenende − Port) · Senkrechte`. Bestimmt die
   * Reihenfolge im Bündel (nicht die Seite — die Staffelung ist immer
   * port-abwärts).
   */
  cross: number;
};

export type FanOutAssignment = {
  edgeId: string;
  /** Rang am Port, über beide Seiten fortlaufend (nur Diagnose/ELK-Index). */
  order: number;
  /** Lane-Index: negativ = eine Seite der Port-Senkrechten, positiv = andere. */
  laneIndex: number;
  /** Lane-Wert in px: `laneIndex × laneGrid` (vorzeichenbehaftet). */
  offset: number;
};

/** Sortierschlüssel: Quer-Versatz des Gegenübers, dann stabile Edge-ID. */
export function compareFanOutRequests(a: FanOutRequest, b: FanOutRequest): number {
  if (a.cross !== b.cross) return a.cross - b.cross;
  return a.edgeId < b.edgeId ? -1 : a.edgeId > b.edgeId ? 1 : 0;
}

/**
 * Deterministische Fan-Out-Zuordnung eines Ports. Unabhängig von der
 * Eingabereihenfolge (gleicher Input ⇒ gleiche Lanes, ADR 0010).
 *
 * Einzelkanten bleiben auf Rang 0 (Stub ohne Verlängerung).
 */
export function assignFanOut(
  requests: readonly FanOutRequest[],
  tokens: RoutingTokens = ROUTING_TOKENS
): FanOutAssignment[] {
  if (requests.length <= 1) {
    return requests.map((request) => ({ edgeId: request.edgeId, order: 0, laneIndex: 0, offset: 0 }));
  }
  const sorted = [...requests].sort(compareFanOutRequests);

  // ROUTE-BUG-13: Die am stärksten achsparallele Kante fährt geradeaus
  // (Lane 0), die übrigen fächern auf IHRER Seite auf — Seite = Vorzeichen
  // des Quer-Versatzes, Betrag = Rang auf dieser Seite.
  //
  // Warum nicht einfach nach `cross` sortieren und abzählen? Weil dann eine
  // Kante, deren Gegenüber exakt auf der Port-Achse liegt, einen
  // Seitenschritt bekommt, dem sie sofort wieder zurückfolgen muss
  // (gemessen: 16-px-Haken am Ziel-Handle). Und weil Ränge beiderseits
  // getrennt zählen, sind die Beträge je Seite eindeutig — Kollisionen wie
  // bei |−1| = |+1| sind ausgeschlossen.
  const left: FanOutRequest[] = [];
  const right: FanOutRequest[] = [];
  let center: FanOutRequest | undefined;
  for (const request of sorted) {
    if (request.cross < 0) left.push(request);
    else if (request.cross > 0) right.push(request);
    else if (center === undefined) center = request;
    else right.push(request);
  }
  // |cross| aufsteigend: die achsparallelste Kante jeder Seite bekommt die
  // innerste Lane. (`sorted` ist nach cross aufsteigend, also ist `left`
  // rückwärts und `right` vorwärts bereits richtig.)
  left.reverse();

  const laneOf = new Map<string, number>();
  if (center) laneOf.set(center.edgeId, 0);
  right.forEach((request, index) => laneOf.set(request.edgeId, index + 1));
  left.forEach((request, index) => laneOf.set(request.edgeId, -(index + 1)));

  // Verworfener Versuch (gemessen 2026-09-09, ROUTE-BUG-29): die
  // Stub-Verlängerung über die ganze Gruppe eindeutig zu zählen (Rang −1 und
  // +1 haben denselben Betrag, also gleich lange Stubs und dieselbe
  // Zuführungs-Achse — eine der I2-Überdeckungen). Längere Stubs drücken die
  // Lane-Punkte in nachbarliche Boxen: camper bekam 3 × I3, complex 3
  // Kreuzungen mehr. Der Betrag bleibt `|laneIndex|`.
  return sorted.map((request, order) => {
    const laneIndex = laneOf.get(request.edgeId) ?? 0;
    return {
      edgeId: request.edgeId,
      order,
      laneIndex,
      offset: laneOffset(laneIndex, tokens.laneGrid),
    };
  });
}

/**
 * ELK-Port-Reihenfolge (`FIXED_ORDER`, WP-4): dieselbe Sortierung liefert die
 * `elk.port.index`-Werte — Fan-Out am Port und ELK-Portordnung können nicht
 * divergieren (eine Quelle).
 */
export function fanOutPortIndices(requests: readonly FanOutRequest[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of assignFanOut(requests)) out.set(a.edgeId, a.order);
  return out;
}

/**
 * Port-Senkrechte zu einer Austrittsrichtung (rechtsdrehend zur
 * Fahrtrichtung): die Achse, entlang der die Bündel-Reihenfolge gebildet wird.
 *
 * +x (rechts) → +y (unten) · −x (links) → −y (oben)
 * +y (unten)  → −x (links) · −y (oben)  → +x (rechts)
 */
export const portNormal = (direction: Point): Point => ({
  // `direction.y === 0 ? 0 : …` hält −0 aus den Koordinaten heraus.
  x: direction.y === 0 ? 0 : -direction.y,
  y: direction.x === 0 ? 0 : direction.x,
});

/** Quer-Versatz eines Gegenendes relativ zum Port (Projektions-Hilfe). */
export const portCross = (port: Point, farEnd: Point, normal: Point): number =>
  (farEnd.x - port.x) * normal.x + (farEnd.y - port.y) * normal.y;
