import { EPS, simplifyWaypoints, waypointsToSegments, type Point, type Segment } from '../geometry';

/**
 * Port-Bündel-Ausnahme (ADR 0009) — die EINE Wahrheit.
 *
 * Zwei Leitungen, die sich eine Anschlussstelle teilen, verlassen sie
 * naturgemäß auf demselben Stub; ihre ersten Segmente liegen also kollinear
 * übereinander. Das ist **erlaubt**, solange die gemeinsame Strecke
 * vollständig innerhalb der Stubs BEIDER Kanten liegt. Jede Überdeckung
 * darüber hinaus bleibt ein harter Verstoß (I2): Spätestens am Lane-Punkt
 * (Port-Fan-Out) müssen sich die Trassen trennen.
 *
 * Bis 2026-09-27 lebte diese Regel ausschließlich als private Funktion in
 * `lib/routing/invariants.ts` (`checkEdgeEdgeOverlaps`) — und in einer
 * zweiten, abweichenden Fassung im Diagnose-Skript `scripts/routing/audit.ts`.
 * Das Kostenmodell (`costModel.ts`, ROUTE-002) braucht dieselbe Kenntnis, um
 * legitime Bündel nicht als „unmöglich“ (`Infinity`) zu verwerfen. Deshalb
 * steht sie hier in der Rules-Schicht, importierbar aus beiden Richtungen:
 *
 *   Invarianten (I2)  →  portBundle  ←  Kostenmodell (segmentExtraCost)
 *   Diagnose (audit)  →  portBundle
 *
 * Rein geometrisch, framework-frei, ohne Tokens — die Schwellen kommen aus
 * der Geometrie (`EPS`) und aus den Stubs der Kanten selbst.
 */

/**
 * Vorberechnete Geometrie einer gerouteten Kante — genau die Sicht, die die
 * Ausnahme braucht: Stützpunkte (für die gemeinsame Anschlussstelle),
 * Segmente (für die Klassifikation) und Stubs (erstes/letztes Segment).
 *
 * `routedPathGeometry` vereinfacht die Stützpunkte wie der Invarianten-Check
 * (`simplifyWaypoints`) — so treffen Modell und I2 dieselben Entscheidungen.
 */
export type RoutedPathGeometry = {
  readonly points: readonly Point[];
  readonly segments: readonly Segment[];
  /** Erstes und letztes Segment — die einzigen, die sich zwei Kanten am gemeinsamen Port teilen dürfen. */
  readonly stubs: readonly Segment[];
};

/** Geometrie einer Kante aus ihren Stützpunkten (vereinfacht wie der Invarianten-Check). */
export function routedPathGeometry(waypoints: readonly Point[]): RoutedPathGeometry {
  const points = simplifyWaypoints(waypoints);
  const segments = waypointsToSegments(points);
  const stubs = segments.length > 0 ? [segments[0]!, segments[segments.length - 1]!] : [];
  return { points, segments, stubs };
}

/** Zwei Punkte identisch (EPS)? */
export function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS;
}

/**
 * Teilen sich zwei Kanten eine Anschlussstelle? Geprüft werden Anfang und
 * Ende beider Wege — der gemeinsame Handle ist bei beiden Kanten ein
 * Endpunkt. (Sobald ein Endpunkt-Paar übereinstimmt, gibt es ohnehin einen
 * gemeinsamen Stützpunkt; die frühere Zusatzbedingung „irgendein gemeinsamer
 * Punkt“ war damit redundant und ist entfallen — gleiche Entscheidungen,
 * eine Bedingung weniger.)
 */
export function sharesPort(a: RoutedPathGeometry, b: RoutedPathGeometry): boolean {
  const a0 = a.points[0];
  const a1 = a.points[a.points.length - 1];
  const b0 = b.points[0];
  const b1 = b.points[b.points.length - 1];
  if (!a0 || !a1 || !b0 || !b1) return false;
  return samePoint(a0, b0) || samePoint(a0, b1) || samePoint(a1, b0) || samePoint(a1, b1);
}

/**
 * Gemeinsamer Abschnitt zweier kollinearer Segmente als [von, bis] entlang
 * der gemeinsamen Achse — `null`, wenn sie sich nicht echt überdecken.
 */
export function overlapInterval(s1: Segment, s2: Segment): { lo: number; hi: number } | null {
  const horizontal = Math.abs(s1[0].y - s1[1].y) <= EPS;
  const lo1 = horizontal ? Math.min(s1[0].x, s1[1].x) : Math.min(s1[0].y, s1[1].y);
  const hi1 = horizontal ? Math.max(s1[0].x, s1[1].x) : Math.max(s1[0].y, s1[1].y);
  const lo2 = horizontal ? Math.min(s2[0].x, s2[1].x) : Math.min(s2[0].y, s2[1].y);
  const hi2 = horizontal ? Math.max(s2[0].x, s2[1].x) : Math.max(s2[0].y, s2[1].y);
  const lo = Math.max(lo1, lo2);
  const hi = Math.min(hi1, hi2);
  return hi - lo > EPS ? { lo, hi } : null;
}

/** Liegen beide Segmente auf derselben Achsrichtung (beide waagerecht/senkrecht)? */
const sameAxis = (a: Segment, b: Segment): boolean =>
  Math.abs(a[0].y - a[1].y) <= EPS === Math.abs(b[0].y - b[1].y) <= EPS;

/** Endkoordinaten eines achsenparallelen Segments entlang seiner Achse. */
const stubCoords = (segment: Segment): [number, number] =>
  Math.abs(segment[0].y - segment[1].y) <= EPS ? [segment[0].x, segment[1].x] : [segment[0].y, segment[1].y];

/**
 * Ist diese kollineare Überdeckung die legitime Port-Bündelung zweier Kanten,
 * die sich eine Anschlussstelle teilen? Nur dann darf ein „hard“-Urteil des
 * Kollisionsmodells (I2 / `segmentExtraCost`) fallen gelassen werden.
 */
export function isPortBundleOverlap(
  a: RoutedPathGeometry,
  b: RoutedPathGeometry,
  s1: Segment,
  s2: Segment
): boolean {
  if (!sharesPort(a, b)) return false;
  const interval = overlapInterval(s1, s2);
  if (!interval) return false;
  const withinStub = (stubs: readonly Segment[]): boolean =>
    stubs.some((stub) => {
      if (!sameAxis(stub, s1)) return false;
      const coords = stubCoords(stub);
      const lo = Math.min(coords[0], coords[1]);
      const hi = Math.max(coords[0], coords[1]);
      return interval.lo >= lo - EPS && interval.hi <= hi + EPS;
    });
  return withinStub(a.stubs) && withinStub(b.stubs);
}

// ---------------------------------------------------------------------------
// Port-Korridor (ADR 0031, verschärft 2026-10-03) — Freigabe-Seite der Ausnahme.
// ---------------------------------------------------------------------------

/**
 * Bogenlängen der Stützpunkte, gemessen vom jeweiligen Route-Ende.
 *
 * `arcsFrom(points, true)` misst ab dem ersten Stützpunkt (Port am Start),
 * `false` ab dem letzten (Port am Ende). Achsenparallele Pfade: Manhattan =
 * Euklid.
 */
function arcsFromEnd(points: readonly Point[], portAtStart: boolean): number[] {
  const n = points.length;
  const arcs = new Array<number>(n).fill(0);
  if (portAtStart) {
    for (let i = 1; i < n; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      arcs[i] = arcs[i - 1]! + Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    }
  } else {
    for (let i = n - 2; i >= 0; i--) {
      const a = points[i]!;
      const b = points[i + 1]!;
      arcs[i] = arcs[i + 1]! + Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    }
  }
  return arcs;
}

/**
 * Bogenlänge eines Punktes AUF der Geometrie (muss auf einem Segment liegen —
 * der Aufrufer erzeugt nur solche Punkte). `NaN`, wenn kein Segment passt.
 *
 * `portAtStart` gibt die Richtung vor: Liegt der Port am Start, wird ab
 * `points[i]` vorwärts akkumuliert, sonst ab `points[i + 1]` rückwärts —
 * ein Punkt, der zwei Segmente teilt (Stützpunkt), wird sonst vom falschen
 * Segment aus doppelt weit gezählt.
 */
function arcAt(points: readonly Point[], arcs: readonly number[], p: Point, portAtStart: boolean): number {
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const horizontal = Math.abs(a.y - b.y) <= EPS;
    if (horizontal ? Math.abs(p.y - a.y) > EPS : Math.abs(p.x - a.x) > EPS) continue;
    if (
      p.x >= Math.min(a.x, b.x) - EPS &&
      p.x <= Math.max(a.x, b.x) + EPS &&
      p.y >= Math.min(a.y, b.y) - EPS &&
      p.y <= Math.max(a.y, b.y) + EPS
    ) {
      return portAtStart
        ? arcs[i]! + Math.abs(p.x - a.x) + Math.abs(p.y - a.y)
        : arcs[i + 1]! + Math.abs(p.x - b.x) + Math.abs(p.y - b.y);
    }
  }
  return Number.NaN;
}

/**
 * Bogenlängen-Intervalle der NÄCHSTEN Annäherung zweier achsenparalleler
 * Segmente (`aLo..aHi` auf Pfad A, `bLo..bHi` auf Pfad B, jeweils gemessen
 * vom gemeinsamen Port). Punktförmige Annäherung: `lo === hi`.
 *
 * Parallel mit Überlappung: Die Annäherung ist ein GEBIET (die ganze
 * Überlappungspanne) — beide Intervalle decken es ab. Senkrecht/mit
 * Endpunkt: ein einzelnes Punktpaar.
 */
type LocusArcs = { aLo: number; aHi: number; bLo: number; bHi: number };

const clampCoord = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function pointLocusArcs(
  a: RoutedPathGeometry,
  arcsA: readonly number[],
  portAAtStart: boolean,
  pA: Point,
  b: RoutedPathGeometry,
  arcsB: readonly number[],
  portBAtStart: boolean,
  pB: Point
): LocusArcs | null {
  const arcA = arcAt(a.points, arcsA, pA, portAAtStart);
  const arcB = arcAt(b.points, arcsB, pB, portBAtStart);
  if (!Number.isFinite(arcA) || !Number.isFinite(arcB)) return null;
  return { aLo: arcA, aHi: arcA, bLo: arcB, bHi: arcB };
}

function closestLocusArcs(
  a: RoutedPathGeometry,
  arcsA: readonly number[],
  portAAtStart: boolean,
  b: RoutedPathGeometry,
  arcsB: readonly number[],
  portBAtStart: boolean,
  s1: Segment,
  s2: Segment
): LocusArcs | null {
  const h1 = Math.abs(s1[0].y - s1[1].y) <= EPS;
  const h2 = Math.abs(s2[0].y - s2[1].y) <= EPS;

  if (h1 === h2) {
    // Parallel: Spannen entlang der gemeinsamen Achse + Quer-Offset.
    const span = (s: Segment, horizontal: boolean): [number, number, number] =>
      horizontal
        ? [Math.min(s[0].x, s[1].x), Math.max(s[0].x, s[1].x), s[0].y]
        : [Math.min(s[0].y, s[1].y), Math.max(s[0].y, s[1].y), s[0].x];
    const [l1, u1, o1] = span(s1, h1);
    const [l2, u2, o2] = span(s2, h2);
    const ptA = (c: number): Point => (h1 ? { x: c, y: o1 } : { x: o1, y: c });
    const ptB = (c: number): Point => (h1 ? { x: c, y: o2 } : { x: o2, y: c });
    const lo = Math.max(l1, l2);
    const hi = Math.min(u1, u2);
    if (lo <= hi + EPS) {
      // Überlappungsgebiet: Die GANZE Region muss im Korridor liegen —
      // ragt die Annäherung über das Korridor-Ende hinaus, zählt der Teil
      // außerhalb (konservativ: lieber melden als freigeben).
      const a1 = arcAt(a.points, arcsA, ptA(lo), portAAtStart);
      const a2 = arcAt(a.points, arcsA, ptA(hi), portAAtStart);
      const b1 = arcAt(b.points, arcsB, ptB(lo), portBAtStart);
      const b2 = arcAt(b.points, arcsB, ptB(hi), portBAtStart);
      if (![a1, a2, b1, b2].every(Number.isFinite)) return null;
      return {
        aLo: Math.min(a1, a2),
        aHi: Math.max(a1, a2),
        bLo: Math.min(b1, b2),
        bHi: Math.max(b1, b2),
      };
    }
    // Kein Überlapp: nächstes Endpunkt-Paar am Spalt (deterministisch:
    // A-Kante links vom B-Spann oder rechts davon).
    const aEdge = u1 < l2 ? u1 : l1;
    const bEdge = u1 < l2 ? l2 : u2;
    return pointLocusArcs(a, arcsA, portAAtStart, ptA(aEdge), b, arcsB, portBAtStart, ptB(bEdge));
  }

  // Senkrecht: Kreuzung/Berührung, sonst Endpunkt-Projektion.
  const [hs, vs] = h1 ? [s1, s2] : [s2, s1];
  const xH0 = Math.min(hs[0].x, hs[1].x);
  const xH1 = Math.max(hs[0].x, hs[1].x);
  const yV0 = Math.min(vs[0].y, vs[1].y);
  const yV1 = Math.max(vs[0].y, vs[1].y);
  const ox = vs[0].x;
  const oy = hs[0].y;
  if (ox >= xH0 - EPS && ox <= xH1 + EPS && oy >= yV0 - EPS && oy <= yV1 + EPS) {
    const crossing = { x: ox, y: oy };
    return pointLocusArcs(a, arcsA, portAAtStart, crossing, b, arcsB, portBAtStart, crossing);
  }
  // Kandidaten: Endpunkte des einen auf die Spanne des anderen projiziert.
  // Feste Reihenfolge, strikt kleinere Distanz gewinnt (Determinismus).
  //
  // WICHTIG (Fix 2026-10-03): `hs`/`vs` können gegenüber `(s1, s2)` VERTAUSCHT
  // sein — nämlich dann, wenn `s1` senkrecht ist. Jeder Kandidat muss deshalb
  // auf der Seite abgelegt werden, auf der er tatsächlich liegt; sonst misst
  // `pointLocusArcs` den Bogen auf dem falschen Pfad und liefert `NaN`, sobald
  // der Punkt dort nicht liegt. Genau das ist passiert: `complex`,
  // `e-fuse-fridge ↔ e-fuse-fan` (2 px, gemeinsamer Fusebox-Port, Bögen 38/40
  // < 68) ist ein legitimer Bündel-Fall, wurde aber als I3 gezählt, weil der
  // Punkt `(912,236)` auf dem Weg der Gegenseite gesucht wurde.
  const dist = (p: Point, q: Point): number => Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
  const hsIsS1 = h1;
  let best: { pA: Point; pB: Point; d: number } | undefined;
  const consider = (pHs: Point, pVs: Point): void => {
    const d = dist(pHs, pVs);
    if (!best || d < best.d - EPS) {
      best = hsIsS1 ? { pA: pHs, pB: pVs, d } : { pA: pVs, pB: pHs, d };
    }
  };
  for (const endpoint of hs) {
    consider(endpoint, { x: ox, y: clampCoord(endpoint.y, yV0, yV1) });
  }
  for (const endpoint of vs) {
    consider({ x: clampCoord(endpoint.x, xH0, xH1), y: oy }, endpoint);
  }
  if (!best) return null;
  return pointLocusArcs(a, arcsA, portAAtStart, best.pA, b, arcsB, portBAtStart, best.pB);
}

/**
 * Ist diese Abstands-Unterschreitung (I3, `weighted` des Kollisionsmodells)
 * die legitime Port-Bündelung zweier Kanten, die sich eine Anschlussstelle
 * teilen? Nur dann darf sie aus der I3-Zählung fallen — jede andere
 * Unterschreitung bleibt eine gemeldete Verletzung.
 *
 * Kriterium (ADR 0031, verschärft 2026-10-03 — Locus-Regel):
 *
 *  1. **Gemeinsame Anschlussstelle:** Beide Kanten haben einen identischen
 *     Endpunkt (den gemeinsamen Port).
 *  2. **Locus im Port-Korridor:** Die Stelle der nächsten Annäherung liegt
 *     auf BEIDEN Pfaden innerhalb `maxArcFromPort` Bogenlänge vom gemeinsamen
 *     Port. Bei flächiger Annäherung (parallele Überlappung) muss die GANZE
 *     Region im Korridor liegen — ein Herausragen über das Korridor-Ende
 *     hinaus zählt als Verletzung (konservativ).
 *
 *  `maxArcFromPort` ist das designede Korridor-Maß: `portFacingClearance`
 *  (ADR 0027) = `stubMin + 2·laneGrid + cableClearance` — Stub plus zwei
 *  Lane-Schritte plus Freigabe. Bis dorthin konvergieren zwei Kanten an
 *  einer Klemme zwangsläufig (die Freigabe, die I2 für den Stub kennt);
 *  dahinter hat jede Kante ihre eigene Lane — Nähe ist dann gesuchte
 *  Geometrie, die der Router hätte meiden können, und zählt.
 *
 *  Die frühere Fassung („erste/zwei letzte Segmente") konnte bei kurzen
 *  Pfaden gesuchte Segmente freistellen, deren Annäherung weit jenseits des
 *  Korridors lag. Die Locus-Regel schneidet das Segment-Fenster ab: Ein
 *  Segment, das vom Port bis weit läuft, ist nur bis Bogenlänge 68 freigestellt.
 */
export function isPortBundleProximity(
  a: RoutedPathGeometry,
  b: RoutedPathGeometry,
  s1: Segment,
  s2: Segment,
  maxArcFromPort: number
): boolean {
  // Gemeinsamer Port (wie sharesPort, aber mit Fundstelle für die Seite).
  const a0 = a.points[0];
  const aN = a.points[a.points.length - 1];
  const b0 = b.points[0];
  const bN = b.points[b.points.length - 1];
  if (!a0 || !aN || !b0 || !bN) return false;
  let sideA: 'start' | 'end' | undefined;
  let sideB: 'start' | 'end' | undefined;
  if (samePoint(a0, b0)) {
    sideA = 'start';
    sideB = 'start';
  } else if (samePoint(a0, bN)) {
    sideA = 'start';
    sideB = 'end';
  } else if (samePoint(aN, b0)) {
    sideA = 'end';
    sideB = 'start';
  } else if (samePoint(aN, bN)) {
    sideA = 'end';
    sideB = 'end';
  }
  if (sideA === undefined || sideB === undefined) return false;

  const portAAtStart = sideA === 'start';
  const portBAtStart = sideB === 'start';
  const arcsA = arcsFromEnd(a.points, portAAtStart);
  const arcsB = arcsFromEnd(b.points, portBAtStart);
  const locus = closestLocusArcs(a, arcsA, portAAtStart, b, arcsB, portBAtStart, s1, s2);
  if (!locus) return false;
  return locus.aHi <= maxArcFromPort + EPS && locus.bHi <= maxArcFromPort + EPS;
}
