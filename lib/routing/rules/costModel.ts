import { type SegmentSpatialIndex } from '../geometry/segmentSpatialIndex';
import { classifySegmentAgainstSegment } from './collision';
import { distanceSegmentToSegment, type Segment } from '../geometry';
import { ROUTING_TOKENS, type RoutingTokens } from '../tokens';
import { isPortBundleOverlap, type RoutedPathGeometry } from './portBundle';

/**
 * WP-6 (#396): A*-Kostenmodell — Schicht 2 (Routing Rules).
 *
 * Kostenmatrix der Spec (ROUTING-V2.md §9) für den inkrementellen Pass.
 * Alle Werte sind px-äquivalent (1 Kosteneinheit = 1 px Leitungslänge,
 * dieselbe Währung wie BEND_COST im Bestandsrouter) und werden aus den
 * Tokens ABGELEITET — kein Wert ist hier von Hand gepflegt.
 *
 * | Situation           | Kosten      | Ableitung                          |
 * |---------------------|-------------|-------------------------------------|
 * | overlap             | Infinity    | hard (ADR 0009) — garantiert unmöglich |
 * | clearance violation | VERY_HIGH   | 25 × laneGrid = 400 (= U_TURN_COST: schlimmer als jede Kehre) |
 * | crossing            | HIGH        | 7,5 × laneGrid = 120 (Bestandswert des Routers, s. Sync-Test) |
 * | u-turn (180°)       | U_TURN      | 25 × laneGrid = 400 (Bestandswert `U_TURN_COST`, s. Sync-Test) |
 * | port-bundle stub    | ALLOWED     | 0 — gemeinsamer Stub zweier Leitungen an einem Handle (ADR 0009) |
 * | bend (90°)          | BEND        | 5 × laneGrid = 80 (Bestandswert `BEND_COST`, s. Sync-Test) |
 * | nearby lane         | MEDIUM      | 1 × laneGrid = 16 (eine Lane Ausweichen ist billiger) |
 * | preferred lane      | BONUS       | −laneGrid/2 = −8 (zieht auf die Registry-Lane, WP-5) |
 * | free space          | LOW         | 0 (nur die Weglänge zählt)          |
 *
 * Konsistenz mit dem Kollisionsmodell (WP-3) ist Vertrag und testgesichert:
 * hard ⇒ Infinity/verboten, soft ⇒ endliche Strafkosten, weighted ⇒ Kosten,
 * none ⇒ LOW. Datenbasis ist der `SegmentSpatialIndex` (geroutete Segmente
 * als weiche Hindernisse); alle Abstands-/Kollinearitäts-Checks kommen aus
 * der Geometrie-Schicht (WP-2).
 *
 * Einbau-Reihenfolge (ROUTE-002): Der Bestandsrouter liest die drei
 * Kanten-Kosten, die er tatsächlich optimiert, seit 2026-09-27 AUS dem Modell
 * — `crossing` (7,5 × laneGrid), `bend` und `uTurn` (5 bzw. 25 × laneGrid).
 * Die Werte sind wertgleich zu den früher hier hart gepflegten Konstanten
 * `BEND_COST = 80` / `U_TURN_COST = 400` (Sync-Test in `costModel.test.ts`),
 * der Golden Master bleibt deshalb unverändert.
 *
 * Was noch fehlt, ist die *räumliche* Hälfte: `segmentExtraCost` und
 * `preferredLaneBonus` haben weiterhin keinen Produktiv-Konsumenten. Das ist
 * **kein** vergessener Stecker, sondern eine gemessene Grenze: Über die sechs
 * Referenzpläne (Produktivpfad, geroutete Trassen) zählt die Klassifikation
 * 47 fremde `hard`-Paare, 82 `weighted`-Paare und 121 `nearby`-Paare — die 47
 * harten sind **alle** die Port-Bündel-Ausnahme (ADR 0009: zwei Leitungen am
 * selben Handle teilen sich den Stub; die Ausnahme lebt in
 * `lib/routing/invariants.ts`, `checkEdgeEdgeOverlaps`), echte I2-Verstöße
 * sind 0. Ein blindes Anschließen würde also 47 legitime Stubs als
 * unmöglich verwerfen, und `nearbyLane` würde gegen die gewollten
 * Bündel-Lanes (16 px Raster) drücken. Vor dem Produktiv-Einsatz muss die
 * Ausnahme in das Modell wandern (`segmentExtraCost` braucht Kenntnis der
 * Stubs des Nachbarn), der Bonus braucht die LaneRegistry (ROUTE-001).
 * Details: ROUTE-002 in `docs/ai/KNOWN-PROBLEMS.md`.
 */

export type CostWeights = {
  /** Edge-Edge-Overlap — hard, garantiert unmöglich. */
  readonly overlap: number;
  /** Verletzung der Mindest-Clearance (weighted, sehr teuer). */
  readonly clearanceViolation: number;
  /** Echte Kreuzung (soft — minimieren, nicht verbieten). */
  readonly crossing: number;
  /** 90°-Biegung einer Leitung (Bestandswert `BEND_COST`). */
  readonly bend: number;
  /** 180°-Kehre einer Leitung (Bestandswert `U_TURN_COST`). */
  readonly uTurn: number;
  /** Nachbarschaft einer fremden Lane (innerhalb einer Lane-Breite über der Clearance). */
  readonly nearbyLane: number;
  /** Bonus (negativ) für die von der LaneRegistry bevorzugte Lane (WP-5). */
  readonly preferredLaneBonus: number;
  /** Freier Raum — nur die Weglänge zählt. */
  readonly freeSpace: number;
};

/** Ableitungsfaktoren (dokumentiert in der Matrix oben) — Teil der Config. */
export const COST_FACTORS = Object.freeze({
  clearancePerLaneGrid: 25,
  crossingPerLaneGrid: 7.5,
  bendPerLaneGrid: 5,
  uTurnPerLaneGrid: 25,
  nearbyPerLaneGrid: 1,
  preferredBonusPerLaneGrid: -0.5,
});

/** Kostenmatrix aus den Tokens generieren — einzige Quelle der Werte. */
export function buildCostWeights(tokens: RoutingTokens = ROUTING_TOKENS): CostWeights {
  return Object.freeze({
    overlap: Infinity,
    clearanceViolation: COST_FACTORS.clearancePerLaneGrid * tokens.laneGrid,
    crossing: COST_FACTORS.crossingPerLaneGrid * tokens.laneGrid,
    bend: COST_FACTORS.bendPerLaneGrid * tokens.laneGrid,
    uTurn: COST_FACTORS.uTurnPerLaneGrid * tokens.laneGrid,
    nearbyLane: COST_FACTORS.nearbyPerLaneGrid * tokens.laneGrid,
    preferredLaneBonus: COST_FACTORS.preferredBonusPerLaneGrid * tokens.laneGrid,
    freeSpace: 0,
  });
}

/** Default-Gewichte (Spec-Tokens). */
export const COST_WEIGHTS: CostWeights = buildCostWeights();

export type SegmentCostBreakdown = {
  /** Summierte Zusatzkosten (ohne Weglänge); Infinity bei Overlap. */
  cost: number;
  overlaps: number;
  crossings: number;
  clearanceViolations: number;
  nearbyLanes: number;
  /**
   * Kollineare Überdeckungen, die als legitime Port-Bündelung (ADR 0009)
   * durchgelassen wurden — nur mit `options.portBundle` größer 0. Sie sind
   * kein Defekt, sondern der gemeinsame Stub zweier Leitungen an derselben
   * Anschlussstelle; ohne diese Kenntnis wären sie `hard`/`Infinity`.
   */
  portBundleShared: number;
};

/**
 * Stub-Kenntnis des Nachbarn (ROUTE-002 Teil 2, ADR 0009).
 *
 * `segmentExtraCost` sieht nur ein Segment und ein Fremdsegment. Ob eine
 * kollineare Überdeckung die erlaubte Port-Bündelung ist, hängt aber an den
 * Stubs BEIDER Kanten — die liefert der Aufrufer:
 *
 *   - `own`:    Geometrie der Kante, zu der das geprüfte Segment gehört
 *               (`routedPathGeometry`).
 *   - `otherOf`: Geometrie der Kante, zu der ein Index-Segment gehört.
 *               `undefined` = unbekannt ⇒ **keine** Ausnahme (fail-safe:
 *               im Zweifel bleibt die Überdeckung hart).
 *
 * Die Entscheidung selbst trifft `isPortBundleOverlap` aus
 * `rules/portBundle.ts` — dieselbe Funktion, die I2
 * (`lib/routing/invariants.ts`) und das Audit benutzen. Modell und
 * Invariante können damit nicht auseinanderlaufen.
 */
export type PortBundleContext = {
  readonly own: RoutedPathGeometry;
  readonly otherOf?: (segment: Segment) => RoutedPathGeometry | undefined;
};

/**
 * Zusatzkosten eines Kandidaten-Segments gegen die bereits gerouteten
 * Segmente (weiche Hindernisse im `SegmentSpatialIndex`).
 *
 * Klassifikation läuft ausschließlich über das Kollisionsmodell (WP-3):
 * - hard/Overlap  → Infinity (Abbruch, Segment unmöglich)
 * - soft/Crossing → `crossing` je gekreuztem Fremdsegment
 * - weighted      → `clearanceViolation` (unter der Clearance)
 * - none          → `nearbyLane`, falls innerhalb einer Lane-Breite über
 *                   der Clearance (Bündelungs-Druck), sonst `freeSpace`.
 *
 * EINE Ausnahme von „hard ⇒ Infinity“ (ROUTE-002, ADR 0009): Liegt die
 * kollineare Überdeckung vollständig in den Stubs beider Kanten und teilen
 * diese sich eine Anschlussstelle, ist sie die unvermeidbare Port-Bündelung —
 * sie zählt als `portBundleShared` und kostet nichts. Dafür braucht die
 * Funktion die Stub-Kenntnis des Nachbarn (`options.portBundle`); ohne sie
 * bleibt jede Überdeckung hart (fail-safe, s. `PortBundleContext`).
 */
export function segmentExtraCost(
  segment: Segment,
  index: SegmentSpatialIndex,
  options?: {
    tokens?: RoutingTokens;
    weights?: CostWeights;
    clearance?: number;
    /** Stub-Kenntnis für die Port-Bündel-Ausnahme (ADR 0009) — sonst entfällt sie. */
    portBundle?: PortBundleContext;
  }
): SegmentCostBreakdown {
  const tokens = options?.tokens ?? ROUTING_TOKENS;
  const weights = options?.weights ?? (options?.tokens ? buildCostWeights(options.tokens) : COST_WEIGHTS);
  const clearance = options?.clearance ?? tokens.cableClearance;
  const nearbyBand = clearance + tokens.laneGrid;
  const portBundle = options?.portBundle;

  const breakdown: SegmentCostBreakdown = {
    cost: 0,
    overlaps: 0,
    crossings: 0,
    clearanceViolations: 0,
    nearbyLanes: 0,
    portBundleShared: 0,
  };

  const neighbors = index.queryNear(segment[0], segment[1], nearbyBand);
  for (const other of neighbors) {
    const constraint = classifySegmentAgainstSegment(segment, other, clearance);
    if (constraint.class === 'hard') {
      // ROUTE-002 (ADR 0009): Der gemeinsame Stub zweier Leitungen an
      // derselben Anschlussstelle ist kollinear überdeckt und für das
      // Kollisionsmodell „hard“ — erlaubt ist er trotzdem, solange die
      // Überdeckung vollständig in den Stubs BEIDER Kanten liegt
      // (`isPortBundleOverlap`). Ohne `otherOf`-Kenntnis bleibt es hart
      // (fail-safe), denn ein falsch verworfenes Segment ist schlimmer als
      // ein nicht ausgenutztes Bündel.
      const otherPath = portBundle?.otherOf?.(other);
      if (portBundle && otherPath && isPortBundleOverlap(portBundle.own, otherPath, segment, other)) {
        breakdown.portBundleShared += 1;
        continue; // erlaubte Bündelung: der Stub ist unvermeidbar, kostet nichts.
      }
      breakdown.overlaps += 1;
      breakdown.cost = Infinity;
      return breakdown; // hard: garantiert unmöglich — weitersummieren sinnlos.
    }
    if (constraint.class === 'soft') {
      breakdown.crossings += 1;
      breakdown.cost += weights.crossing;
      continue;
    }
    if (constraint.class === 'weighted') {
      breakdown.clearanceViolations += 1;
      breakdown.cost += weights.clearanceViolation;
      continue;
    }
    // none: ggf. Nachbarlane (knapp über der Clearance) — Bündelungs-Druck.
    const distance = distanceSegmentToSegment(segment, other);
    if (distance < nearbyBand) {
      breakdown.nearbyLanes += 1;
      breakdown.cost += weights.nearbyLane;
    } else {
      breakdown.cost += weights.freeSpace;
    }
  }
  return breakdown;
}

/**
 * Lane-Bonus (WP-5-Anbindung): liegt der Quer-Versatz eines Segments auf
 * der von der LaneRegistry bevorzugten Lane, wird der (negative) Bonus
 * gewährt — der A*-Pass zieht Trassen aktiv auf ihre Registry-Lane.
 */
export function preferredLaneBonus(
  actualOffset: number,
  preferredOffset: number | undefined,
  weights: CostWeights = COST_WEIGHTS
): number {
  if (preferredOffset === undefined) return 0;
  return Math.abs(actualOffset - preferredOffset) < 1e-6 ? weights.preferredLaneBonus : 0;
}
