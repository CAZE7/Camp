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
  /**
   * Mindestabstand zweier Karten, deren Anschlüsse einander zugewandt sind
   * (ROUTE-BUG-32 = `stubMin + 2·laneGrid + cableClearance`). Das ist die
   * Fläche, die der Router zwischen zwei Anschlüssen braucht: Stub, ZWEI
   * Lane-Schritte für den Fan-Out, plus Clearance. ELK muss sie beim
   * Platzieren einhalten (`elk.spacing.nodeNode`) — mit seinem Default
   * (~10 px) liefert „Plan ordnen" Karten, zwischen denen keine Leitung
   * kollisionsfrei passt (I1 = 3, I2 = 21, I3 = 17 über die Referenzpläne;
   * mit einem Lane-Schritt I1 = 0, I2 = 9, I3 = 1 — ADR 0023).
   *
   * **Ein Lane-Schritt (52 px) reichte nicht** (ROUTE-002 Teil 2b, ADR 0027):
   * Steht die Freigabe bei `stubMin + laneGrid`, greift bei zwei Leitungen an
   * einem Handle durchgehend die Stub-Kappung (`capStep`, ROUTE-BUG-31/34) —
   * die Lanes der Bündel sind dann nicht mehr ausdrückbar und laufen
   * kollinear übereinander (gemessen im ELK-Pfad: I2 = 5, alle port-nah).
   * Mit zwei Schritten (68 px) ist der ELK-Pfad bei I2 = 0 und 15
   * Kreuzungspaare weniger. Der Preis: die Karten liegen weiter auseinander,
   * die Kabel im ELK-Pfad werden rund 11 % länger (2 838 px über die sechs
   * Referenzpläne). Der Fest-Raster-Pfad (AutoWire) ändert sich NICHT — seine
   * Korridore (96/72 px) erfüllen beide Werte, und die Plan-Fixtures tragen
   * absolute Koordinaten; Goldens, Regression und Ratchets bleiben identisch.
   */
  readonly portFacingClearance: number;
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
  /**
   * Gerenderte Größe einer Kabel-Beschriftung (px): 12 px fett, `padding:
   * 2px 6px`, 1 px Rahmen — gemessen rund 156 × 22 für „DC- · 1.5 mm² · 3.0 m".
   *
   * Warum als Token (Spec §5.3, Befund 2026-09-28): Vorher rechnete die
   * Platzierung mit 112 × 28 und die Prüfung mit 88 × 20 — beide kleiner als
   * das Gerenderte, weshalb Beschriftungen auf Karten lagen, ohne dass eine
   * Prüfung anschlug. Eine Zahl, die die Darstellung beschreibt, gehört zur
   * Geometrie des Routings, nicht in zwei Module.
   */
  readonly labelBoxWidth: number;
  /** Höhe der Label-Box (px) — Drift-Guard: `<= laneGrid`, sonst berühren sich gestapelte Labels. */
  readonly labelBoxHeight: number;
  /** Kollisionsabstand Label ↔ Karte (px), zusätzlich zur Box. */
  readonly labelClearance: number;
  /**
   * Versatz, in dem Labels desselben Bündels gestapelt und seitlich der Trasse
   * gesucht werden (px). Wird auch als Ausweich-Stufe benutzt — Konsistenzregel
   * im Token-Test: `>= labelBoxHeight`, sonst berühren sich gestapelte Labels.
   */
  readonly parallelLabelSpread: number;
};

export const ROUTING_TOKENS: RoutingTokens = Object.freeze({
  cableClearance: 12,
  elkEdgeNodeSpacing: 16,
  portFacingClearance: 68,
  stubMin: 24,
  laneGrid: 16,
  segmentMin: 16,
  bendRadius: 8,
  crossDomainSpacing: 24,
  labelBoxWidth: 156,
  labelBoxHeight: 22,
  labelClearance: 4,
  parallelLabelSpread: 24,
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
  /**
   * Hindernis-Fenster des globalen Passes (`routeAllCables`, PERF-001:
   * Routen-BBox plus Pad statt aller N-1 Hindernisse pro Kante).
   *
   * Muss ≥ 2 × `alternativeRouteGap()` bleiben (Drift-Guard im Token-Test):
   * dann liegen selbst die äußersten Ausweich-Trassen (±2 Gaps) vollständig
   * innerhalb des gefilterten Fensters und können per Konstruktion kein
   * ausgefiltertes Hindernis treffen. Der Fenster-Nachzug (ROUTE-BUG-24)
   * erweitert das Fenster für Routen, die ihn dennoch verlassen.
   */
  readonly obstacleRegionPad: number;
};

export const LEGACY_ROUTING_TOKENS: LegacyRoutingTokens = Object.freeze({
  obstacleMargin: 14,
  routeBorderRadius: 10,
  obstacleRegionPad: 240,
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
 * Kartenabstand ZWISCHEN zwei ELK-Spalten (Schichten) — der Korridor, in dem
 * die Leitungen von einer Rolle zur nächsten laufen (ADR 0028).
 *
 * `portFacingClearance + 2·laneGrid` = 100 px. Die Summe ist aus der Geometrie
 * hergeleitet, nicht gesetzt:
 *
 * - Die **Handle-Boxen** stehen 21 px über die Karte hinaus (44 px breit, Mitte
 *   auf dem Kartenrand). Auf beiden Seiten eines Korridors gehen davon 42 px
 *   ab — bei 68 px blieben 26 px, und damit passt **eine** Trasse, nicht zwei
 *   (gemessen: I2 bleibt im ELK-Pfad, `complex`/`autark` je 1 Paar).
 * - Drei parallele Trassen brauchen `2·cableClearance + 2·laneGrid` = 56 px
 *   (12 px Freigabe zur Karte, zwei Lane-Schritte zwischen den Trassen).
 * - 42 + 56 = 98 px; 100 px sind die nächste Summe aus Tokens und halten den
 *   Puffer für die Trassen-Rundung.
 *
 * Gemessen über sieben Pläne (sechs Referenzpläne + AutoWire-Autark,
 * `applyAdvancedLayout` → `routeAllCables` → Abschlussvalidierung):
 * mit 68 px bleibt I2 ≠ 0, mit 100 px sind alle sieben in I1–I3 = 0. Preis:
 * +13,6 % Kabelweg im ELK-Pfad (complex 8 396 → 9 540 px) — wie in ADR 0027
 * benannt und in Kauf genommen.
 *
 * `elk.spacing.nodeNode` (Karten derselben Spalte) bleibt bei
 * `portFacingClearance`: Dort ist der Engpass die Port-Staffel am Bauteil,
 * nicht der Trassen-Korridor.
 */
export const elkColumnSpacing = (tokens: RoutingTokens = ROUTING_TOKENS): number =>
  tokens.portFacingClearance + 2 * tokens.laneGrid;

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
    // Kartenabstand: ohne diese Zeile nahm ELK seinen Default (~10 px) und
    // „Plan ordnen" produzierte Pläne, die der Router nicht kollisionsfrei
    // verlegen kann (Finding 2026-09-27, ROUTE-BUG-32).
    'elk.spacing.nodeNode': String(tokens.portFacingClearance),
    // Korridor zwischen den Rollen-Spalten: portFacingClearance + 2·laneGrid
    // (Herleitung und Messung in `elkColumnSpacing`, ADR 0028). Mit der
    // Port-Freigabe allein (68 px) bleiben im ELK-Pfad zwei parallele Trassen
    // auf derselben Linie (I2) — der Korridor ist dann von den Handle-Boxen
    // bis auf 26 px eingeengt.
    'elk.layered.spacing.nodeNodeBetweenLayers': String(elkColumnSpacing(tokens)),
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
 * Gerankte Rollen-Schichten (ADR 0024): ELK bekommt die fachliche Reihenfolge
 * Quelle → Wandler → Verteilung → Wechselrichter → Verbraucher als
 * `layering.strategy: INTERACTIVE` — die x-Positionen der Knoten sind der
 * Seed (der Planner setzt sie auf `Rang × Layout-Token`).
 *
 * `considerModelOrder.strategy: PREFER_EDGES` hält den Modell-Vorzug als
 * Tie-Break, damit die Rollenfolge bei Gleichstand entscheidet, ohne das
 * Kreuzungsminimum zu verdrängen.
 *
 * BEWUSST NICHT enthalten (gemessen, Finding 2026-09-27):
 * `crossingMinimization.semiInteractive` friert die Reihenfolge INNERHALB der
 * Schicht ein und hebt damit die Kreuzungsminimierung auf — mit ihm stiegen
 * die Kreuzungen der sechs Referenzpläne von 36 auf 44 (Σ, ELK-Platzierung +
 * Produktiv-Router); `cycleBreaking.strategy: INTERACTIVE` kostete weitere 11
 * (Σ 47). Beides bleibt dem echten Nutzerplatzierungs-Modus
 * (`generateElkInteractiveOptions`) vorbehalten.
 */
export function generateElkRankedOptions(
  tokens: RoutingTokens = ROUTING_TOKENS,
  direction?: 'LR' | 'TB'
): Record<string, string> {
  return {
    ...generateElkLayoutOptions(tokens, direction),
    'elk.layered.layering.strategy': 'INTERACTIVE',
    'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',
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
