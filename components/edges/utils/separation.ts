import {
  isOrthogonalPath,
  routeDefectScore,
  simplifyWaypoints,
  stitchOrthogonal,
  waypointsToSegments,
  type Point,
  type Rect,
  type Segment,
} from './pathfinding';
import { hasMinimumStubs, pathLength } from '../../../lib/routing/geometry';
import {
  classifySegmentAgainstNode,
  classifySegmentAgainstSegment,
} from '../../../lib/routing/rules/collision';
import {
  isPortBundleOverlap,
  isPortBundleProximity,
  routedPathGeometry,
  type RoutedPathGeometry,
} from '../../../lib/routing/rules/portBundle';
import { requiredStubLength } from '../../../lib/routing/invariants';
import { ROUTING_TOKENS } from '../../../lib/routing/tokens';
import { compareIds } from '../../../lib/sortOrder';

/**
 * Abschluss-Gang der Trassen-Trennung — stellt die Kabel-Freigabe HER.
 *
 * ## Warum es diesen Gang gibt
 *
 * Die Kabel-Freigabe (I3: `cableClearance` zwischen Segmenten fremder Kanten,
 * Segment × Node und Segment × Segment) war bis hierher eine *Ermunterung*,
 * keine Garantie:
 *
 * - die Suche meidet fremde Trassen über „Tubes" (ROUTE-BUG-16) — solange die
 *   Trassensperre nicht am eigenen Port scheitert; scheitert sie, fällt die
 *   gesamte Sperre weg (ADR-0032-Reparatur greift nur bei harten Verstößen),
 * - der Nudge verteilt parallele Innenstücke auf Lanes — er kannte aber nur
 *   „dieselbe Lane doppelt belegt", nicht „7,9 px daneben" (I3),
 * - ein Kostenmodell kann eine zu enge Stelle *unwahrscheinlich* machen, aber
 *   nicht *unmöglich*: „teuer" ist nicht „verboten" (ADR 0015).
 *
 * Gemessen über die sechs Referenzpläne blieben so 49 Segmentpaare unter
 * `cableClearance` (2026-10-03, `npm run routing:audit`).
 *
 * Ergebnis nach Einführung (ADR 0033): I3 = 0 auf allen sechs Plänen, ohne
 * neue Kreuzung und ohne Umweg — die restlichen drei Meldungen hatte der
 * Locus-Zuordnungs-Fix (`rules/portBundle.ts`) und die Korridor-Korrektur der
 * Vorlage (`rules/portCapacity.ts`) beseitigt.
 *
 * ## Was dieser Gang anders macht
 *
 * Er benutzt **kein** Näherungsmaß und **keine** eigene Abstandsbegriffswelt:
 * bewertet wird ausschließlich mit derselben Regel, die auch das Gate prüft
 * (`classifySegmentAgainstSegment` aus dem geteilten Kollisionsmodell, Regel H;
 * Port-Bündel-Freigabe aus `isPortBundleProximity`, ADR 0031). Ein Kandidat
 * wird nur angenommen, wenn die Zahl der Verstöße **streng sinkt** — der Gang
 * kann also keine neue Verletzung erzeugen, er kann nur aufräumen. Zusätzlich
 * muss der Kandidat orthogonal bleiben, seine Stubs und Kurzsegmente halten
 * (I4/I5/I6, `routeDefectScore`) und darf keine kollineare Überdeckung (I2)
 * oder ein Hindernis hinzufügen.
 *
 * Verschiebbar ist ausschließlich ein INNERES Segment (`1 … n-2`): die
 * Handle-Punkte selbst bleiben unangetastet, und `stitchOrthogonal` zieht die
 * Anschlüsse nach. Damit ist das Ergebnis wieder ein orthogonaler Pfad mit
 * denselben Ports.
 *
 * Drei Wächter deckeln den Zug zusätzlich: kein neuer Hindernis-Treffer
 * (sonst tauscht der Gang I3 gegen I1), keine neue Kreuzung (`crossingsBetween`
 * — die Kreuzungs-Ratchet darf nur sinken) und kein Umweg.
 *
 * ## Die drei Phasen (Reihenfolge ist Teil des Ergebnisses)
 *
 * 1. **Längenneutrale Züge** (`allowLonger=false`) über BEIDE beteiligten
 *    Pfade, in fester Seiten-/Segment-/Schrittfolge.
 * 2. **Verlängernde Züge** (`allowLonger=true`) — nur, wenn die Phase 1 den
 *    Verstoß nicht auflösen konnte. Die beiden Phasen laufen GLOBAL über beide
 *    Seiten; seitenweise abgearbeitet verbraucht die erste Seite die Reparatur
 *    mit einem Umweg, bevor die zweite ihren längenneutralen Zug anbietet
 *    (gemessen 2026-10-03: acdc +64 px, complex +44 px über der Ratchet).
 * 3. **Längen-Nachlauf**: danach sucht ein weiterer Durchgang ausschließlich
 *    *kürzende* Züge und nimmt sie nur an, wenn die Verstoßzahl dabei nicht
 *    steigt und weder Kreuzung noch Hindernis-Treffer hinzukommen. Er kann den
 *    Hauptlauf also nicht verschlechtern, nur dessen Umweg-Preis senken
 *    (gemessen: inverter −170,4 px, acdc −64 px, simple/camper je −32 px).
 *
 * Innerhalb einer Phase gewinnt der **erste** Treffer in fester
 * Erzeugungsreihenfolge. „Kleinstes Delta", „größter Abbau" und „größter
 * Gesamtabstand" als lokales Auswahlkriterium wurden gemessen und verworfen:
 * Jede dieser Regeln ändert die Greedy-Kette so, dass `complex` mit einem
 * Rest-I3 stehen bleibt (4-px-Paar `e-auto-2 ↔ e-auto-7`).
 *
 * ## Determinismus (ADR 0010)
 *
 * Verstöße werden in fester Reihenfolge abgearbeitet (Plan, Kanten-ID,
 * Segmentindex), Kandidaten in fester Reihenfolge (Seite, Schrittweite)
 * erzeugt. Es gibt keine Zufallsquelle, keine Objekt-Identität und keine
 * Map-Iterationsreihenfolge als Entscheidungsgrundlage. Gleiche Eingabe ⇒
 * gleiche Ausgabe.
 *
 * ## Grenzen (sichtbar, nicht still)
 *
 * Der Gang repariert, was durch Verschieben eines inneren Segments zu
 * reparieren ist. Strukturelle Fälle — beide beteiligten Segmente sind
 * Port-Stubs, der Pfad hat kein inneres Segment, oder jede Lane ist durch
 * Hindernisse belegt — bleiben stehen und werden vom Gate gezählt. Sie sind
 * damit Arbeit an der Platzierung bzw. am Port-Rahmen, nicht an dieser Stelle
 * (dieselbe Aufteilung wie in ADR 0027/0031).
 */

/** Eine Kante, wie dieser Gang sie sieht — dieselbe Form wie beim Nudge. */
export type SeparationPath = { id: string; waypoints: Point[]; locked?: boolean };

export type SeparationOptions = {
  /** Hindernisse (Bauteil-Boxen inkl. Rand), gegen die ein Kandidat geprüft wird. */
  obstacles?: readonly Rect[];
  /** Kabel-Freigabe — Token-Default, nie hart kodiert. */
  clearance?: number;
  /** Lane-Schrittweite der Kandidaten. */
  gap?: number;
  /** Obergrenze der Durchgänge (jeder Durchgang muss die Zahl senken). */
  maxRounds?: number;
  /** Wie viele Lane-Schritte je Kandidat geprüft werden (symmetrisch). */
  maxLaneSteps?: number;
  /** Obergrenze der Verstöße, die je Durchgang bearbeitet werden. */
  maxViolationsPerRound?: number;
};

const EPS = 1e-6;

/** Arbeitszustand eines Pfades: Geometrie, Sicht der Prüfer, Hüllbox, Länge. */
type Working = {
  id: string;
  points: Point[];
  geometry: RoutedPathGeometry;
  bounds: Rect;
  /** Manhattan-Länge — Wächter gegen „Freigabe gegen Umweg" (s. Annahme-Regel). */
  length: number;
  /** Eine fixierte Leitung ist Prüfobjekt/Hindernis, aber nie Reparatur-Kandidat. */
  locked: boolean;
};

/** Ein Verstoß: zwei Segmente unter `clearance`, ohne Berührung. */
type Violation = {
  a: number;
  b: number;
  sa: number;
  sb: number;
  distance: number;
};

const at = <T>(arr: readonly T[], i: number): T => {
  const v = arr[i];
  if (v === undefined) throw new RangeError(`separation.at: Index ${i} außerhalb (Länge ${arr.length})`);
  return v;
};

const boundsOf = (points: readonly Point[], pad: number): Rect => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = at(points, i);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX - pad, y: minY - pad, width: maxX - minX + 2 * pad, height: maxY - minY + 2 * pad };
};

const boundsOverlap = (a: Rect, b: Rect): boolean =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

const makeWorking = (path: SeparationPath, pad: number): Working => ({
  id: path.id,
  points: simplifyWaypoints([...path.waypoints]),
  geometry: routedPathGeometry([...path.waypoints]),
  bounds: boundsOf(path.waypoints, pad),
  length: pathLength(path.waypoints),
  locked: path.locked === true,
});

/**
 * Verstöße ZWISCHEN zwei Pfaden — dieselbe Regel wie `checkClearance` (I3),
 * inklusive der einen Port-Bündel-Freigabe.
 *
 * Reihenfolge der beiden Prüfungen (PERF-002, ergebnisneutral): erst die
 * billige Klassifikation (Hüllbox-Vorprüfung, Distanz), dann — nur für
 * tatsächlich `weighted` Paare — die Port-Bündel-Ausnahme. Die Ausnahme kann
 * das Ergebnis nur für `weighted`-Paare ändern, deshalb ist „erst klassifizieren"
 * dieselbe Menge; sie spart aber den teuren Bogen-Vergleich für jedes Paar,
 * das die Freigabe ohnehin nicht unterschreitet. Gemessen im 250-Knoten-
 * Spannkanten-Szenario: `samePoint`/`isPortBundleProximity` machten 1,3 s der
 * Separation aus, obwohl fast kein Paar die Clearance unterschritt.
 */
const violationsBetween = (a: Working, b: Working, clearance: number, out: Violation[]): void => {
  if (!boundsOverlap(a.bounds, b.bounds)) return;
  for (let i = 0; i < a.geometry.segments.length; i++) {
    const s1 = at(a.geometry.segments, i);
    for (let j = 0; j < b.geometry.segments.length; j++) {
      const s2 = at(b.geometry.segments, j);
      const verdict = classifySegmentAgainstSegment(s1, s2, clearance);
      if (verdict.class !== 'weighted' || verdict.distance === undefined) continue;
      if (isPortBundleProximity(a.geometry, b.geometry, s1, s2, ROUTING_TOKENS.portFacingClearance)) continue;
      out.push({ a: 0, b: 0, sa: i, sb: j, distance: verdict.distance });
    }
  }
};

/**
 * Verstoß-Bilanz zweier Arbeitszustände: Zahl der Freigabe-Verstöße, harte
 * Überdeckungen (I2) und echte Kreuzungen. Genau diese drei Werte entscheiden
 * über die Annahme eines Kandidaten.
 *
 * PERF-002/ADR-0033 (2026-10-03): EIN Durchgang je Segmentpaar. Zuvor liefen
 * drei getrennte Durchgänge über dasselbe Paar (`violationsBetween`,
 * `hardOverlapsBetween`, `crossingsBetween`) — jeder klassifizierte erneut
 * (bis zu drei `classifySegmentAgainstSegment`-Aufrufe plus eine separate
 * `segmentsCross`-Rechnung für dieselben vier Orientierungen). Die Klassen
 * schließen sich aus (`soft` = echte Kreuzung, `hard` = kollineare Überdeckung,
 * `weighted` = Freigabe-Unterschreitung), deshalb ist das Zusammenlegen
 * ergebnisidentisch — nur die Zahl der Klassifikationen sinkt auf eine je Paar
 * (gemessen im 250-Knoten-Spannkanten-Szenario: 4,8 s → unter 2 s für die
 * Annahme-Bilanz).
 *
 * Die früher mitgeführte **Summe der Abstände** ist entfallen — sie war der
 * Tie-Breaker einer verworfenen Auswahlregel (s. „Drei Phasen") und wurde beim
 * Entscheiden nicht mehr gelesen.
 */
type PairMeasure = { count: number; hard: number; crossings: number };

const measureBetween = (a: Working, b: Working, clearance: number): PairMeasure => {
  let count = 0;
  let hard = 0;
  let crossings = 0;
  // Hüllbox-Vorprüfung (PERF-002, ergebnisneutral): Liegen die um `clearance`
  // erweiterten Boxen getrennt, kann kein Zweig greifen — die Bilanz ist exakt
  // `{0,0,0}`, ohne die Segmentpaare zu klassifizieren.
  if (!boundsOverlap(a.bounds, b.bounds)) return { count, hard, crossings };
  const left = a.geometry.segments;
  const right = b.geometry.segments;
  for (let i = 0; i < left.length; i++) {
    const s1 = at(left, i);
    for (let j = 0; j < right.length; j++) {
      const s2 = at(right, j);
      const verdict = classifySegmentAgainstSegment(s1, s2, clearance);
      if (verdict.class === 'soft') {
        crossings += 1;
        continue;
      }
      if (verdict.class === 'hard') {
        if (!isPortBundleOverlap(a.geometry, b.geometry, s1, s2)) hard += 1;
        continue;
      }
      if (verdict.class !== 'weighted' || verdict.distance === undefined) continue;
      if (isPortBundleProximity(a.geometry, b.geometry, s1, s2, ROUTING_TOKENS.portFacingClearance)) continue;
      count += 1;
    }
  }
  return { count, hard, crossings };
};

/** Verstoß-Bilanz eines Pfades gegen alle übrigen — hängt nur von ihm ab. */
const measurePathAgainstOthers = (
  working: readonly Working[],
  mover: number,
  clearance: number
): PairMeasure => {
  const own = at(working, mover);
  let count = 0;
  let hard = 0;
  let crossings = 0;
  for (let other = 0; other < working.length; other++) {
    if (other === mover) continue;
    const peer = at(working, other);
    const measured = measureBetween(own, peer, clearance);
    count += measured.count;
    hard += measured.hard;
    crossings += measured.crossings;
  }
  return { count, hard, crossings };
};

/**
 * Annahme-Bedingung eines Kandidaten — dieselben Vergleiche wie zuvor, nur
 * inkrementell und mit Frühausstieg: Beide Zähler wachsen monoton, sobald
 * `count` die alte Zahl erreicht oder ein harter Treffer/eine Kreuzung
 * hinzukommt, kann der Kandidat nicht mehr gewinnen. Ergebnis und Auswahl
 * bleiben identisch (die Bedingung ist eine Konjunktion monotoner Vergleiche).
 */
const candidateImproves = (
  working: readonly Working[],
  mover: number,
  candidate: Working,
  clearance: number,
  before: PairMeasure
): boolean => {
  let count = 0;
  let hard = 0;
  let crossings = 0;
  for (let other = 0; other < working.length; other++) {
    if (other === mover) continue;
    const peer = at(working, other);
    const measured = measureBetween(candidate, peer, clearance);
    count += measured.count;
    hard += measured.hard;
    crossings += measured.crossings;
    if (count >= before.count || hard > before.hard || crossings > before.crossings) return false;
  }
  return count < before.count;
};

/**
 * Warum die Kreuzungen in dieselbe Bilanz gehören: Kabel-Freigabe und
 * Kreuzungszahl ziehen in verschiedene Richtungen — ein Ausweichzug auf eine
 * freie Lane kann eine fremde Trasse kreuzen. Die Kreuzungszahl ist KEINE
 * Invariante, aber sie steht unter einer Ratchet (`CROSSING_RATCHET`, „darf
 * nur sinken"); ein Gang, der Verstöße aufräumt und dafür Kreuzungen anhäuft,
 * verschiebt das Problem bloß. Gemessen 2026-10-03 ohne diesen Wächter:
 * camper 5→7, acdc 6→8, complex 27→30 (allesamt über der Ratchet). Deshalb ist
 * „nicht mehr Kreuzungen" Teil der Annahme-Bedingung — und das Zählen läuft im
 * selben Durchgang wie die Freigabe (`verdict.class === 'soft'`, dieselben vier
 * Orientierungen, dieselbe `segmentsCrossWith`-Regel wie das Kreuzungs-Gate).
 */
/** Alle Verstöße des Gesamtplans, deterministisch sortiert. */
const collectViolations = (working: readonly Working[], clearance: number): Violation[] => {
  const out: Violation[] = [];
  for (let i = 0; i < working.length; i++) {
    for (let j = i + 1; j < working.length; j++) {
      const start = out.length;
      violationsBetween(at(working, i), at(working, j), clearance, out);
      for (let k = start; k < out.length; k++) {
        const v = at(out, k);
        out[k] = { ...v, a: i, b: j };
      }
    }
  }
  // Feste Reihenfolge: engster Abstand zuerst, dann Pfad- und Segmentindizes.
  out.sort((x, y) => x.distance - y.distance || x.a - y.a || x.sa - y.sa || x.b - y.b || x.sb - y.sb);
  return out;
};

/**
 * Verschiebt ein INNERES Segment um `delta` senkrecht zu seiner Achse und
 * zieht den Pfad wieder rechtwinklig zusammen. `undefined`, wenn das Segment
 * kein inneres ist oder ein Handle-Endpunkt mitwandern müsste.
 */
const shiftInteriorSegment = (
  points: readonly Point[],
  segmentIndex: number,
  delta: number
): Point[] | null => {
  const n = points.length;
  if (segmentIndex < 1 || segmentIndex + 1 > n - 2) return null;
  const a = at(points, segmentIndex);
  const b = at(points, segmentIndex + 1);
  const vertical = Math.abs(a.x - b.x) <= EPS;
  const horizontal = Math.abs(a.y - b.y) <= EPS;
  if (!vertical && !horizontal) return null;
  const moved = points.map((p) => ({ x: p.x, y: p.y }));
  if (vertical) {
    at(moved, segmentIndex).x += delta;
    at(moved, segmentIndex + 1).x += delta;
  } else {
    at(moved, segmentIndex).y += delta;
    at(moved, segmentIndex + 1).y += delta;
  }
  return moved;
};

/**
 * Segmente, die als Kandidat verschoben werden dürfen — in fester
 * Reihenfolge. Zuerst das verletzende Segment selbst, dann seine Nachbarn:
 * Ist der Verstoß ein Stub (Index 0 oder n-2), ist er selbst nicht
 * verschiebbar (der Port darf sich nicht bewegen) — die Länge des Stubs
 * ändert man über das angrenzende Innensegment. Genau das war in `inverter`
 * der Blocker (`e-auto-7` Stub ↔ `e-auto-9` Lauf, 4 px).
 */
const moveSegments = (points: readonly Point[], violating: number): number[] => {
  const n = points.length;
  const lastInterior = n - 3;
  const out: number[] = [];
  for (const candidate of [violating, violating - 1, violating + 1]) {
    if (candidate < 1 || candidate > lastInterior) continue;
    if (out.includes(candidate)) continue;
    out.push(candidate);
  }
  return out;
};

/**
 * Verschiebeweiten eines Kandidaten in fester Reihenfolge: zuerst die
 * Lane-Raster-Schritte (beide Richtungen, klein zu groß), dann — wenn das
 * Segment an einem Stub hängt — die Weite, die den Stub auf seine geforderte
 * Mindestlänge zieht (`requiredStubLength`, dieselbe Quelle wie I5).
 *
 * Ohne diesen zweiten Satz sind enge Korridore unlösbar: `complex` braucht
 * den 54 px langen Busbar-Stub bei 24 px (Raster-Schritte 16/32 verfehlen das
 * Fenster [24, 27.5] um 2 px). Kein Zahlenwert außerhalb der Tokens.
 */
const moveDeltas = (
  points: readonly Point[],
  segmentIndex: number,
  gap: number,
  maxLaneSteps: number,
  requiredStub: number,
  /** Abstand des aktuellen Verstoßes — erlaubt einen Zug „genau auf Freigabe". */
  violationDistance?: number,
  clearance?: number
): number[] => {
  const n = points.length;
  const out: number[] = [];
  const push = (delta: number): void => {
    if (Math.abs(delta) <= EPS) return;
    if (out.includes(delta)) return;
    out.push(delta);
  };
  if (violationDistance !== undefined && clearance !== undefined && violationDistance < clearance) {
    const target = clearance - violationDistance;
    push(target);
    push(-target);
  }
  for (let step = 1; step <= maxLaneSteps; step++) {
    push(step * gap);
    push(-step * gap);
  }
  const stubDeltas = (from: number, to: number): void => {
    const a = at(points, from);
    const b = at(points, to);
    const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    const delta = length - requiredStub;
    push(delta);
    push(-delta);
  };
  if (segmentIndex === 1) stubDeltas(0, 1);
  if (segmentIndex === n - 3) stubDeltas(n - 2, n - 1);
  return out;
};

/**
 * Hindernis-Bilanz eines Pfades gegen fremde Bauteil-Boxen: `hard` ist die
 * I1-Bedingung (Segment schneidet Box), `weighted` die I3-Bedingung
 * (Segment zu dicht an Box). Gezählt werden Treffer, nicht Pfade — eine
 * pauschale „berührt schon irgendwo" wäre wertlos, weil JEDER Pfad die
 * Handle-Box seines eigenen Ports berührt (die Boxen umfassen die
 * Anschlusspunkte, `nodesToObstacles`). Genau daran ist die erste Fassung
 * gescheitert: sie ließ jede Verschiebung zu, sobald der Ausgangspfad
 * irgendein Hindernis traf — gemessen erzeugte das 9 neue I1-Verstöße
 * (inverter 2, acdc 2, complex 5, `routing:audit` 2026-10-03).
 */
const obstacleHitCounts = (
  points: readonly Point[],
  obstacles: readonly Rect[]
): { hard: number; weighted: number } => {
  let hard = 0;
  let weighted = 0;
  if (obstacles.length === 0) return { hard, weighted };
  // Hüllbox-Vorprüfung eine Ebene HÖHER als in `classifySegmentAgainstNode`
  // (PERF-002, ergebnisneutral): Liegt ein Bauteil weiter als `clearance` von
  // der Pfad-Hüllbox entfernt, kann kein Segment dieses Pfades es hart oder
  // gewichtet treffen — das Bauteil fällt aus der Schleife, statt für jedes
  // Segment einzeln verworfen zu werden. Gemessen im 500-Knoten-Szenario
  // (2026-10-03): `obstacleHitCounts` war mit 722 ms der größte Einzelposten
  // des Längen-Nachlaufs (500 Bauteile × ~20 Segmente je Kandidat).
  const bounds = boundsOf(points, 0);
  const clearance = ROUTING_TOKENS.cableClearance;
  const near: Rect[] = [];
  for (let i = 0; i < obstacles.length; i++) {
    const rect = at(obstacles, i);
    if (
      bounds.x > rect.x + rect.width + clearance ||
      bounds.x + bounds.width < rect.x - clearance ||
      bounds.y > rect.y + rect.height + clearance ||
      bounds.y + bounds.height < rect.y - clearance
    ) {
      continue;
    }
    near.push(rect);
  }
  if (near.length === 0) return { hard, weighted };
  for (const [a, b] of waypointsToSegments(points)) {
    for (const rect of near) {
      const verdict = classifySegmentAgainstNode([a, b], rect);
      if (verdict.class === 'hard') hard += 1;
      else if (verdict.class === 'weighted') weighted += 1;
    }
  }
  return { hard, weighted };
};

/**
 * Darf dieser Kandidat den Pfad ersetzen? Geprüft wird alles, was die
 * Invarianten außerhalb der Kabel-Freigabe fordern — orthogonal, Stubs,
 * Kurzsegmente, kein neuer Hindernis-Treffer. Die Freigabe selbst bewertet
 * der Aufrufer (streng sinkende Verstoßzahl).
 */
const candidateIsAcceptable = (repaired: Point[], original: Working): boolean => {
  if (!isOrthogonalPath(repaired)) return false;
  const points = simplifyWaypoints(repaired);
  if (!hasMinimumStubs(points, requiredStubLength(points))) return false;
  if (routeDefectScore(repaired) > routeDefectScore(original.points) + EPS) return false;
  return true;
};

/**
 * Stellt die Kabel-Freigabe zwischen fremden Trassen her.
 *
 * Reine Funktion: gleiche Eingabe ⇒ gleiche Ausgabe (ADR 0010). Der Aufruf
 * ändert die Eingabeobjekte nicht.
 */
export function separateCableClearance(
  paths: readonly SeparationPath[],
  options: SeparationOptions = {}
): Map<string, Point[]> {
  const clearance = options.clearance ?? ROUTING_TOKENS.cableClearance;
  const gap = options.gap ?? ROUTING_TOKENS.laneGrid;
  const maxRounds = options.maxRounds ?? 200;
  const maxLaneSteps = options.maxLaneSteps ?? 4;
  const maxViolationsPerRound = options.maxViolationsPerRound ?? 24;
  const obstacles = options.obstacles ?? [];

  const result = new Map<string, Point[]>();
  // Deterministische Arbeitsreihenfolge — die Eingabereihenfolge darf das
  // Ergebnis nicht bestimmen (ADR 0010).
  const ordered = [...paths].sort((x, y) => compareIds(x.id, y.id));
  for (const path of ordered) result.set(path.id, path.waypoints);

  if (ordered.length < 2) return result;

  let working = ordered.map((path) => makeWorking(path, clearance));

  for (let round = 0; round < maxRounds; round++) {
    const violations = collectViolations(working, clearance);
    if (violations.length === 0) break;
    let improved = false;
    const limit = Math.min(violations.length, maxViolationsPerRound);

    for (let vi = 0; vi < limit && !improved; vi++) {
      const violation = at(violations, vi);
      // Beide Seiten probieren, in fester Reihenfolge: erst der zweite Pfad,
      // dann der erste (der zuletzt geroutete Kandidat hat die schwächere
      // Bindung an die Port-Kette des anderen).
      const sides: Array<{ mover: number; other: number; segment: number }> = [
        { mover: violation.b, other: violation.a, segment: violation.sb },
        { mover: violation.a, other: violation.b, segment: violation.sa },
      ].filter((side) => !at(working, side.mover).locked);
      // Zwei Durchgänge über BEIDE Seiten: erst Züge OHNE Umweg (Länge ≤
      // vorher), dann — falls keiner die Zahl senkt — auch verlängernde. Die
      // Durchgänge müssen GLOBAL über beide Seiten laufen: Wird eine Seite
      // zuerst vollständig (inkl. Verlängerung) abgearbeitet, verbraucht sie
      // die Reparatur, bevor die andere Seite ihren längenneutralen Zug
      // anbieten kann — gemessen +64 px acdc / +44 px complex.
      //
      // Innerhalb eines Durchgangs gewinnt der ERSTE Treffer in fester
      // Erzeugungsreihenfolge. „Kleinstes Delta" oder „größter Abbau" als
      // lokales Kriterium wurde gemessen und verworfen: Beide ändern die
      // Greedy-Kette so, dass `complex` mit einem Rest I3 = 1 stehen bleibt
      // (Audit 2026-10-03) — die Reihenfolge ist Teil des Ergebnisses, nicht
      // ein Tie-Break.
      // Bilanz „vorher" je Seite — unabhängig vom Kandidaten, deshalb genau
      // einmal je Verstoß (nicht je Kandidat) berechnet.
      const beforeMeasures = sides.map((side) => measurePathAgainstOthers(working, side.mover, clearance));
      const sidesWithIndex = sides.map((side, index) => ({ ...side, index }));
      let applied = false;
      for (const allowLonger of [false, true]) {
        if (applied) break;
        for (const side of sidesWithIndex) {
          if (applied) break;
          const sideIndex = side.index;
          const current = at(working, side.mover);
          const hitsBefore = obstacleHitCounts(current.points, obstacles);
          const requiredStub = requiredStubLength(current.points);
          for (const moveIndex of moveSegments(current.points, side.segment)) {
            const targetDelta = moveIndex === side.segment ? violation.distance : undefined;
            for (const delta of moveDeltas(
              current.points,
              moveIndex,
              gap,
              maxLaneSteps,
              requiredStub,
              targetDelta,
              clearance
            )) {
              const shifted = shiftInteriorSegment(current.points, moveIndex, delta);
              if (!shifted) continue;
              const repaired = stitchOrthogonal(shifted);
              if (!candidateIsAcceptable(repaired, current)) continue;
              const hitsAfter = obstacleHitCounts(repaired, obstacles);
              // Der Gang darf keinen Hindernis-Treffer hinzufügen (I1 hart, I3
              // gewichtet) — sonst tauscht er eine Kabel-Freigabe gegen eine
              // Bauteil-Durchdringung.
              if (hitsAfter.hard > hitsBefore.hard || hitsAfter.weighted > hitsBefore.weighted) {
                continue;
              }

              const candidate: Working = {
                id: current.id,
                points: simplifyWaypoints(repaired),
                geometry: routedPathGeometry(repaired),
                bounds: boundsOf(repaired, clearance),
                length: pathLength(repaired),
                locked: current.locked,
              };

              // Längen-Wächter (1. Durchgang): Freigabe nicht gegen Umweg
              // einkaufen. Gemessen 2026-10-03 an der Stress-Szene
              // `p02-batterie-10-verbraucher`: ohne ihn +96 px Trassenlänge
              // (Budget „Länge ≤ Baseline" gerissen). Vor der teuren Bilanz
              // geprüft: er hängt nur am Kandidaten, nicht an den Nachbarn.
              if (!allowLonger && candidate.length > current.length + EPS) {
                continue;
              }
              // Genau die Zahl, die auch das Gate zählt, entscheidet über die
              // Annahme — streng sinkend, ohne neue harte Überdeckung, ohne
              // neue Kreuzung. Die „vorher"-Bilanz des bewegten Pfades hängt
              // nur von diesem ab und wird deshalb EINMAL je Seite berechnet
              // (vor der Durchgangsschleife), nicht je Kandidat.
              if (!candidateImproves(working, side.mover, candidate, clearance, beforeMeasures[sideIndex]!)) {
                continue;
              }

              const next = [...working];
              next[side.mover] = candidate;
              working = next;
              result.set(candidate.id, repaired);
              improved = true;
              applied = true;
              break;
            }
            if (applied) break;
          }
          if (applied) break;
        }
      }
      if (improved) break;
    }

    if (!improved) break;
  }

  // ── Längen-Nachlauf ──────────────────────────────────────────────────────
  // Der Hauptlauf kauft Freigabe notfalls mit Länge (gemessen: acdc +64 px
  // durch einen Lane-Schritt, complex +8 px durch einen Ziel-Abstand-Zug).
  // Dieser Nachlauf sucht danach ausschließlich KÜRZENDE Züge und nimmt sie
  // nur an, wenn die Freigabe dabei NICHT schlechter wird
  // (`after.count <= before.count`), keine Kreuzung und kein Hindernis
  // hinzukommt. Er kann den Hauptlauf also nicht verschlechtern, nur seinen
  // Umweg-Preis senken — und ist damit derselbe Vertrag wie dort: monoton.
  for (let round = 0; round < maxRounds; round++) {
    let shortened = false;
    for (let mover = 0; mover < working.length && !shortened; mover++) {
      const current = at(working, mover);
      if (current.locked) continue;
      const hitsBefore = obstacleHitCounts(current.points, obstacles);
      const requiredStub = requiredStubLength(current.points);
      // „vorher"-Bilanzen dieses Pfades je Nachbar — sie ändern sich erst mit
      // einer Annahme, und die bricht den Pfaddurchlauf ab.
      const beforeCache = new Map<number, PairMeasure>();
      for (let segment = 1; segment <= current.points.length - 3 && !shortened; segment++) {
        for (const delta of moveDeltas(current.points, segment, gap, maxLaneSteps, requiredStub)) {
          const shifted = shiftInteriorSegment(current.points, segment, delta);
          if (!shifted) continue;
          const repaired = stitchOrthogonal(shifted);
          const acceptable = candidateIsAcceptable(repaired, current);
          if (!acceptable) continue;
          // Länge ZUERST: Der Nachlauf nimmt nur kürzende Züge an, und die
          // abgeleiteten Objekte (Vereinfachung, Segmentgeometrie, Hüllbox)
          // kosten ein Vielfaches einer Längenmessung. Ergebnisidentisch — der
          // Wert ist derselbe, nur früher entschieden; gemessen im
          // 500-Knoten-Szenario: 24 276 Kandidaten, davon nur eine Handvoll
          // kürzend.
          const isShorter = pathLength(repaired) < current.length - EPS;
          if (!isShorter) continue;
          const candidate: Working = {
            id: current.id,
            points: simplifyWaypoints(repaired),
            geometry: routedPathGeometry(repaired),
            bounds: boundsOf(repaired, clearance),
            length: pathLength(repaired),
            locked: current.locked,
          };
          const hitsAfter = obstacleHitCounts(repaired, obstacles);
          if (hitsAfter.hard > hitsBefore.hard || hitsAfter.weighted > hitsBefore.weighted) continue;
          // Paarweise Vergleiche wie zuvor — aber die „vorher"-Bilanz
          // (`current` gegen jeden Nachbarn) hängt NUR vom Pfad ab und wird
          // deshalb je Pfad EINMAL berechnet statt je Kandidat. Sie kann sich
          // innerhalb des Pfaddurchlaufs nicht ändern (erst eine Annahme
          // verändert `working`, und die bricht den Durchlauf ab).
          let ok = true;
          for (let other = 0; other < working.length && ok; other++) {
            if (other === mover) continue;
            const o = at(working, other);
            const overlapsBefore = boundsOverlap(current.bounds, o.bounds);
            const overlapsAfter = boundsOverlap(candidate.bounds, o.bounds);
            // Keine der beiden Boxen berührt den Nachbarn ⇒ beide Bilanzen
            // sind `{0,0,0}` ⇒ der Vergleich kann nicht fehlschlagen.
            if (!overlapsBefore && !overlapsAfter) continue;
            // Die „vorher"-Bilanz hängt nur von (bewegter Pfad, Nachbar) ab —
            // Kandidaten desselben Pfades teilen sie. Ergebnisidentisch: Der
            // Wert ist derselbe, nur einmal statt je Kandidat gerechnet.
            let b1 = overlapsBefore ? beforeCache.get(other) : { count: 0, hard: 0, crossings: 0 };
            if (b1 === undefined) {
              b1 = measureBetween(current, o, clearance);
              beforeCache.set(other, b1);
            }
            const b2 = overlapsAfter
              ? measureBetween(candidate, o, clearance)
              : { count: 0, hard: 0, crossings: 0 };
            if (b2.count > b1.count || b2.hard > b1.hard || b2.crossings > b1.crossings) ok = false;
          }
          if (!ok) continue;
          const next = [...working];
          next[mover] = candidate;
          working = next;
          result.set(candidate.id, repaired);
          shortened = true;
          break;
        }
      }
    }
    if (!shortened) break;
  }
  return result;
}

/** Diagnose: Zahl der Kabel-Freigabe-Verstöße eines Plans (wie das Gate). */
export function countClearanceViolations(
  paths: readonly SeparationPath[],
  clearance: number = ROUTING_TOKENS.cableClearance
): number {
  const working = [...paths]
    .sort((a, b) => compareIds(a.id, b.id))
    .map((path) => makeWorking(path, clearance));
  return collectViolations(working, clearance).length;
}

/** Nur für Tests/Diagnose: die Segmentliste eines Pfades als Tupel. */
export const segmentsOfPath = (waypoints: readonly Point[]): Segment[] => waypointsToSegments(waypoints);
