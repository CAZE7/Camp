/**
 * lib/planner/geometry/geometryTokens.ts
 *
 * SINGLE SOURCE OF TRUTH für alle geometrischen Routing-/Layout-Grundwerte.
 *
 * Problem (vorher):
 * ---------------
 * Geometrie-/Routingwerte waren über das Projekt verteilt:
 *   - Router A → Wert X
 *   - Layout   → Wert Y
 *   - Renderer → Wert Z
 *
 * Das führte dazu, dass eine Änderung an einem Wert (z.B. Kabelabstand)
 * an einer Stelle gepflegt wurde und an einer anderen vergessen ging.
 *
 * Diese Datei ist die EINZIGE Stelle, an der die geometrischen Grundwerte
 * definiert werden. Routing V2, Collision Engine, Lane Registry und der
 * Renderer beziehen sich alle auf diese Tokens.
 *
 * Die Werte sind bewusst als "kleine ganze Zahlen" gewählt, damit sie auf
 * einem 16er-Raster (laneGrid) sauber aufgehen und deterministisch sind.
 */

/**
 * Alle eingebetteten Konstanten sind read-only, damit niemand versehentlich
 * einen Wert überschreiben kann. Zugriff über `GEOMETRY.cableClearance` etc.
 */
export const GEOMETRY = Object.freeze({
  /**
   * Mindestabstand (in px) zwischen zwei parallelen Kabeln, damit sie
   * optisch eindeutig getrennt sind und nicht ineinanderlaufen.
   * Dieser Wert entspricht dem seitlichen Versatz eines parallelen Trasses.
   */
  cableClearance: 12,

  /**
   * Mindestlänge (in px) einer "Stub"-Verbindung direkt an einem Knoten,
   * bevor ein Routing-Knick gesetzt werden darf. Verhindert, dass Abzweige
   * direkt auf der Knotenkante umbrechen.
   */
  stubMin: 24,

  /**
   * Grundraster (in px) des orthogonalen Routings. Alle Lane-Positionen,
   * Knickpunkte und Knotenpositionen werden auf dieses Raster gerundet,
   * damit das Ergebnis deterministisch und "sauber" wirkt.
   */
  laneGrid: 16,

  /**
   * Biegeradius (in px) für abgerundete Kabelkanten (Smooth-Step-Verhalten).
   * Wird im Renderer und im Routing-Cost-Modell verwendet.
   */
  bendRadius: 8,
});

/** Einzelner, freigegebener Token-Typ. */
export type GeometryToken = typeof GEOMETRY[keyof typeof GEOMETRY];

/** Zentrale Sammlung aller geometrischen Grundwerte als Typ. */
export type GeometryTokens = typeof GEOMETRY;

/** Bequemer Zugriff auf das Grundraster. */
export const LANE_GRID = GEOMETRY.laneGrid;

/** Bequemer Zugriff auf den Kabel-Mindestabstand. */
export const CABLE_CLEARANCE = GEOMETRY.cableClearance;

/** Bequemer Zugriff auf die Mindest-Stub-Länge. */
export const STUB_MIN = GEOMETRY.stubMin;

/** Bequemer Zugriff auf den Biegeradius. */
export const BEND_RADIUS = GEOMETRY.bendRadius;

/**
 * Rundet eine Zahl auf das nächste Vielfache des Grundrasters.
 *
 * @param value  Wert, der gerundet werden soll
 * @param grid   optionales Raster (default: GEOMETRY.laneGrid)
 * @returns      der auf das Raster gerundete Wert
 */
export function roundToLaneGrid(value: number, grid: number = GEOMETRY.laneGrid): number {
  return Math.round(value / grid) * grid;
}

/**
 * Berechnet den deterministischen seitlichen Versatz einer Lane k im
 * Trassen-Bündel. Lane 0 = Grundachse; wachsendes k verschiebt nach unten
 * (positiver y-Versatz). Der Abstand beträgt cableClearance.
 *
 * @param laneIndex Index der Lane (0-basiert)
 * @returns         y-Versatz relativ zur Grundachse
 */
export function laneOffset(laneIndex: number): number {
  return laneIndex * GEOMETRY.cableClearance;
}

/**
 * Berechnet die Breite (in px) eines Trassen-Bündels mit `count` Lanes.
 * Von der Oberkante der ersten zur Unterkante der letzten Lane.
 *
 * @param laneCount Anzahl paralleler Lanes
 * @returns         Gesamtbreite des Bündels in px
 */
export function bundleWidth(laneCount: number): number {
  if (laneCount <= 0) return 0;
  return (laneCount - 1) * GEOMETRY.cableClearance;
}

