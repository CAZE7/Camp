import { type SegmentSpatialIndex } from '../geometry/segmentSpatialIndex';
import {
  classifySegmentAgainstSegment,
  domainSeparationRules,
  requiredClearanceBetween,
  type RoutingDomain,
} from './collision';
import { distanceSegmentToSegment, EPS, type Point, type Rect, type Segment } from '../geometry';
import { ROUTING_TOKENS, type RoutingTokens } from '../tokens';
import {
  isPortBundleOverlap,
  isPortBundleProximity,
  routedPathGeometry,
  type RoutedPathGeometry,
} from './portBundle';

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
 * | near-obstacle (EDT) | GATED       | 0 × laneGrid = 0 (Token-Gate Stufe 1; Anhebung erst Stufe 2 mit begründetem Recapture, Mission) |
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
 * Was fehlt, ist die *räumliche* Hälfte: `segmentExtraCost` und
 * `preferredLaneBonus` haben keinen Produktiv-Konsumenten. Das ist **kein**
 * vergessener Stecker, sondern eine gemessene Grenze (ROUTE-002 Teil 2, 3):
 *
 * - **`segmentExtraCost`** verwirft ohne Stub-Kenntnis jedes legitime Bündel
 *   als `Infinity` (gemessen: 47 `hard`-Paare über die sechs Referenzpläne,
 *   **alle** Port-Bündel, echte I2-Verstöße 0). Es kann die Ausnahme seit
 *   2026-09-27 entgegennehmen (`options.portBundle`, ADR 0025), und die
 *   Anbindung an den Suchloop wurde gebaut und gemessen (Teil 2b) — sie fand
 *   in 7 von 8 Fällen keinen überdeckungsfreien Kandidaten, änderte im
 *   Produktivpfad nur Geometrie, die der Nudge ohnehin bereinigt, und wurde
 *   deshalb **nicht ausgeliefert**.
 * - **`preferredLaneBonus`** zieht Trassen auf die Registry-Lane. Das
 *   Potenzial dafür ist gemessen (`npm run routing:lane-probe`: über 428
 *   Ideal-Segmente sind 50 im ELK-Pfad und 22 im Fest-Raster **frei und
 *   unbenutzt**) — die vier gebauten Varianten einer Verdrahtung sind es aber
 *   nicht wert: Jede kostet an anderer Stelle mehr, als sie bringt. Die beste
 *   (Bonus nur in der Bewertung, ohne A*-Gitterlinie) senkt die Kreuzungen im
 *   ELK-Pfad 107 → 104 und kürzt `acdc` um 483 px, verlängert aber `complex`
 *   um 44 px — und die Längen-Ratchet verbietet ausdrücklich, die Baseline
 *   dafür anzuheben (`scripts/routing/cableLength.test.ts`). Ursache der
 *   +44 px ist eine Tube-/Envelope-Kaskade des gierigen Routings, nicht der
 *   Bonus-Entscheid selbst.
 *
 * Beide bleiben damit bewusst ohne Produktiv-Konsumenten; wer sie anschließt,
 * nimmt `npm run routing:lane-probe` als Gegenprobe und `npm run
 * routing:audit` + `npm run test:regression` als Wächter.
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
  /**
   * Nähe zu einem Hindernis im A\\*-Suchlauf (Stufe-1-Plumbing der EDT,
   * `lib/routing/geometry/edt.ts`): Zuschlag pro Schritt, wenn
   * $d^2 <$ `cableClearance`² (wurzelfrei, §2.2″).
   *
   * **Bewusst 0** (Token `edtNearObstaclePerLaneGrid`): Der Golden Master
   * ist byte-stabil, solange der Faktor 0 ist — die Kantengewichte bleiben
   * identisch. Die Anhebung ist Stufe 2 der Mission und erfordert einen
   * begründeten Golden-Master-/Regression-Recapture mit Ledger-Eintrag;
   * der Drift-Guard in `costModel.test.ts` friert den Wert ein.
   */
  readonly edtNearObstacle: number;
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
  /**
   * Stufe 1 (Mission, EDT-Integration `edt.ts` → `hananAStar`): Zuschlag in
   * laneGrid-Einheiten pro Schritt innerhalb der Clearance-Umgebung.
   * Explizit **0** — Token-Gate statt totem Code: Der Suchlauf baut nur dann
   * ein Distanzfeld und wendet Zuschläge an, wenn dieser Faktor > 0 ist;
   * bei 0 ist die Ausführung bitweise dieselbe wie vor Stufe 1 (Golden
   * Master byte-stabil). Anhebung erst in Stufe 2 mit begründetem Recapture;
   * eingefroren in `costModel.test.ts`.
   */
  edtNearObstaclePerLaneGrid: 0,
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
    edtNearObstacle: COST_FACTORS.edtNearObstaclePerLaneGrid * tokens.laneGrid,
    freeSpace: 0,
  });
}

/** Default-Gewichte (Spec-Tokens). */
export const COST_WEIGHTS: CostWeights = buildCostWeights();

/**
 * Mission Stufe 3 — Pass-Gates der plattformneutralen Bausteine
 * (`docs/ai/GPU-ROUTING-ARCH.md` §8: „Konfliktgraph-Batching“ und
 * „px-Ganzzahlskala + Sättigung“ — beide „auch ohne GPU wertvoll“).
 *
 * Beide Gates stehen auf **0**: Der Golden Master und die Regressions-SVGs
 * sind byte-stabil, solange die Pässe aus sind (Gesetz jeder Mission-Stufe).
 * Aktivierung (1) erfordert einen begründeten Recapture mit Ledger —
 * gemessene A/B-Zahlen liefert `npm run routing:conflict-probe`.
 *
 * Drift-Guard in `costModel.test.ts`: Defaults frieren auf 0, Struktur
 * unverändert — derselbe Einbau wie `edtNearObstaclePerLaneGrid`.
 */
export const ROUTING_GATES = Object.freeze({
  /** Arbeitsreihenfolge in `routeAllCables` über den Konfliktgraphen (0/1). */
  conflictGraphBatching: 0 as number,
  /**
   * A*-Label in ganzzahligen Milli-px mit Sättigung (0/1).
   *
   * **Eingefroren auf 0** — gemessen 2026-09-28: Mit 1 bricht der kalte
   * Golden Master (`test:goldenmaster`) den Plan `acdc` (Waypoint x 669 →
   * 698,4 px), der Längen-Ratchet (`cableLength.test`, acdc ≤ 5710 px) und
   * `domainProbe.test` (eingefrorene Summe) — auch wenn `test:regression`
   * (50/50) hielt. Der erste A/B-Lauf der Probe hatte das Gegenteil
   * „bewiesen“, weil `requestKey` den Modus nicht kannte (Cache-Treffer der
   * Float-Variante); der Modus gehört deshalb seit Stufe 3 in den
   * Cache-Schlüssel, und die Probe leert den Cache zwischen den Läufen.
   * Aktivierung erst mit begründetem Recapture-Ledger (bessere Zahl als
   * 5710 px, sonst Längen-Ratchet-Verbot).
   */
  integerMilliPxCosts: 0 as number,
});

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

/* ------------------------------------------------------------------ *
 * Zentrales Kostenmodell: Kandidat gegen bereits liegende Trassen
 * ------------------------------------------------------------------ */

/**
 * Eine bereits geroutete Trasse, gegen die ein Kandidat bewertet wird.
 *
 * Die Domäne (`electrical` / `water` / `dc12` / `ac230`) kommt aus derselben
 * Quelle wie Anzeige, Dimensionierung und Endvalidierung
 * (`routingDomainOf` → `buildDomainSeparationRules`) — es gibt keine zweite,
 * konkurrierende Klassifikation.
 */
export type PriorRoute = {
  readonly id: string;
  readonly waypoints: readonly Point[];
  readonly domain?: RoutingDomain;
};

/**
 * Alle Kostenklassen des zentralen Modells (Doku §7):
 *
 *   HARD           — Überlappung zweier Trassen: physisch unmöglich → `Infinity`.
 *   SOFT           — Kreuzung: zulässig, teuer.
 *   WEIGHTED       — Abstand < Freigabe: stetig gewichtet, je enger desto teurer.
 *   BUNDLE_SHARED  — gemeinsames Port-Bündel: zulässig, kleiner Aufschlag.
 *   FREE           — nichts von alldem.
 */
export const ROUTE_COST_CLASSES = ['HARD', 'SOFT', 'WEIGHTED', 'BUNDLE_SHARED', 'FREE'] as const;
export type RouteCostClass = (typeof ROUTE_COST_CLASSES)[number];

const costClassRank = (cls: RouteCostClass): number => ROUTE_COST_CLASSES.indexOf(cls);

/**
 * Gewichte des zentralen Modells. Sie stehen genau einmal hier — kein Modul
 * rechnet eine eigene Nähe-/Kreuzungsstrafe (Doku §7).
 *
 * `clearanceCostPerPx` greift pro fehlendem Pixel bis zur Freigabe; damit ist
 * „zu nah" nicht binär, sondern stetig: von zwei Kandidaten unterhalb der
 * Freigabe gewinnt der mit MEHR Abstand.
 */
export type RouteCostWeights = {
  /** Aufschlag für eine Kreuzung mit einer bereits liegenden Trasse. */
  readonly crossingCost: number;
  /** Aufschlag pro fehlendem Pixel bis zur (domänenabhängigen) Freigabe. */
  readonly clearanceCostPerPx: number;
  /** Aufschlag für das Teilen eines Port-Bündels (erlaubt, aber nicht frei). */
  readonly bundleSharedCost: number;
};

export const DEFAULT_ROUTE_COST_WEIGHTS: RouteCostWeights = Object.freeze({
  // Aus derselben Matrix wie der A*-Lauf (`COST_WEIGHTS`) — keine zweite
  // Zahlenquelle. 120 px je Kreuzung, 400 px bei 0 px Abstand.
  crossingCost: COST_WEIGHTS.crossing,
  // Stetig statt binär: die 400 px der Clearance-Verletzung fallen linear mit
  // dem Abstand ab — 12 px Abstand kosten 0, 6 px kosten 200. Damit gewinnt
  // von zwei zu engen Kandidaten der entferntere (Doku §6/§9).
  clearanceCostPerPx: COST_WEIGHTS.clearanceViolation / ROUTING_TOKENS.cableClearance,
  bundleSharedCost: 4,
});

export type RoutePairCost = {
  /** Kosten dieses Paares (endlich, außer bei harter Überlappung). */
  readonly cost: number;
  /** Schwerste Kosteklasse dieses Paares. */
  readonly worstClass: RouteCostClass;
  /** Angewandte (domänenabhängige) Freigabe in px. */
  readonly clearance: number;
  /** Kleinster gemessener Segment-Abstand (Infinity, wenn vorab ausgeschlossen). */
  readonly minDistance: number;
  readonly crossings: number;
};

export type RouteCandidateCost = {
  readonly total: number;
  readonly worstClass: RouteCostClass;
  /** Harte Überlappung mit mindestens einer Trasse. */
  readonly hard: boolean;
  /**
   * Mindestens eine echte Freigabe-Unterschreitung (Kostenklasse
   * WEIGHTED). Nur sie — nicht der reine Bündel-Aufschlag — rechtfertigt
   * die teure Ausweich-Suche: Ein geteiltes Port-Bündel ist zulässig und
   * in jedem dichten Plan der Normalfall.
   */
  readonly weighted: boolean;
  /** Summe der Fehlbeträge bis zur Freigabe (Doku §9 „Bündel-Abstand"). */
  readonly bundleDistance: number;
  readonly crossings: number;
  readonly byPrior: readonly RoutePairCost[];
};

/** Vorberechnete Geometrie einer Prior-Trasse + Bounding-Box für den Vorfilter. */
export type PreparedPriorRoute = {
  readonly id: string;
  readonly segments: readonly Segment[];
  readonly geometry: RoutedPathGeometry;
  readonly domain?: RoutingDomain;
  readonly box: Rect;
};

const boundsOf = (points: readonly Point[]): Rect => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

/** Achsenparallele Bounding-Box eines Pfades. */
export const pathBounds = (waypoints: readonly Point[]): Rect => boundsOf(waypoints);

const boxesWithin = (a: Rect, b: Rect, gap: number): boolean =>
  a.x - gap <= b.x + b.width + EPS &&
  b.x - gap <= a.x + a.width + EPS &&
  a.y - gap <= b.y + b.height + EPS &&
  b.y - gap <= a.y + a.height + EPS;

/**
 * Bereitet Prior-Trassen EINMALIG auf — `pathAgainstPriorCost` ist danach
 * O(1) pro Paar dank Box-Vorfilter (PERF-001: die teure
 * Segment/Segment-Klassifikation läuft nur bei echter Nähe).
 */
export function preparePriorRoutes(
  routes: readonly PriorRoute[],
  tokens: RoutingTokens = ROUTING_TOKENS,
): PreparedPriorRoute[] {
  const pad = Math.max(tokens.crossDomainSpacing, tokens.cableClearance);
  const out: PreparedPriorRoute[] = [];
  for (const r of routes) {
    if (r.waypoints.length < 2) continue;
    const geometry = routedPathGeometry(r.waypoints);
    const b = boundsOf(r.waypoints);
    out.push({
      id: r.id,
      segments: geometry.segments,
      geometry,
      domain: r.domain,
      box: { x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad },
    });
  }
  return out;
}

/**
 * Domänenabhängige Freigabe zwischen zwei Kanten. Ohne Domäneninformation
 * (bzw. ohne Paar-Regel) gilt `cableClearance`.
 */
export const clearanceForPair = (
  own: RoutingDomain | undefined,
  other: RoutingDomain | undefined,
  tokens: RoutingTokens = ROUTING_TOKENS
): number =>
  own && other
    ? requiredClearanceBetween(own, other, domainSeparationRules, tokens)
    : tokens.cableClearance;

/**
 * Kosten eines Kandidaten gegen EINE bereits liegende Trasse.
 *
 * Die Freigabe ist domänenabhängig (`crossDomainSpacing` = 24 px zwischen
 * `electrical` ↔ `water` und `ac230` ↔ `dc12`, sonst `cableClearance`
 * = 12 px). Damit gilt die Domänentrennungsregel WÄHREND der Wegsuche und
 * nicht erst in der Abschlussvalidierung (Doku §8–§10).
 */
export function pathAgainstPriorCost(
  waypoints: readonly Point[],
  ownSegments: readonly Segment[],
  prior: PreparedPriorRoute,
  ownDomain?: RoutingDomain,
  tokens: RoutingTokens = ROUTING_TOKENS,
  weights: RouteCostWeights = DEFAULT_ROUTE_COST_WEIGHTS,
  domainOnly = false
): RoutePairCost {
  const clearance = clearanceForPair(ownDomain, prior.domain, tokens);
  const ownGeometry = routedPathGeometry(waypoints);
  let cost = 0;
  let crossings = 0;
  let worstClass: RouteCostClass = 'FREE';
  let minDistance = Infinity;
  const bump = (cls: RouteCostClass) => {
    if (costClassRank(cls) < costClassRank(worstClass)) worstClass = cls;
  };

  for (const own of ownSegments) {
    for (const other of prior.segments) {
      const verdict = classifySegmentAgainstSegment(own, other, clearance);
      if (verdict.class === 'none') continue;
      if (verdict.class === 'soft') {
        crossings += 1;
        cost += weights.crossingCost;
        bump('SOFT');
        continue;
      }
      const d = verdict.distance ?? 0;
      if (d < minDistance) minDistance = d;
      if (verdict.class === 'hard' || d <= EPS) {
        // Kollineare Überlappung — zulässig nur im gemeinsamen Port-Bündel.
        if (
          isPortBundleOverlap(ownGeometry, prior.geometry, own, other)
        ) {
          cost += weights.bundleSharedCost;
          bump('BUNDLE_SHARED');
          continue;
        }
        return {
          cost: Number.POSITIVE_INFINITY,
          worstClass: 'HARD',
          clearance,
          minDistance: d,
          crossings,
        };
      }
      // Abstand unterhalb der (domänenabhängigen) Freigabe.
      if (
        isPortBundleProximity(
          ownGeometry,
          prior.geometry,
          own,
          other,
          tokens.portFacingClearance
        )
      ) {
        cost += weights.bundleSharedCost;
        bump('BUNDLE_SHARED');
        continue;
      }
      cost += weights.clearanceCostPerPx * (clearance - d);
      bump('WEIGHTED');
    }
  }
  return { cost, worstClass, clearance, minDistance, crossings };
}

const FREE_PAIR: RoutePairCost = {
  cost: 0,
  worstClass: 'FREE',
  clearance: 0,
  minDistance: Infinity,
  crossings: 0,
};

/** Gesamtkosten eines Kandidaten gegen ALLE bereits liegenden Trassen. */
export function candidateCost(
  waypoints: readonly Point[],
  priors: readonly PreparedPriorRoute[],
  ownDomain?: RoutingDomain,
  tokens: RoutingTokens = ROUTING_TOKENS,
  weights: RouteCostWeights = DEFAULT_ROUTE_COST_WEIGHTS,
  domainOnly = false
): RouteCandidateCost {
  if (priors.length === 0) {
    return {
      total: 0,
      worstClass: 'FREE',
      hard: false,
      weighted: false,
      bundleDistance: 0,
      crossings: 0,
      byPrior: [],
    };
  }
  const ownSegments = routedPathGeometry(waypoints).segments;
  const ownBox = boundsOf(waypoints);
  const reach = Math.max(tokens.crossDomainSpacing, tokens.cableClearance);

  let total = 0;
  let hard = false;
  let weighted = false;
  let crossings = 0;
  let bundleDistance = 0;
  let worstClass: RouteCostClass = 'FREE';
  const byPrior: RoutePairCost[] = [];

  for (const prior of priors) {
    if (!boxesWithin(ownBox, prior.box, reach)) {
      byPrior.push(FREE_PAIR);
      continue;
    }
    const pair = pathAgainstPriorCost(
      waypoints,
      ownSegments,
      prior,
      ownDomain,
      tokens,
      weights,
      domainOnly
    );
    byPrior.push(pair);
    if (pair.worstClass === 'HARD') hard = true;
    if (!Number.isFinite(pair.cost)) {
      total = Number.POSITIVE_INFINITY;
      continue;
    }
    total += pair.cost;
    crossings += pair.crossings;
    if (pair.worstClass === 'WEIGHTED') {
      weighted = true;
      bundleDistance += Math.max(0, pair.clearance - pair.minDistance);
    }
    if (costClassRank(pair.worstClass) < costClassRank(worstClass)) worstClass = pair.worstClass;
  }
  return { total, worstClass, hard, weighted, bundleDistance, crossings, byPrior };
}

/**
 * Rangfolge zweier Kandidaten (Doku §6, §7, §9).
 *
 *   1. harte Überlappung vermeiden (unendliche Kosten)
 *   2. gewichtete Gesamtkosten (Nähe + Kreuzungen)
 *   3. Bündel-Abstand — gewinnt der Kandidat, der gemeinsame Wege am LÄNGSTEN
 *      mit genügend Abstand nutzt (§9)
 *   4. Länge
 *   5. Reihenfolge im Kandidaten-Array (deterministischer Stich)
 *
 * Rückgabe < 0, wenn `a` besser ist.
 */
export function compareCandidates(
  a: RouteCandidateCost,
  b: RouteCandidateCost,
  aLength: number,
  bLength: number
): number {
  if (a.hard !== b.hard) return a.hard ? 1 : -1;
  if (a.total !== b.total) return a.total - b.total;
  if (a.bundleDistance !== b.bundleDistance) return a.bundleDistance - b.bundleDistance;
  if (aLength !== bLength) return aLength - bLength;
  return 0;
}
