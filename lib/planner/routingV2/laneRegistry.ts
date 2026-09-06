/**
 * lib/planner/routingV2/laneRegistry.ts
 *
 * LaneRegistry — deterministische Zuordnung paralleler Trassen.
 *
 * Problem (vorher):
 * ---------------
 * Es gab keine zentrale Instanz, die festlegt, welche von mehreren parallelen
 * Kanten auf welcher "Lane" (Spur) verläuft. Dadurch waren die Abstände
 * und Reihenfolgen nicht reproduzierbar.
 *
 * Diese Registry ordnet jeder Kante eines Trasses eine kleine, zusammenhängende
 * Lane-Nummer zu (0, 1, 2, …). Die Reihenfolge ist deterministisch (sortiert
 * nach edgeId), sodass zwei Kanten desselben Trasses niemals dieselbe Lane
 * erhalten und der Lateralabstand exakt GEOMETRY.cableClearance beträgt.
 *
 * Der Lateralabstand basiert auf GEOMETRY.cableClearance.
 */

import { GEOMETRY, laneOffset } from '../geometry';

/** Eine Lane-Zuweisung innerhalb eines Trasses. */
export type LaneAssignment = {
  edgeId: string;
  source: string;
  target: string;
  /** Index der Lane (0 = Grundachse, aufsteigend nach unten). */
  lane: number;
  /** Lateraler Versatz der Lane in px. */
  offset: number;
};

/**
 * Die LaneRegistry weist parallelen Trassen deterministisch Lanes zu.
 *
 * - `acquire` registriert eine Kante und liefert ihre stabile Lane.
 * - Zwei Kanten mit identischem (source, target)-Trass erhalten nie dieselbe Lane.
 * - Lanes sind kleine, zusammenhängende Zahlen (0, 1, 2, …) je Trass.
 */
export class LaneRegistry {
  /** edgeId → LaneAssignment */
  private readonly assignments = new Map<string, LaneAssignment>();

  /** Trass-Schlüssel ("source→target") → Menge der edgeIds im Trass. */
  private readonly trunkEdges = new Map<string, Set<string>>();

  /**
   * Vergibt eine deterministische, zusammenhängende Lane für eine Kante.
   *
   * Jede neue Kante eines Trasses bekommt die nächste freie Lane (0, 1, 2, …).
   * Dadurch ist die Zuordnung reproduzierbar (gleiche Eingabe → gleiche Lanes)
   * und zwei Kanten desselben Trasses bekommen nie dieselbe Lane.
   *
   * @param edgeId  Eindeutige Kanten-ID
   * @param source  Quellknoten-ID
   * @param target  Zielknoten-ID
   * @returns       Die Lane-Zuweisung
   */
  acquire(edgeId: string, source: string, target: string): LaneAssignment {
    const existing = this.assignments.get(edgeId);
    if (existing) return existing;

    const trunkKey = `${source}→${target}`;
    const edges = this.trunkEdges.get(trunkKey) ?? new Set<string>();
    // Anzahl der bereits vergebenen Kanten im Trass = nächste freie Lane.
    const lane = edges.size;
    edges.add(edgeId);
    this.trunkEdges.set(trunkKey, edges);

    const assignment: LaneAssignment = {
      edgeId,
      source,
      target,
      lane,
      offset: laneOffset(lane),
    };
    this.assignments.set(edgeId, assignment);
    return assignment;
  }

  /** Liefert alle vergebenen Lanes eines Trasses (aufsteigend). */
  lanesForTrunk(source: string, target: string): number[] {
    const trunkKey = `${source}→${target}`;
    const edges = this.trunkEdges.get(trunkKey) ?? new Set<string>();
    return Array.from(edges)
      .map((edgeId) => this.assignments.get(edgeId)!.lane)
      .sort((a, b) => a - b);
  }

  /** Liefert die Zuweisung einer Kante oder null. */
  get(edgeId: string): LaneAssignment | null {
    return this.assignments.get(edgeId) ?? null;
  }

  /** Anzahl der aktuell vergebenen Kanten. */
  get size(): number {
    return this.assignments.size;
  }

  /** Setzt die Registry zurück (z.B. vor jedem Routing-Lauf). */
  reset(): void {
    this.assignments.clear();
    this.trunkEdges.clear();
  }

  /**
   * Liefert die Gesamtbreite des Trasses mit den vorgegebenen Lanes.
   *
   * @param lanes  Lanes eines Trasses (aus `lanesForTrunk`)
   * @returns      Breite in px
   */
  trunkWidth(lanes: number[]): number {
    if (lanes.length === 0) return 0;
    const maxLane = Math.max(...lanes);
    // von der Grundachse bis zur Unterkante der letzten Lane
    return maxLane * GEOMETRY.cableClearance;
  }
}
