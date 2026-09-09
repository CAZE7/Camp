/**
 * WP-1 (#390): Routing-Design-Tokens — Single Source of Truth.
 *
 * Alle geometrischen Routing-Konstanten leben genau einmal hier
 * (`docs/ROUTING-V2.md` §3). ELK-Optionen und A*-Straffunktion leiten
 * ausschließlich daraus ab: die ELK-Optionsstruktur wird über
 * `generateElkLayoutOptions()` GENERIERT, nicht gepflegt — der
 * Config-Sync-Test (`lib/routing/tokens.test.ts`) schlägt bei
 * Abweichung oder Hardcode fehl.
 *
 * Integration ins bestehende Token-System (M11-1): `app/globals.css`
 * bleibt die einzige FARBQUELLE (D-1, ADR 0005); dieses Modul ergänzt die
 * GEOMETRIE-Seite mit derselben Test-Disziplin (Drift-Guards) und ersetzt
 * nichts. Domänen-Paar-Regeln (electrical↔water, …) sind bewusst NICHT
 * hier — sie sind Domänenlogik und kommen mit dem Kollisionsmodell
 * (WP-3, `domainSeparationRules`), das nur die WERTE von hier bezieht.
 */

export type RoutingTokens = {
  /** Mindestabstand Kabel ↔ Kabel / Kabel ↔ Node (px). */
  readonly cableClearance: number;
  /** ELK `spacing.edgeNode` / `spacing.edgeNodeBetweenLayers`. */
  readonly elkEdgeNodeSpacing: number;
  /** Mindestlänge vor erstem Bend; Mindestlänge der Stubs (px). */
  readonly stubMin: number;
  /**
   * Mindestlänge JEDES Segments (px) — Invariante I6.
   *
   * Kleiner als `stubMin` und bewusst gleich `laneGrid`: Ein Lane-Wechsel
   * (Port-Fan-Out, Bündelung paralleler Trassen) ist orthogonal nur als
   * Quersegment von genau einer Lane Breite darstellbar. Würde hier
   * `stubMin` gelten, wäre jeder Lane-Wechsel ein Invarianten-Verstoß —
   * die Regel wäre unerfüllbar und damit wertlos. Drift-Guard im Token-Test:
   * `segmentMin === laneGrid` und `segmentMin <= stubMin`.
   */
  readonly segmentMin: number;
  /** Kanalabstand paralleler Trassen (px, ≈ Node-Raster). */
  readonly laneGrid: number;
  /** Einheitliche Rundungen; Bend-Merge-Schwelle ist 2×r (px). */
  readonly bendRadius: number;
  /** Wert für Domain-Trennung — die Paar-Regel lebt in WP-3 (px). */
  readonly crossDomainSpacing: number;
  /** Fallback-Größe für Nodes ohne gemessene React-Flow-Geometrie (px). */
  readonly nodeFallbackWidth: number;
  readonly nodeFallbackHeight: number;
  /** Region um eine Kante, die der lokale Router als Suchfenster lädt (px). */
  readonly obstacleRegionPad: number;
  /** Geometrische Kosten der produktiven A*-Suche (px-Äquivalent). */
  readonly bendCost: number;
  readonly uTurnCost: number;
  /** Begrenzungen der deterministischen Kandidatensuche. */
  readonly maxSearchExpansions: number;
  readonly maxAcceptableCrossings: number;
};

export const ROUTING_TOKENS: RoutingTokens = Object.freeze({
  cableClearance: 12,
  elkEdgeNodeSpacing: 16,
  stubMin: 24,
  laneGrid: 16,
  segmentMin: 16,
  bendRadius: 8,
  crossDomainSpacing: 24,
  nodeFallbackWidth: 192,
  nodeFallbackHeight: 120,
  obstacleRegionPad: 240,
  bendCost: 80,
  uTurnCost: 400,
  maxSearchExpansions: 48_000,
  maxAcceptableCrossings: 2,
});

/**
 * Übergangswerte des Ist-Routers (bis Routing V2 sie ablöst).
 *
 * Sie sind hier zentralisiert (vorher doppelt in `orthogonalRouting.ts`
 * UND `pathfinding.ts` gepflegt), aber bewusst von den Spec-Tokens
 * getrennt: ihre Werte sind der eingefrorene Golden-Master-Stand
 * (`knownPlans/`), nicht das V2-Zielbild.
 *
 * - `obstacleMargin` (14) deckt `cableClearance` (12) mit Reserve —
 *   Drift-Guard im Token-Test.
 * - `routeBorderRadius` (10) weicht vom V2-Ziel `bendRadius` (8) ab;
 *   die Umstellung kommt mit Bend-Merge (WP-2, dann begründeter
 *   Golden-Master-Recapture + Ledger-Eintrag).
 */
export type LegacyRoutingTokens = {
  /** Aufblähung der Node-Boxen bei der Hindernisprüfung (px). */
  readonly obstacleMargin: number;
  /** Eckenradius der gerenderten Pfade (px) — V2-Ziel: `bendRadius`. */
  readonly routeBorderRadius: number;
};

export const LEGACY_ROUTING_TOKENS: LegacyRoutingTokens = Object.freeze({
  obstacleMargin: 14,
  routeBorderRadius: 10,
});

/**
 * Ausweich-Parallelen der Router: ±3/±6 Lanes (±48/±96 px — historisch
 * „±40/±80“). Vielfache von `laneGrid`, damit Ausweich-Trassen nie mit
 * Bündel-Lanes (±0,5/±1,5/±2,5 …) kollidieren. Wird von der
 * LaneRegistry (WP-5) abgelöst.
 */
export const ALTERNATIVE_LANE_STEP = 3;
export const alternativeRouteGap = (tokens: RoutingTokens = ROUTING_TOKENS): number =>
  ALTERNATIVE_LANE_STEP * tokens.laneGrid;

/**
 * ELK-Layered-Optionsstruktur, GENERIERT aus den Tokens
 * (`docs/ROUTING-V2.md` §6.1). Konsumiert ab WP-4 vom elkjs-Adapter;
 * bis dahin sichert der Config-Sync-Test, dass niemand parallel eine
 * handgepflegte Kopie einführt.
 *
 * Die Nicht-Geometrie-Optionen (Algorithmus, mergeEdges, Ports, …) sind
 * Teil der eingefrorenen Spec und hier die einzige Definitionsstelle.
 */
export function generateElkLayoutOptions(
  tokens: RoutingTokens = ROUTING_TOKENS,
  direction?: 'LR' | 'TB'
): Record<string, string> {
  return {
    'elk.algorithm': 'layered',
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.spacing.edgeEdge': String(tokens.cableClearance),
    'elk.spacing.edgeNode': String(tokens.elkEdgeNodeSpacing),
    'elk.layered.spacing.edgeNodeBetweenLayers': String(tokens.elkEdgeNodeSpacing),
    'elk.layered.spacing.edgeEdgeBetweenLayers': String(tokens.cableClearance),
    'elk.layered.mergeEdges': 'false',
    'elk.layered.priority.straightness': '1',
    'elk.portConstraints': 'FIXED_ORDER',
    'elk.junctionPoints': 'true',
    // Nur setzen, wenn der Aufrufer eine Richtung vorgibt — sonst bleibt
    // ELKs Vorgabe erhalten und bestehende Aufrufer ändern ihr Ergebnis nicht.
    ...(direction ? { 'elk.direction': direction === 'TB' ? 'DOWN' : 'RIGHT' } : {}),
  };
}

/**
 * Interaktiver Modus: Nutzerplatzierungen respektieren
 * (`docs/ROUTING-V2.md` §6.2) — überlagert die Basis-Optionen.
 */
export function generateElkInteractiveOptions(
  tokens: RoutingTokens = ROUTING_TOKENS,
  direction?: 'LR' | 'TB'
): Record<string, string> {
  return {
    ...generateElkLayoutOptions(tokens, direction),
    'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
    'elk.layered.layering.strategy': 'INTERACTIVE',
    'elk.layered.crossingMinimization.semiInteractive': 'true',
    'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',
  };
}
