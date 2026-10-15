import {
  countBends,
  manhattan,
  simplifyWaypoints,
  waypointsToSegments,
  type Point,
  type Rect,
  type Segment,
} from '../geometry';
import { ROUTING_TOKENS, type RoutingTokens } from '../tokens';
import { COST_WEIGHTS, type CostWeights } from './costModel';
import { classifySegmentAgainstNode, classifySegmentAgainstSegment } from './collision';
import {
  isPortBundleOverlap,
  isPortBundleProximity,
  portBundleSizes,
  routedPathGeometry,
} from './portBundle';

/**
 * Transform-Akzeptanzregel (A1) — EIN Vertrag für alle Nachbearbeitungs-Schritte.
 *
 * Die Nachbearbeitung des Produktivrouters besteht aus drei Schritten, die
 * jeweils eigene Annahme-Bedingungen mitbringen:
 *
 *   1. `nudgeOrthogonalPaths` (`components/edges/utils/nudge.ts`) — löst
 *      kollineare Überlappungen auf. Annahme: orthogonal, stubsicher,
 *      hindernisfrei und `routeDefectScore` nicht schlechter.
 *   2. `mergeCloseBends` (`lib/routing/geometry/polyline.ts`, verdrahtet in
 *      `routeAll.ts`) — löst Treppen. Annahme: kürzere Punktliste, orthogonal,
 *      hindernisfrei, `routeDefectScore` nicht schlechter.
 *   3. `separateCableClearance` (`components/edges/utils/separation.ts`) —
 *      stellt die Kabel-Freigabe her. Annahme: streng sinkende Verstoßzahl,
 *      keine neue harte Überdeckung, keine neue Kreuzung, kein neues
 *      Hindernis.
 *
 * Keine dieser Bedingungen prüft den GESAMTEN Katalog: `routeDefectScore`
 * kennt nur I4/I6/Selbstüberlappung, der Trenngang zählt Freigabe-Verstöße,
 * aber nicht Länge oder Biegungen. Ein Schritt kann also legal annehmen und
 * dabei **einen anderen** Wert verschlechtern — genau der Befund
 * „Optimieren macht den Plan unübersichtlicher" (C→D-Degradation, A1/T-3).
 *
 * Diese Datei schließt die Lücke mit einer einzigen, messbaren Regel:
 *
 * | Fall                                         | Entscheidung                              |
 * | -------------------------------------------- | ----------------------------------------- |
 * | Kandidat unverändert                         | annehmen (No-Op)                          |
 * | neue HARTE Verletzung (I1/I2)                | **verwerfen**                             |
 * | weniger harte Verletzungen                   | annehmen (stärkste Währung)               |
 * | mehr gewichtete Verletzungen (I3)            | nur bei nachweislich besserem Gesamtscore |
 * | wertgleich, kein nachweisbarer Gewinn         | Kandidat **verwerfen** (Stabilität); wertgleicher SCHRITT bleibt (s. u.) |
 *
 * **Verdrahtung (gemessen 2026-10-14):** Der Produktivpfad wendet die Regel
 * als **Kettenregel auf den ganzen Nachbearbeitungs-Block** an
 * (`acceptTransformChain` in `routeAll.ts`: Nudge → Bend-Merge → Kabel- →
 * Domain-Trenngang, Endstand D gegen Rohstand C). Ein Netzgatter je Schritt
 * wurde gebaut und verworfen: Es ändert die Eingabe der folgenden Schritte
 * und damit den Endplan, ohne dass der Endplan besser wäre — über die 49
 * Versätze des Plans `simple` kostete es 8 × I3 (zwei Versätze 0 → 4, Summe
 * 25 → 33), während die Blockfassung dort messgleich bleibt. Die
 * Kandidaten-Fassung (`acceptTransform`) bleibt der Ebene *innerhalb* eines
 * Schritts vorbehalten; dort gilt sie streng („wertgleich ohne Gewinn ⇒
 * verwerfen"), denn es gibt keine Folgekette. Der Trenngang erfüllt diese
 * Bedingungen bereits durch seine eigenen, teils strengeren Prädikate
 * (`candidateImproves` verlangt streng sinkende Verstoßzahl, kein neues
 * Hard-Overlap, keine neue Kreuzung; `candidateIsAcceptable` prüft
 * Orthogonalität, Stubs und Defekt-Score).
 *
 * Das **Längenbudget** (ΔLänge ≤ 0,5 %) ist ein Kriterium der KETTE
 * (`acceptTransformChain`, Zustand D gegen C) und des A1-Tests — nicht jedes
 * einzelnen Kandidaten. Ein Ausweichzug um 2 × `cableClearance` kostet auf
 * einer kurzen Kante leicht mehr als 0,5 %; ihn deshalb zu verbieten wäre
 * ein Platzierungsverbot, kein Qualitätsschutz.
 *
 * Der „Gesamtscore" ist der produktive Kostenkatalog (`COST_WEIGHTS` aus
 * `costModel.ts`) — Länge + Biegungen + Kreuzungen + Freigabe-Verstöße +
 * Kehren in px-Äquivalenten. Es gibt keine zweite Währung.
 *
 * Die Messung liest DIESELBEN Regeln wie das Final-Gate
 * (`lib/routing/invariants.ts`): `classifySegmentAgainstNode` / …Segment
 * (ADR 0019), die Port-Bündel-Ausnahmen `isPortBundleOverlap` /
 * `isPortBundleProximity` (ADR 0009/0025/0031/0034) und die Tokens. Damit
 * zählt die Regel genau die Verletzungen, die `checkInvariants` meldet —
 * `transformAcceptance.test.ts` friert diese Gleichheit ein.
 *
 * Rein geometrisch, deterministisch, ohne Seiteneffekte (ADR 0010).
 */

/** Kante, die bewertet wird — nur die Identität, die die Ausnahmen brauchen. */
export type AcceptanceEdge = {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly waypoints: readonly Point[];
};

/** Bauteil-Box, gegen die geprüft wird (ROHbox, wie I1/I3 sie lesen). */
export type AcceptanceNodeRect = Rect & { readonly id: string };

/**
 * Die Kollisionswelt eines Bewertungslaufs: die ROHboxen aller Bauteile und
 * die bereits liegenden Trassen der übrigen Kanten. Bewusst die rohen Boxen —
 * die aufgeblähte Variante (OBSTACLE_MARGIN) wäre strenger als das Gate.
 */
export type CollisionWorld = {
  readonly nodes: readonly AcceptanceNodeRect[];
  readonly others: readonly AcceptanceEdge[];
  /**
   * Paarweise Mindestfreigabe zwischen zwei Kanten (A2/ADR 0038): 24 px für
   * `electrical ↔ water` und `ac230 ↔ dc12`, sonst `cableClearance`.
   * Fehlt die Angabe, gilt überall `cableClearance` — das alte Verhalten.
   *
   * Ohne diese Größe wäre der domänenbewusste Trenngang für die Regel
   * unsichtbar: Er senkt die 24-px-Verstöße, die die Messung mit 12 px gar
   * nicht sieht — der Schritt erschiene als „Umbau ohne Gewinn" und würde
   * verworfen (gemessen 2026-10-14 am Plan `complex`).
   */
  readonly pairClearance?: (a: string, b: string) => number;
};

/** Verletzungs-/Qualitätsbilanz einer Trasse gegen die Welt. */
export type TransformMeasure = {
  /** Harte Verletzungen: I1 (fremdes Bauteil) + I2 (kollineare Überdeckung). */
  readonly hard: number;
  /** Gewichtete Verletzungen: I3 (Freigabe unterschritten, ohne Berührung). */
  readonly weighted: number;
  /** Echte Kreuzungen (soft, I10 — minimieren, nicht verbieten). */
  readonly crossings: number;
  /** 90°-Biegungen. */
  readonly bends: number;
  /** Kehren an den Handles (I4). */
  readonly uTurns: number;
  /** Gesamtlänge in px. */
  readonly length: number;
};

/**
 * Zugelassenes Längenwachstum eines Nachbearbeitungs-Schritts (Anteil).
 *
 * 0,5 % ist die Akzeptanzgrenze des A1-Auftrags („ΔLänge ≤ 0,5 %") und
 * gleichzeitig die Schranke der Regel: Ein Schritt darf Freigabe kaufen, aber
 * nicht beliebig teuer. Gemessen über die Referenzpläne wächst in der
 * Nachbearbeitung keine Kante um mehr als 0,5 % (siehe
 * `docs/routing/OPTIMIZE-DIAGNOSIS.md`) — der Wert ist damit keine Duldung,
 * sondern die dokumentierte Obergrenze des C→D-Übergangs.
 */
export const MAX_TRANSFORM_LENGTH_GROWTH = 0.005;

const EPS = 1e-6;

/** Warum die Regel so entschieden hat — Teil der Diagnose, nicht Kosmetik. */
export type TransformReason =
  | 'unchanged'
  | 'hard-increase'
  | 'fewer-hard-violations'
  | 'length-budget'
  | 'weighted-increase-without-score'
  | 'no-strict-gain'
  | 'value-equal'
  | 'strictly-better'
  | 'fewer-weighted-violations';

export type TransformDecision = {
  readonly accepted: boolean;
  readonly reason: TransformReason;
  readonly before: TransformMeasure;
  readonly after: TransformMeasure;
  readonly scoreBefore: number;
  readonly scoreAfter: number;
};

/** Zwei Wegpunktfolgen identisch (EPS)? */
export function sameWaypoints(a: readonly Point[], b: readonly Point[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const pa = a[i];
    const pb = b[i];
    if (!pa || !pb) return false;
    if (Math.abs(pa.x - pb.x) > EPS || Math.abs(pa.y - pb.y) > EPS) return false;
  }
  return true;
}

const foreignNodes = (edge: AcceptanceEdge, world: CollisionWorld): AcceptanceNodeRect[] =>
  world.nodes.filter((node) => node.id !== edge.source && node.id !== edge.target);

/** Hüllbox einer Segmentliste — Vorprüfung, bevor klassifiziert wird. */
type BBox = { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };

const bboxOf = (segments: readonly Segment[]): BBox | null => {
  if (segments.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [a, b] of segments) {
    minX = Math.min(minX, a.x, b.x);
    minY = Math.min(minY, a.y, b.y);
    maxX = Math.max(maxX, a.x, b.x);
    maxY = Math.max(maxY, a.y, b.y);
  }
  return { minX, minY, maxX, maxY };
};

/**
 * Liegen zwei Hüllboxen weiter als `gap` auseinander? Dann kann kein
 * Segmentpaar die Freigabe unterschreiten, sich kreuzen oder überdecken —
 * dieselbe ergebnisneutrale Vorprüfung wie in `classifySegmentAgainstSegment`
 * (PERF-002), nur einmal je Kantenpaar statt je Segmentpaar.
 */
const boxesApartByMoreThan = (a: BBox, b: BBox, gap: number): boolean =>
  a.minX > b.maxX + gap || b.minX > a.maxX + gap || a.minY > b.maxY + gap || b.minY > a.maxY + gap;

/**
 * Zählt die Verletzungen und Qualitätswerte einer Trasse gegen die Welt.
 *
 * Die Reihenfolge der Prüfungen ist der Vertrag aus `rules/collision.ts`:
 * Overlap (hard) → Crossing (soft) → Touch/Clearance (weighted). Die
 * Port-Bündel-Ausnahmen werden mit denselben Funktionen angewandt wie im
 * Final-Gate — kein zweites Regelverständnis.
 */
export function measureTransform(
  edge: AcceptanceEdge,
  world: CollisionWorld,
  tokens: RoutingTokens = ROUTING_TOKENS
): TransformMeasure {
  const geometry = routedPathGeometry(edge.waypoints);
  const segments = geometry.segments;
  const clearance = tokens.cableClearance;
  const ownBox = bboxOf(segments);

  let hard = 0;
  let weighted = 0;
  let crossings = 0;

  // ── I1/I3: Segment × fremdes Bauteil ─────────────────────────────────────
  for (const rect of foreignNodes(edge, world)) {
    for (const segment of segments) {
      const verdict = classifySegmentAgainstNode(segment, rect, clearance);
      if (verdict.class === 'hard') hard += 1;
      else if (verdict.class === 'weighted') weighted += 1;
    }
  }

  // ── I2: Selbstüberlappung derselben Kante ────────────────────────────────
  // Eine Selbstüberlappung je Kante reicht (wie I2 in `invariants.ts`).
  if (hasSelfOverlap(segments, clearance)) hard += 1;

  // ── I2/I3/I10: Segment × Segment fremder Kanten ───────────────────────────
  const bundleSizes = portBundleSizes([
    { id: edge.id, waypoints: edge.waypoints },
    ...world.others.map((other) => ({ id: other.id, waypoints: other.waypoints })),
  ]);
  for (const other of world.others) {
    if (other.id === edge.id) continue;
    const otherGeometry = routedPathGeometry(other.waypoints);
    // Geltende Paar-Freigabe (Domänenregel, sonst `cableClearance`).
    const pair = Math.max(clearance, world.pairClearance?.(edge.id, other.id) ?? clearance);
    // Vorprüfung über Hüllboxen: Liegen die Trassen weiter als die Freigabe
    // auseinander, kann kein Segmentpaar etwas beitragen (PERF-002).
    const otherBox = bboxOf(otherGeometry.segments);
    if (!ownBox || !otherBox || boxesApartByMoreThan(ownBox, otherBox, pair)) continue;
    let overlapFound = false;
    for (const s1 of segments) {
      for (const s2 of otherGeometry.segments) {
        const verdict = classifySegmentAgainstSegment(s1, s2, pair);
        if (verdict.class === 'hard') {
          if (!isPortBundleOverlap(geometry, otherGeometry, s1, s2)) overlapFound = true;
          continue;
        }
        if (verdict.class === 'soft') {
          crossings += 1;
          continue;
        }
        if (verdict.class === 'weighted') {
          if (isPortBundleProximity(geometry, otherGeometry, s1, s2, tokens.portFacingClearance, bundleSizes))
            continue;
          // Gewertet wird gegen die PAAR-Freigabe: Ein Paar, das 12 px hält,
          // aber 24 px fordern muss (Domänenregel), ist ein Verstoß — die
          // Basis-Freigabe ist davon unberührt.
          const distance = verdict.distance ?? 0;
          if (distance < pair - EPS) weighted += 1;
        }
      }
    }
    if (overlapFound) hard += 1;
  }

  // ── Qualitätswerte ───────────────────────────────────────────────────────
  let length = 0;
  for (const segment of segments) length += manhattan(segment[0], segment[1]);

  return {
    hard,
    weighted,
    crossings,
    bends: countBends(simplifyWaypoints(edge.waypoints)),
    uTurns: countHandleUTurns(segments),
    length,
  };
}

/** Länge einer Wegpunktfolge (nur Achsen, wie `pathLength`). */
function pathLengthOf(waypoints: readonly Point[]): number {
  const segments = waypointsToSegments(simplifyWaypoints(waypoints));
  let length = 0;
  for (const segment of segments) length += manhattan(segment[0], segment[1]);
  return length;
}

/** Überdecken sich zwei Segmente DERSELBEN Kante kollinear (I2, ROUTE-011)? */
function hasSelfOverlap(segments: readonly Segment[], clearance: number): boolean {
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const s1 = segments[i];
      const s2 = segments[j];
      if (!s1 || !s2) continue;
      if (classifySegmentAgainstSegment(s1, s2, clearance).class === 'hard') return true;
    }
  }
  return false;
}

/** I4-Muster: Kehre zwischen den ersten bzw. letzten beiden Segmenten. */
function countHandleUTurns(segments: readonly Segment[]): number {
  if (segments.length < 2) return 0;
  let count = 0;
  const isUTurn = (s1: Segment, s2: Segment): boolean => {
    const d1 = { x: Math.sign(s1[1].x - s1[0].x), y: Math.sign(s1[1].y - s1[0].y) };
    const d2 = { x: Math.sign(s2[1].x - s2[0].x), y: Math.sign(s2[1].y - s2[0].y) };
    return d1.x === -d2.x && d1.y === -d2.y && (d1.x !== 0 || d1.y !== 0);
  };
  if (isUTurn(segments[0]!, segments[1]!)) count += 1;
  const n = segments.length;
  if (isUTurn(segments[n - 2]!, segments[n - 1]!)) count += 1;
  return count;
}

/**
 * Gesamtscore einer Bilanz — die produktive Währung (`COST_WEIGHTS`).
 *
 * Harte Verletzungen sind **kein Preis, sondern ein Verbot** (ADR 0009) und
 * gehen deshalb NICHT in den Score ein: Sie werden davor lexikografisch
 * verglichen (erst `hard`, dann `weighted`, dann dieser Score). Ein
 * `hard`-Gewicht von `Infinity` wäre hier auch sachlich falsch — der
 * Rohzustand C enthält selbst harte Verletzungen (Überdeckungen, die die
 * Nachbearbeitung erst auflöst), und `Infinity → Infinity` macht jeden
 * Vergleich blind (gemessen 2026-10-14: der Nudge wurde dadurch als
 * „no-strict-gain" verworfen).
 */
export function transformScore(measure: TransformMeasure, weights: CostWeights = COST_WEIGHTS): number {
  return (
    measure.length +
    measure.bends * weights.bend +
    measure.crossings * weights.crossing +
    measure.weighted * weights.clearanceViolation +
    measure.uTurns * weights.uTurn
  );
}

/**
 * Lexikografischer Vergleich zweier Bilanzen, wie die Regel ihn fällt:
 * `-1` = Kandidat besser, `0` = wertgleich, `1` = Kandidat schlechter.
 * Reihenfolge: harte Verletzungen → gewichtete Verletzungen → Gesamtscore.
 */
export function compareTransform(
  candidate: TransformMeasure,
  before: TransformMeasure,
  weights: CostWeights = COST_WEIGHTS
): -1 | 0 | 1 {
  if (candidate.hard !== before.hard) return candidate.hard < before.hard ? -1 : 1;
  if (candidate.weighted !== before.weighted) return candidate.weighted < before.weighted ? -1 : 1;
  const a = transformScore(candidate, weights);
  const b = transformScore(before, weights);
  if (a < b - EPS) return -1;
  if (a > b + EPS) return 1;
  return 0;
}

export type TransformAcceptanceOptions = {
  readonly tokens?: RoutingTokens;
  readonly weights?: CostWeights;
  /** Zugelassenes Längenwachstum (Anteil), Standard `MAX_TRANSFORM_LENGTH_GROWTH`. */
  readonly maxLengthGrowth?: number;
  /** Vorberechnete „vorher"-Bilanz (spart die Doppelmessung im Aufrufer). */
  readonly beforeMeasure?: TransformMeasure;
};

/**
 * Die Regel: darf `candidate` die Trasse `before` ersetzen?
 *
 * `world` ist die Welt VOR dem Schritt (die anderen Kanten in ihrem alten
 * Zustand) — Bewertungen sind damit unabhängig von der Reihenfolge der
 * Annahmen und für jeden Kandidaten identisch (ADR 0010).
 */
export function acceptTransform(
  candidate: AcceptanceEdge,
  before: AcceptanceEdge,
  world: CollisionWorld,
  options: TransformAcceptanceOptions = {}
): TransformDecision {
  const tokens = options.tokens ?? ROUTING_TOKENS;
  const weights = options.weights ?? COST_WEIGHTS;

  const beforeMeasure = options.beforeMeasure ?? measureTransform(before, world, tokens);

  if (sameWaypoints(candidate.waypoints, before.waypoints)) {
    const score = transformScore(beforeMeasure, weights);
    return {
      accepted: true,
      reason: 'unchanged',
      before: beforeMeasure,
      after: beforeMeasure,
      scoreBefore: score,
      scoreAfter: score,
    };
  }

  const after = measureTransform(candidate, world, tokens);
  const scoreBefore = transformScore(beforeMeasure, weights);
  const scoreAfter = transformScore(after, weights);
  const base = {
    before: beforeMeasure,
    after,
    scoreBefore,
    scoreAfter,
  } as const;

  const verdict = compareTransform(after, beforeMeasure, weights);

  // 1. Neue harte Verletzung ⇒ verwerfen (I1/I2 sind Verbote, keine Preise).
  if (after.hard > beforeMeasure.hard) {
    return { ...base, accepted: false, reason: 'hard-increase' };
  }

  // 2. Weniger harte Verletzungen ⇒ annehmen. Harte Verletzungen sind die
  //    stärkste Währung — der Rohzustand C trägt sie, und wer sie auflöst,
  //    darf dafür Länge ausgeben (die NETTO-Grenze ΔLänge ≤ 0,5 % prüft die
  //    Regel über die ganze Kette, `acceptTransformStep`/Test).
  if (after.hard < beforeMeasure.hard) {
    return { ...base, accepted: true, reason: 'fewer-hard-violations' };
  }

  // 3. Mehr gewichtete Verletzungen ⇒ nur bei nachweislich besserem Score.
  if (after.weighted > beforeMeasure.weighted) {
    return {
      ...base,
      accepted: verdict === -1,
      reason: verdict === -1 ? 'strictly-better' : 'weighted-increase-without-score',
    };
  }

  // 4. Freigabe gekauft ⇒ annehmen (den Preis bewertet der Score; das
  //    Längenbudget gilt für die Kette, nicht für den Einzelzug).
  if (after.weighted < beforeMeasure.weighted) {
    return { ...base, accepted: true, reason: 'fewer-weighted-violations' };
  }

  // 5. Wertgleich ⇒ nur bei echtem Gewinn annehmen (Stabilität).
  if (verdict === -1) return { ...base, accepted: true, reason: 'strictly-better' };
  return { ...base, accepted: false, reason: 'no-strict-gain' };
}

/**
 * Plant-weite Bilanz — GENAU die Zählweise des Final-Gates
 * (`checkInvariants`): jede Kante gegen fremde Bauteile und gegen jede
 * ANDERE Kante genau einmal (i<j), plus Selbstüberlappung je Kante.
 *
 * `measureTransform` zählt bewusst je Kante gegen alle übrigen (für
 * Kandidaten-Entscheidungen richtig); über einen ganzen Plan summiert würde
 * damit jedes Kantenpaar doppelt zählen. Für Diagnose und Paritätstest
 * („die Regel spricht die Sprache des Gates") ist deshalb DIESE Funktion die
 * richtige: ihr `hard` ist I1 + I2, ihr `weighted` ist I3.
 */
export function measurePlan(
  edges: readonly AcceptanceEdge[],
  nodes: readonly AcceptanceNodeRect[],
  options: {
    readonly tokens?: RoutingTokens;
    readonly pairClearance?: (a: string, b: string) => number;
  } = {}
): TransformMeasure {
  const tokens = options.tokens ?? ROUTING_TOKENS;
  const clearance = tokens.cableClearance;
  let hard = 0;
  let weighted = 0;
  let crossings = 0;
  let bends = 0;
  let uTurns = 0;
  let length = 0;

  const geometries = new Map<string, ReturnType<typeof routedPathGeometry>>();
  for (const edge of edges) geometries.set(edge.id, routedPathGeometry(edge.waypoints));
  const bundleSizes = portBundleSizes(edges.map((e) => ({ id: e.id, waypoints: e.waypoints })));

  for (const edge of edges) {
    const geometry = geometries.get(edge.id)!;
    const ownBox = bboxOf(geometry.segments);
    // I1/I3: Segment × fremdes Bauteil.
    for (const rect of foreignNodes(edge, { nodes, others: [] })) {
      for (const segment of geometry.segments) {
        const verdict = classifySegmentAgainstNode(segment, rect, clearance);
        if (verdict.class === 'hard') hard += 1;
        else if (verdict.class === 'weighted') weighted += 1;
      }
    }
    // I2: Selbstüberlappung.
    if (hasSelfOverlap(geometry.segments, clearance)) hard += 1;
    // I2/I3/I10: Segment × Segment — nur gegen Kanten mit größerer ID, damit
    // jedes Paar genau einmal zählt (wie das Gate).
    for (const other of edges) {
      if (compareEdgeIds(other.id, edge.id) <= 0) continue;
      const otherGeometry = geometries.get(other.id)!;
      const pair = Math.max(clearance, options.pairClearance?.(edge.id, other.id) ?? clearance);
      const otherBox = bboxOf(otherGeometry.segments);
      if (!ownBox || !otherBox || boxesApartByMoreThan(ownBox, otherBox, pair)) continue;
      let overlapFound = false;
      for (const s1 of geometry.segments) {
        for (const s2 of otherGeometry.segments) {
          const verdict = classifySegmentAgainstSegment(s1, s2, pair);
          if (verdict.class === 'hard') {
            if (!isPortBundleOverlap(geometry, otherGeometry, s1, s2)) overlapFound = true;
            continue;
          }
          if (verdict.class === 'soft') {
            crossings += 1;
            continue;
          }
          if (verdict.class === 'weighted') {
            if (
              isPortBundleProximity(geometry, otherGeometry, s1, s2, tokens.portFacingClearance, bundleSizes)
            )
              continue;
            if ((verdict.distance ?? 0) < pair - EPS) weighted += 1;
          }
        }
      }
      if (overlapFound) hard += 1;
    }
    // Qualitätswerte je Kante (Summe über den Plan).
    for (const segment of geometry.segments) length += manhattan(segment[0], segment[1]);
    bends += countBends(simplifyWaypoints(edge.waypoints));
    uTurns += countHandleUTurns(geometry.segments);
  }

  return { hard, weighted, crossings, bends, uTurns, length };
}

/** Stabile Kanten-Reihenfolge — dieselbe Sortierung wie das Gate (`compareIds`). */
function compareEdgeIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Summe der Bilanzen über mehrere Kanten — dieselben Felder wie
 * `TransformMeasure`, additiv. Grundlage der Schritt-Regel.
 */
/** Wie `addMeasure`, aber ohne Länge — die kommt im Kettengatter aus der Plansumme. */
const addCounters = (a: TransformMeasure, b: TransformMeasure): TransformMeasure => ({
  hard: a.hard + b.hard,
  weighted: a.weighted + b.weighted,
  crossings: a.crossings + b.crossings,
  bends: a.bends + b.bends,
  uTurns: a.uTurns + b.uTurns,
  length: a.length,
});

const addMeasure = (a: TransformMeasure, b: TransformMeasure): TransformMeasure => ({
  hard: a.hard + b.hard,
  weighted: a.weighted + b.weighted,
  crossings: a.crossings + b.crossings,
  bends: a.bends + b.bends,
  uTurns: a.uTurns + b.uTurns,
  length: a.length + b.length,
});

export type StepDecision = {
  readonly accepted: boolean;
  readonly reason: TransformReason;
  /** Kanten, deren Trasse der Schritt verändert hat. */
  readonly changed: readonly string[];
  readonly before: TransformMeasure;
  readonly after: TransformMeasure;
  readonly scoreBefore: number;
  readonly scoreAfter: number;
};

/**
 * Schritt-Regel: darf der Nachbearbeitungs-Schritt seinen Ausgabestand
 * annehmen?
 *
 * Messgröße sind ausschließlich die VOM SCHRITT VERÄNDERTEN Kanten, beide
 * Seiten gegen dieselbe Welt (der Stand VOR dem Schritt). Unveränderte
 * Kanten tragen auf beiden Seiten identisch bei und fallen heraus.
 *
 * **Warum die Summe und nicht jede Kante einzeln (gemessen 2026-10-14):**
 * Der Nudge ist ein PLANWEITER Umlauf — seine Züge sind voneinander
 * abhängig (Lane für Lane). Wird je Kante zurückgerollt, zerfällt der
 * Umlauf: über die Referenzpläne entstanden so `camper` I3 = 5,
 * `complex` I2 = 1 / I3 = 5 und Kreuzungen `complex` 25 → 30, obwohl
 * JEDE Einzelentscheidung „korrekt" war. Die richtige Körnung für einen
 * planweiten Schritt ist der Plan; die richtige Körnung für einen
 * Zug innerhalb des Schritts (Trenngang) bleibt der Kandidat
 * (`acceptTransform`, s. `separation.ts`).
 */
export function acceptTransformStep(
  before: ReadonlyMap<string, readonly Point[]>,
  after: ReadonlyMap<string, readonly Point[]>,
  edgeRefs: ReadonlyMap<string, { source: string; target: string }>,
  world: CollisionWorld,
  options: TransformAcceptanceOptions = {}
): StepDecision {
  const tokens = options.tokens ?? ROUTING_TOKENS;
  const weights = options.weights ?? COST_WEIGHTS;

  const changed: string[] = [];
  let beforeMeasure: TransformMeasure = {
    hard: 0,
    weighted: 0,
    crossings: 0,
    bends: 0,
    uTurns: 0,
    length: 0,
  };
  let afterMeasure = beforeMeasure;

  for (const id of [...before.keys()].sort()) {
    const beforeWaypoints = before.get(id) ?? [];
    const afterWaypoints = after.get(id) ?? beforeWaypoints;
    if (sameWaypoints(beforeWaypoints, afterWaypoints)) continue;
    changed.push(id);
    const ref = edgeRefs.get(id) ?? { source: '', target: '' };
    beforeMeasure = addMeasure(
      beforeMeasure,
      measureTransform(
        { id, source: ref.source, target: ref.target, waypoints: beforeWaypoints },
        world,
        tokens
      )
    );
    afterMeasure = addMeasure(
      afterMeasure,
      measureTransform(
        { id, source: ref.source, target: ref.target, waypoints: afterWaypoints },
        world,
        tokens
      )
    );
  }

  const scoreBefore = transformScore(beforeMeasure, weights);
  const scoreAfter = transformScore(afterMeasure, weights);
  const base = { changed, before: beforeMeasure, after: afterMeasure, scoreBefore, scoreAfter } as const;

  if (changed.length === 0) {
    return { ...base, accepted: true, reason: 'unchanged' };
  }

  const verdict = compareTransform(afterMeasure, beforeMeasure, weights);

  // 1. Weniger harte Verletzungen ⇒ annehmen (stärkste Währung).
  if (afterMeasure.hard < beforeMeasure.hard) {
    return { ...base, accepted: true, reason: 'fewer-hard-violations' };
  }

  // 2b. Mehr harte Verletzungen ⇒ nur, wenn der Schritt dafür nachweislich
  //     Freigabe gewinnt (gewichtete Verletzungen runter UND Kostenscore
  //     besser). Der Rohzustand C trägt selbst harte Verletzungen, und der
  //     Nudge darf sie kurzzeitig umsortieren — der Trenngang räumt sie auf.
  //     Die Kette als Ganzes darf sie nicht vermehren: das erzwingt
  //     `acceptTransformChain` (D.hard ≤ C.hard).
  if (afterMeasure.hard > beforeMeasure.hard) {
    const gainsClearance = afterMeasure.weighted < beforeMeasure.weighted;
    const costBetter = transformScore(afterMeasure, weights) < transformScore(beforeMeasure, weights) - EPS;
    return {
      ...base,
      accepted: gainsClearance && costBetter,
      reason: gainsClearance && costBetter ? 'fewer-weighted-violations' : 'hard-increase',
    };
  }

  // 3. Mehr gewichtete Verletzungen ⇒ nur bei nachweislich besserem Score.
  if (afterMeasure.weighted > beforeMeasure.weighted) {
    return {
      ...base,
      accepted: verdict === -1,
      reason: verdict === -1 ? 'strictly-better' : 'weighted-increase-without-score',
    };
  }

  // 4. Freigabe gekauft ⇒ annehmen (Preis bewertet der Score; das
  //    Längenbudget gilt für die Kette).
  if (afterMeasure.weighted < beforeMeasure.weighted) {
    return { ...base, accepted: true, reason: 'fewer-weighted-violations' };
  }

  // 5. Wertgleich ⇒ den Schritt lassen, wie er ist.
  //
  // Das Gatter ist ein SICHERHEITSNETZ, kein zweiter Entscheider: Es entfernt
  // Schritte, die nachweislich schlechter sind (harte oder gewichtete Zunahme
  // ohne Score-Gewinn). Ein wertgleicher Schritt ist das Verhalten VOR A1 —
  // ihn zu verwerfen ändert die Eingabe aller folgenden Schritte und damit
  // den Endplan, ohne dass eine Verschlechterung vorliegt. Genau das war
  // messbar im Versatz-Gate (2026-10-14): zwei der 49 Versätze des Plans
  // `simple` wurden durch das Verwerfen eines wertgleichen Schritts um 4 × I3
  // schlechter (0 → 4). Der Kandidaten-Regel bleibt die strenge Fassung
  // („wertgleich ohne Gewinn ⇒ verwerfen") unbenommen — sie entscheidet
  // innerhalb eines Schritts, wo es keine Folgekette gibt.
  if (verdict === -1) return { ...base, accepted: true, reason: 'strictly-better' };
  return { ...base, accepted: true, reason: 'value-equal' };
}

/**
 * KETTEN-Regel: darf der komplette Nachbearbeitungs-Block (Nudge →
 * Bend-Merge → Trenngänge) sein Ergebnis behalten?
 *
 * Gemessen wird der Endstand gegen den ROHSTAND (State C aus der
 * 5-State-Diagnose). Sie ist die normative Zusicherung des A1-Auftrags:
 *
 *  - `hard(D) ≤ hard(C)` — die Nachbearbeitung erzeugt unterm Strich keine
 *    neue harte Verletzung (Zwischenstände dürfen sie umsortieren),
 *  - `weighted(D) ≤ weighted(C)` — die Freigabe wird nicht verschlechtert,
 *  - `ΔLänge ≤ acceptanceLengthGrowth` — kein Umweg-Einkauf: **gilt für
 *    wertgleiche Blöcke**. Löst der Block harte ODER gewichtete Verletzungen
 *    strikt auf, greift das Budget nicht (der Preis steht im gepreisten
 *    Katalog, s. `fewer-weighted-violations`),
 *  - `verdict < 0` — bei wertgleichen Blöcken muss sich der Umbau in der
 *    Lexikografie (hard → weighted → Kostenscore) nachweislich verbessern,
 *    sonst Umbau ohne Gewinn (Stabilität).
 *
 * **Vorrang der harten Verletzung (gemessen 2026-10-14):** Löst der Block
 * eine harte Überdeckung strikt auf, dann wird er angenommen — auch über das
 * Längenbudget hinaus. Versatz-Gate als Gegenprobe: Ein Budget-Veto auf einen
 * Block, der Freigabe auflöst, kostet gemessen I3 43 statt 25 (`simple`),
 * 48 statt 10 (`inverter`) über die 49 Versätze.
 * Harte Verletzungen sind kein Preis, sondern ein Verbot (ADR 0009/0015); ein
 * Plan, der eine verbotene Überdeckung behält, um 0,6 % Länge zu sparen, ist
 * die schlechtere Wahl. Präzedenz im Produktivcode: ADR 0036 (p11 kauft
 * +64 px auf der Kante, um die Überdeckung aufzulösen). Ohne diese Klausel
 * fiel das Spannkanten-Szenario `stress:spanning-100` auf den Rohstand
 * zurück — 40 verbotene Überdeckungen und 160 Freigabe-Unterschreitungen
 * blieben stehen, um 0,59 % Länge zu sparen (Messung in
 * `docs/routing/OPTIMIZE-DIAGNOSIS.md`).
 *
 * Verwirft die Kette, fällt `routeAllCables` auf die Rohgeometrie zurück —
 * der Nutzer sieht dann lieber die unaufgeräumte, aber nicht die
 * verschlechterte Trasse.
 */
export function acceptTransformChain(
  raw: ReadonlyMap<string, readonly Point[]>,
  after: ReadonlyMap<string, readonly Point[]>,
  edgeRefs: ReadonlyMap<string, { source: string; target: string }>,
  worldOf: (state: ReadonlyMap<string, readonly Point[]>) => CollisionWorld,
  options: TransformAcceptanceOptions = {}
): StepDecision {
  const tokens = options.tokens ?? ROUTING_TOKENS;
  const weights = options.weights ?? COST_WEIGHTS;
  const maxGrowth = options.maxLengthGrowth ?? MAX_TRANSFORM_LENGTH_GROWTH;

  const changed: string[] = [];
  for (const id of raw.keys()) {
    const before = raw.get(id) ?? [];
    const candidate = after.get(id) ?? before;
    if (!sameWaypoints(before, candidate)) changed.push(id);
  }
  if (changed.length === 0) {
    const zero: TransformMeasure = { hard: 0, weighted: 0, crossings: 0, bends: 0, uTurns: 0, length: 0 };
    return {
      accepted: true,
      reason: 'unchanged',
      changed,
      before: zero,
      after: zero,
      scoreBefore: 0,
      scoreAfter: 0,
    };
  }

  // Beide Seiten in ihrer eigenen Welt messen: C gegen C, D gegen D. Nur so
  // ist „der Endstand ist besser als der Rohstand" die Aussage über den Plan,
  // den der Nutzer sieht.
  const beforeWorld = worldOf(raw);
  const afterWorld = worldOf(after);
  let beforeMeasure: TransformMeasure = {
    hard: 0,
    weighted: 0,
    crossings: 0,
    bends: 0,
    uTurns: 0,
    length: 0,
  };
  let afterMeasure = beforeMeasure;
  // Längenbudget gegen die PLANSUMGE (alle Kanten) — unveränderte Kanten
  // tragen auf beiden Seiten identisch bei, deshalb genügt die Summe der
  // veränderten plus der unveränderten Länge.
  for (const id of raw.keys()) {
    const ref = edgeRefs.get(id) ?? { source: '', target: '' };
    beforeMeasure = {
      ...beforeMeasure,
      length: beforeMeasure.length + pathLengthOf(raw.get(id) ?? []),
    };
    afterMeasure = {
      ...afterMeasure,
      length: afterMeasure.length + pathLengthOf(after.get(id) ?? raw.get(id) ?? []),
    };
    void ref;
  }
  for (const id of changed) {
    const ref = edgeRefs.get(id) ?? { source: '', target: '' };
    beforeMeasure = addCounters(
      beforeMeasure,
      measureTransform(
        { id, source: ref.source, target: ref.target, waypoints: raw.get(id) ?? [] },
        beforeWorld,
        tokens
      )
    );
    afterMeasure = addCounters(
      afterMeasure,
      measureTransform(
        { id, source: ref.source, target: ref.target, waypoints: after.get(id) ?? [] },
        afterWorld,
        tokens
      )
    );
  }

  const verdict = compareTransform(afterMeasure, beforeMeasure, weights);
  const base = {
    changed,
    before: beforeMeasure,
    after: afterMeasure,
    scoreBefore: transformScore(beforeMeasure, weights),
    scoreAfter: transformScore(afterMeasure, weights),
  } as const;

  if (afterMeasure.hard > beforeMeasure.hard) {
    return { ...base, accepted: false, reason: 'hard-increase' };
  }
  // Vorrang der harten Verletzung (ADR 0009/0015, Präzedenz ADR 0036):
  // Ein Block, der harte Überdeckungen strikt auflöst, wird angenommen —
  // hart ist die stärkste Währung und kein Preis (deshalb greift hier auch
  // das Längenbudget nicht). Begründung und Messung: JSDoc oben.
  if (afterMeasure.weighted > beforeMeasure.weighted) {
    return {
      ...base,
      accepted: verdict === -1,
      reason: verdict === -1 ? 'strictly-better' : 'weighted-increase-without-score',
    };
  }
  if (afterMeasure.hard < beforeMeasure.hard) {
    return { ...base, accepted: true, reason: 'fewer-hard-violations' };
  }
  // Freigabe gekauft ⇒ annehmen. Der Preis steht im gepreisten Katalog
  // (Freigabe-Verstoß = 400 px-Äquivalent), nicht im Längenbudget: Ein Veto
  // hier ließe gemessene Verstöße stehen, um Länge zu sparen. Genau das war
  // der Fall im Versatz-Gate (2026-10-14 gemessen): simple I3 25 → 43,
  // solar 0 → 4, inverter 10 → 48, als das Budget die Freigabe-Auflösung
  // überstimmte. Das Budget schützt vor „Umbau ohne Gewinn", nicht vor dem
  // Auflösen von Verstößen.
  if (afterMeasure.weighted < beforeMeasure.weighted) {
    return { ...base, accepted: true, reason: 'fewer-weighted-violations' };
  }
  // Ab hier sind harte und gewichtete Verletzungen wertgleich: hier gilt das
  // Längenbudget (Umbau, der nichts auflöst, darf keinen Umweg einkaufen).
  if (afterMeasure.length > beforeMeasure.length * (1 + maxGrowth) + EPS) {
    return { ...base, accepted: false, reason: 'length-budget' };
  }
  if (verdict === -1) return { ...base, accepted: true, reason: 'strictly-better' };
  return { ...base, accepted: false, reason: 'no-strict-gain' };
}
