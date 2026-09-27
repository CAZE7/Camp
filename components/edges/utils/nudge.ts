import type { Point, Rect } from './pathfinding';
import {
  isOrthogonalPath,
  pathHitsObstacles,
  containsPoint,
  stitchOrthogonal,
  routeDefectScore,
  manhattan,
  countCrossings,
  pathLength,
} from './pathfinding';
import { ROUTING_TOKENS } from '../../../lib/routing/tokens';
import {
  LaneRegistry,
  laneCandidates,
  type CorridorDirection,
} from '../../../lib/routing/rules/laneRegistry';
import { classifySegmentAgainstSegment } from '../../../lib/routing/rules/collision';
import { isPortBundleOverlap, routedPathGeometry } from '../../../lib/routing/rules/portBundle';

/**
 * Globales orthogonales Nudging (libavoid-Phase 2).
 *
 * Parallele Innenstücke werden deterministisch auf Lanes verteilt.
 * Handle-Punkte bleiben. Wo ein Stub nicht mitwandern darf, setzt
 * `stitchOrthogonal` einen Ellbogen — der Pfad bleibt rechtwinklig.
 */

export const NUDGE_GAP = ROUTING_TOKENS.laneGrid; // WP-1: Token `laneGrid`
export const NUDGE_THRESHOLD = 10;
export const NUDGE_MIN_OVERLAP = ROUTING_TOKENS.cableClearance; // WP-1: Token `cableClearance`

const EPS = 1e-6;

/** Gebundener Lesezugriff in abgesicherten Schleifen — siehe pathfinding.at. */
const at = <T>(arr: readonly T[], i: number): T => {
  const v = arr[i];
  if (v === undefined) {
    throw new RangeError(`nudge.at: Index ${i} außerhalb (Länge ${arr.length})`);
  }
  return v;
};

export type NudgePath = { id: string; waypoints: Point[] };

type Seg = {
  path: number;
  i0: number;
  i1: number;
  lo: number;
  hi: number;
  perp: number;
};

const clonePaths = (paths: NudgePath[]): Point[][] =>
  paths.map((p) => p.waypoints.map((pt) => ({ x: pt.x, y: pt.y })));

const rangesOverlap = (aLo: number, aHi: number, bLo: number, bHi: number): boolean =>
  aHi >= bLo + NUDGE_MIN_OVERLAP && bHi >= aLo + NUDGE_MIN_OVERLAP;

/** Echte Überdeckung — jede Länge > EPS, genau der I2-Begriff. */
const rangesOverlapAny = (aLo: number, aHi: number, bLo: number, bHi: number): boolean =>
  aHi > bLo + EPS && bHi > aLo + EPS;

/** Liegen zwei Segmente derselben Achse kollinear (gleiche Querkoordinate)? */
const collinear = (a: PerpSpan, b: PerpSpan): boolean => Math.abs(a.perp - b.perp) <= EPS;

type PerpSpan = { lo: number; hi: number; perp: number };

/**
 * Gehören zwei Innenstücke in dieselbe Gruppe?
 *
 * ROUTE-006 / ROUTE-002-Teil-2b (2026-09-27): I2 greift bei JEDER kollinearen
 * Überdeckung > EPS. Der Nudge sah bis hierher nur Paare mit mindestens
 * `NUDGE_MIN_OVERLAP` (12 px) gemeinsamer Länge — ein 8-px-Stück auf
 * derselben Linie blieb damit stehen (gemessen im ELK-Pfad). Kollineare
 * Paare zählen jetzt ab jeder Länge; für bloß benachbarte Parallelen bleibt
 * die alte Schwelle.
 */
const sameNudgeGroup = (a: PerpSpan, b: PerpSpan): boolean => {
  if (Math.abs(a.perp - b.perp) > NUDGE_THRESHOLD) return false;
  if (collinear(a, b)) return rangesOverlapAny(a.lo, a.hi, b.lo, b.hi);
  return rangesOverlap(a.lo, a.hi, b.lo, b.hi);
};

/**
 * Segmente zwischen Stub und Gegen-Stub (i = 1 .. n-3).
 * Der lange Lauf eines 5-Punkt-L (Elbow→T2) ist damit dabei.
 * Handles (0, n-1) bleiben unangetastet.
 */
const collectInterior = (pts: Point[], axis: 'h' | 'v'): Seg[] => {
  const n = pts.length;
  if (n < 4) return [];
  const segs: Seg[] = [];
  const last = n - 3;
  for (let i = 1; i <= last; i++) {
    const a = at(pts, i);
    const b = at(pts, i + 1);
    if (axis === 'h') {
      if (Math.abs(a.y - b.y) > EPS) continue;
      segs.push({
        path: -1,
        i0: i,
        i1: i + 1,
        lo: Math.min(a.x, b.x),
        hi: Math.max(a.x, b.x),
        perp: a.y,
      });
    } else {
      if (Math.abs(a.x - b.x) > EPS) continue;
      segs.push({
        path: -1,
        i0: i,
        i1: i + 1,
        lo: Math.min(a.y, b.y),
        hi: Math.max(a.y, b.y),
        perp: a.x,
      });
    }
  }
  return segs;
};

const clustersOf = (segs: Seg[]): number[][] => {
  const n = segs.length;
  const parent = new Array<number>(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (a: number): number => {
    while (at(parent, a) !== a) {
      parent[a] = at(parent, at(parent, a));
      a = at(parent, a);
    }
    return a;
  };
  const union = (a: number, b: number) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent[b] = a;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!sameNudgeGroup(at(segs, i), at(segs, j))) continue;
      union(i, j);
    }
  }

  const buckets = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const list = buckets.get(r);
    if (list) list.push(i);
    else buckets.set(r, [i]);
  }
  return Array.from(buckets.values()).filter((g) => g.length > 1);
};

/** Nur echte Innenpunkte verschieben — Stubs bekommen später einen Ellbogen. */
const isFreeVertex = (index: number, n: number): boolean => index >= 2 && index <= n - 3;

const applyAxis = (
  clones: Point[][],
  originals: Point[][],
  pathIds: string[],
  axis: 'h' | 'v',
  gap: number
): void => {
  const segs: Seg[] = [];
  for (let p = 0; p < originals.length; p++) {
    const found = collectInterior(at(originals, p), axis);
    for (let k = 0; k < found.length; k++) {
      const seg = at(found, k);
      seg.path = p;
      segs.push(seg);
    }
  }
  if (segs.length < 2) return;

  const groups = clustersOf(segs);
  for (let g = 0; g < groups.length; g++) {
    const group = at(groups, g);
    const byPath = new Map<number, number[]>();
    for (let t = 0; t < group.length; t++) {
      const si = at(group, t);
      const p = at(segs, si).path;
      const list = byPath.get(p);
      if (list) list.push(si);
      else byPath.set(p, [si]);
    }
    if (byPath.size < 2) continue;

    const firstSegIndexOf = (pathIdx: number): number => at(byPath.get(pathIdx)!, 0);
    const pathOrder = Array.from(byPath.keys()).sort((pa, pb) => {
      const da = at(segs, firstSegIndexOf(pa)).perp - at(segs, firstSegIndexOf(pb)).perp;
      if (Math.abs(da) > EPS) return da;
      return at(pathIds, pa).localeCompare(at(pathIds, pb));
    });

    let mean = 0;
    for (let i = 0; i < pathOrder.length; i++) {
      mean += at(segs, firstSegIndexOf(at(pathOrder, i))).perp;
    }
    mean /= pathOrder.length;

    for (let k = 0; k < pathOrder.length; k++) {
      const p = at(pathOrder, k);
      const target = mean + (k - (pathOrder.length - 1) / 2) * gap;
      const delta = target - at(segs, firstSegIndexOf(p)).perp;
      if (Math.abs(delta) < EPS) continue;
      const pts = at(clones, p);
      const n = pts.length;
      const moved = new Set<number>();
      const list = byPath.get(p)!;
      for (let s = 0; s < list.length; s++) {
        const seg = at(segs, at(list, s));
        const ends = [seg.i0, seg.i1];
        // ROUTE-BUG-17: Ein Segment wandert nur als Ganzes. Wandert nur ein
        // Ende (das andere gehört zu einem Stub), entsteht eine Diagonale,
        // die `stitchOrthogonal` mit einem Ellbogen flickt — die Kante macht
        // dann einen Haken am Handle (I4) oder ein Kurzsegment (I6).
        let movable = true;
        for (let e = 0; e < 2; e++) {
          if (!isFreeVertex(at(ends, e), n)) movable = false;
        }
        if (!movable) continue;
        for (let e = 0; e < 2; e++) {
          const idx = at(ends, e);
          if (moved.has(idx)) continue;
          moved.add(idx);
          if (axis === 'h') at(pts, idx).y += delta;
          else at(pts, idx).x += delta;
        }
      }
    }
  }
};

const obstaclesForPath = (obstacles: Rect[], start: Point, end: Point): Rect[] => {
  const out: Rect[] = [];
  for (let i = 0; i < obstacles.length; i++) {
    const r = at(obstacles, i);
    if (containsPoint(r, start) || containsPoint(r, end)) continue;
    out.push(r);
  }
  return out;
};

/**
 * Ist dieses Segment als Ganzes verschiebbar?
 *
 * Beide Enden müssen Innenpunkte sein (kein Handle). Bewusst NICHT auf
 * `isFreeVertex` eingeschränkt (ROUTE-006, 2026-09-27): Genau die Läufe, die
 * einander am Port überdecken, haben einen Ellbogen direkt neben dem Stub —
 * `i0 = 1` bzw. `i1 = n−2`. Ihr Versatz ist zulässig, weil ein Segment nur
 * ALS GANZES wandert (ROUTE-BUG-17) und quer zu seinen Nachbarn liegt: Die
 * Anschluss-Stubs bleiben dadurch auf ihrer Achse, nur ihre Länge ändert sich.
 * Diese Länge ist die Stub-Verlängerung — genau der Lane-Begriff des
 * Port-Fan-Outs (`lane`), hier geometrisch statt am Port gerechnet.
 */
const movableSegment = (seg: Seg, n: number): boolean =>
  seg.i0 >= 1 && seg.i1 >= 1 && seg.i0 <= n - 2 && seg.i1 <= n - 2;

/**
 * Kreuzungen eines Pfads gegen die übrigen Pfade (harte X-Schnitte,
 * `countCrossings`). Der Zug darf keine Kreuzung erzeugen: Gemessen kostete
 * die erste Fassung dieses Passes im Stress-Szenario „1 Batterie +
 * 10 Verbraucher“ vier zusätzliche Kreuzungen (9 statt 5) — eine
 * Überdeckung auflösen ist kein Freibrief für ein Kreuzungsmeer.
 */
const crossingsAgainstOthers = (candidate: Point[], others: readonly Point[][]): number =>
  countCrossings(
    candidate,
    others.flatMap((other) => [...routedPathGeometry(other).segments])
  );

/** Länge des ersten/letzten Segments (Stubs) — Vertrag mit I5. */
const stubLengthsOk = (pts: Point[]): boolean => {
  if (pts.length < 2) return true;
  const first = manhattan(at(pts, 0), at(pts, 1));
  const last = manhattan(at(pts, pts.length - 2), at(pts, pts.length - 1));
  return first >= ROUTING_TOKENS.stubMin - EPS && last >= ROUTING_TOKENS.stubMin - EPS;
};

/** Verschiebt beide Enden eines Segments quer zur Achse (nur Innenpunkte). */
const shiftSegment = (pts: Point[], seg: Seg, axis: 'h' | 'v', delta: number): void => {
  for (const idx of [seg.i0, seg.i1]) {
    if (axis === 'h') at(pts, idx).y += delta;
    else at(pts, idx).x += delta;
  }
};

/**
 * Zählt harte kollineare Überdeckungen (I2) eines Pfads gegen alle anderen —
 * die Port-Bündel-Ausnahme (ADR 0009) kommt aus derselben Regel wie die
 * Invariante, damit der Nudge sie nicht wegoptimiert.
 */
const hardOverlapsAgainstOthers = (candidate: Point[], others: readonly Point[][]): number => {
  const geoA = routedPathGeometry(candidate);
  let count = 0;
  for (const other of others) {
    const geoB = routedPathGeometry(other);
    for (const s1 of geoA.segments) {
      for (const s2 of geoB.segments) {
        if (classifySegmentAgainstSegment(s1, s2).class !== 'hard') continue;
        if (isPortBundleOverlap(geoA, geoB, s1, s2)) continue;
        count += 1;
      }
    }
  }
  return count;
};

/**
 * ROUTE-001 / WP-8 (2026-09-27): Auflösung kollinearer Einzel-Überdeckungen.
 *
 * Der Cluster-Pass oben verteilt nur Gruppen mit mindestens ZWEI beweglichen
 * Teilnehmern. Gemessen im ELK-Pfad bleiben genau die Fälle übrig, in denen
 * nur EINE Seite beweglich ist: ein Freiwinkel-Pfad kreuzt die Linie eines
 * 4-Punkt-Pfads (dessen Innenknoten nicht frei ist) oder läuft auf den Stub
 * einer anderen Kante. Hier zieht der bewegliche Teilnehmer deshalb auf die
 * nächstgelegene FREIE Lane — die Kandidaten kommen aus der LaneRegistry
 * (`laneCandidates`, WP-5), also aus derselben Leiter
 * (`laneIndex × laneGrid` um die Korridor-Referenz), die auch die
 * Lane-Vergabe benutzt.
 *
 * Gegenüber stehen dabei **alle** Segmente fremder Pfade — Stubs
 * eingeschlossen; nur der Beweger muss ein bewegliches Innenstück sein.
 * Bewertet wird mit denselben Bedingungen wie oben (orthogonal,
 * hindernisfrei, Mängel-Strafe nicht schlechter) plus einer harten
 * Zusatzbedingung: **der Zug darf keine neue kollineare Überdeckung
 * erzeugen** (I2) — sonst würde der Nudge an einer Stelle reparieren, was er
 * an der anderen anrichtet. Die Port-Bündel-Ausnahme (ADR 0009) gilt dabei,
 * kommt aber aus derselben Regel wie die Invariante.
 *
 * Deterministisch: Kandidatenreihenfolge aus der Registry, Pfade in
 * Index-Reihenfolge, erster passender Kandidat gewinnt (ADR 0010).
 */
const displaceSingleMovers = (
  clones: Point[][],
  originals: Point[][],
  pathIds: string[],
  axis: 'h' | 'v',
  gap: number,
  obstacles: Rect[]
): void => {
  const spansOf = (pts: Point[]): PerpSpan[] => {
    const out: PerpSpan[] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = at(pts, i);
      const b = at(pts, i + 1);
      const onAxis = axis === 'h' ? Math.abs(a.y - b.y) <= EPS : Math.abs(a.x - b.x) <= EPS;
      if (!onAxis) continue;
      const lo = axis === 'h' ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
      const hi = axis === 'h' ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
      out.push({ lo, hi, perp: axis === 'h' ? a.y : a.x });
    }
    return out;
  };

  const registry = new LaneRegistry();
  const direction: CorridorDirection = axis === 'h' ? 'horizontal' : 'vertical';
  const handled = new Set<string>();

  for (let p = 0; p < originals.length; p++) {
    const n = at(originals, p).length;
    const interiors = collectInterior(at(originals, p), axis);
    for (let k = 0; k < interiors.length; k++) {
      const mover = at(interiors, k);
      if (!movableSegment(mover, n)) continue; // nur verschiebbare Segmente sind Beweger
      const key = `${at(pathIds, p)}|${axis}|${mover.perp}`;
      if (handled.has(key)) continue;

      // Fremdgeometrie aus dem AKTUELLEN Arbeitsstand: Hat schon ein anderer
      // Pfad ausgewichen, sieht dieser Beweger die neue Lage — sonst zögen
      // beide auf dieselbe Lane und die Überdeckung bliebe stehen.
      const foreign = originals
        .map((_, idx) => idx)
        .filter((idx) => idx !== p)
        .flatMap((idx) => spansOf(at(clones, idx)));
      const blocked = foreign.some(
        (f) => collinear(f, mover) && rangesOverlapAny(f.lo, f.hi, mover.lo, mover.hi)
      );
      if (!blocked) continue;
      handled.add(key);

      const working = at(clones, p);
      const baselinePath = at(originals, p);
      const othersNow = clones.filter((_, idx) => idx !== p);
      const corridor = registry.corridorFor(direction, mover.perp, mover.lo, mover.hi);
      const baselineDefect = routeDefectScore(baselinePath);
      const baselineLength = pathLength(baselinePath);
      const baselineCrossings = crossingsAgainstOthers(baselinePath, othersNow);
      const candidates = laneCandidates(corridor, gap, { limit: 6 });

      for (const coord of candidates) {
        const delta = coord - mover.perp;
        if (Math.abs(delta) < EPS) continue;
        const trial = working.map((pt) => ({ x: pt.x, y: pt.y }));
        shiftSegment(trial, mover, axis, delta);
        trial[0] = { x: at(working, 0).x, y: at(working, 0).y };
        trial[trial.length - 1] = {
          x: at(working, working.length - 1).x,
          y: at(working, working.length - 1).y,
        };
        const repaired = stitchOrthogonal(trial);
        const relevant = obstaclesForPath(
          obstacles,
          at(baselinePath, 0),
          at(baselinePath, baselinePath.length - 1)
        );
        const ok =
          isOrthogonalPath(repaired) &&
          (relevant.length === 0 || !pathHitsObstacles(repaired, relevant)) &&
          // Gegenüber dem ORIGINAL, damit die Summe mehrerer Züge nicht doch
          // schlechter wird als der Ausgangszustand.
          routeDefectScore(repaired) <= baselineDefect + EPS &&
          pathLength(repaired) <= baselineLength + 1e-6 &&
          stubLengthsOk(repaired) &&
          hardOverlapsAgainstOthers(repaired, othersNow) === 0 &&
          crossingsAgainstOthers(repaired, othersNow) <= baselineCrossings;
        if (!ok) continue;
        working.length = 0;
        for (const pt of repaired) working.push({ x: pt.x, y: pt.y });
        break;
      }
    }
  }
};

/**
 * Schiebt parallele Innenstücke auseinander. Start- und Zielpunkte bleiben.
 * Pfade, die danach ein fremdes Hindernis schneiden, fallen auf das Original zurück.
 */
export function nudgeOrthogonalPaths(
  paths: NudgePath[],
  options?: { obstacles?: Rect[]; gap?: number }
): Map<string, Point[]> {
  const out = new Map<string, Point[]>();
  if (paths.length === 0) return out;

  const originals = clonePaths(paths);
  const clones = clonePaths(paths);
  const ids = paths.map((p) => p.id);
  const gap = options?.gap ?? NUDGE_GAP;
  const obstacles = options?.obstacles ?? [];

  applyAxis(clones, originals, ids, 'h', gap);
  applyAxis(clones, originals, ids, 'v', gap);
  // ROUTE-001: Einzel-Überdeckungen, die der Cluster-Pass nicht sieht.
  displaceSingleMovers(clones, originals, ids, 'h', gap, obstacles);
  displaceSingleMovers(clones, originals, ids, 'v', gap, obstacles);

  for (let i = 0; i < paths.length; i++) {
    const id = at(ids, i);
    const orig = at(originals, i);
    const clone = at(clones, i);
    const start = at(orig, 0);
    const end = at(orig, orig.length - 1);
    clone[0] = { x: start.x, y: start.y };
    clone[clone.length - 1] = { x: end.x, y: end.y };

    const changed = clone.some(
      (p, j) => Math.abs(p.x - at(orig, j).x) > EPS || Math.abs(p.y - at(orig, j).y) > EPS
    );
    const repaired = changed ? stitchOrthogonal(clone) : orig;
    const relevant = obstaclesForPath(obstacles, start, end);
    // ROUTE-BUG-8: Nudging darf eine Route nur verbessern. Ein verschobener
    // Punkt kann den Ellbogen neben einem Stub entstehen lassen — der Pfad
    // bleibt dann zwar orthogonal, kehrt aber am Handle um (I4) oder baut ein
    // Kurzsegment ein (I6). Solche Varianten werden verworfen: Akzeptiert
    // wird nur, was orthogonal UND hindernisfrei ist und die Mängel-Strafe
    // nicht erhöht.
    const ok =
      isOrthogonalPath(repaired) &&
      (relevant.length === 0 || !pathHitsObstacles(repaired, relevant)) &&
      routeDefectScore(repaired) <= routeDefectScore(orig) + EPS;
    out.set(id, ok ? repaired : orig);
  }
  return out;
}
