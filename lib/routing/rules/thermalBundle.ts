import { ROUTING_TOKENS } from '../tokens';
import { SegmentSpatialIndex } from '../geometry/segmentSpatialIndex';
import type { Segment } from '../geometry';
import { designAmpacity } from '../../electrical';

/**
 * Thermische Bündel-Detektion aus der Geometrie — Mission Stufe 2, L2 aus
 * `docs/ROUTING-MULTIPHYSICS.md` §3.2 („hier trifft sich Routing auf Physik").
 *
 * Zwei Kanten $e \ne f$ gehören zusammen (Bündel-Relation $\sim$), wenn es
 * parallele Segmente $s \in e$, $t \in f$ mit perpendikulärem Abstand
 * $\le W_{Kanal}$ und Projektions-Overlap $\ge L_{\min}$ gibt. $\sim$ wird
 * über die transitiv abgeschlossene Komponentenbildung ausgewertet — ein
 * reiner Index-Scan über den bestehenden `SegmentSpatialIndex`, kein neues
 * Datenmodell und **kein** Verhalten im Produktivpfad (Evaluierung/Validierung
 * nach L2/L3: „inkrementell cachen" bleibt Stufe-3-Ausbau).
 *
 * Determinismus (R5): Eingabeliste wird lexikografisch sortiert, Komponenten
 * und Mitglieder werden kanonisch sortiert, Nachbarschaftslisten werden
 * sortiert durchlaufen — gleiche Eingabe ⇒ bitidentisches Ergebnis.
 *
 * Bezug „Blades" (Mission): Die parallelen Segmente SIND die Blades des
 * Bündels; die Erkennung läuft über den Geometrie-Index gemäß Master-Spec
 * §3.2. Die `LaneRegistry` (Korridor-Lanes) bleibt bewusst UNgekoppelt — sie
 * ist laut `laneRegistry.ts` nicht im Produktivpfad, ein Seiteneinbau hier
 * würde genau diese Grenze aufbrechen.
 */

export type ThermalBundle = {
  /** Mitglieder, lexikografisch sortiert. */
  edgeIds: string[];
  /** Summe der Projektions-Überlappungslängen aller erkannten Segment-Paare (px). */
  parallelLengthPx: number;
};

/**
 * Kanalbreche $W_{Kanal}$: Abstand, bis zu dem zwei parallele Leiter als
 * Bündel gelten — `$2 · laneGrid` laut §3.2 (Beispielwert im Spec).
 */
export const BUNDLE_CHANNEL_WIDTH_PX = 2 * ROUTING_TOKENS.laneGrid;

/** Mindest-Projektions-Overlap $L_{\min}$ je Paar — `$4 · laneGrid` laut §3.2. */
export const BUNDLE_MIN_PARALLEL_PX = 4 * ROUTING_TOKENS.laneGrid;

// ── Bundle-Margin (Mission: „Bundle-Margin" < 1,0 verbieten / < 1,25 strafen) ─

/** Margin $< 1{,}0$: Belastung über der Bündel-Belastbarkeit — hart (verboten). */
export const BUNDLE_MARGIN_OVERLOAD_LT = 1.0;
/** Margin $< 1{,}25$: knappe Reserve — weiche Strafe (kein Verbot). */
export const BUNDLE_MARGIN_PENALTY_LT = 1.25;

export type BundleMarginClass = 'overload' | 'penalty' | 'ok';

/**
 * Einordnung der Margin $I_{z,eff}(A, n) \,/\, I$ (MISSION-Stufen 1,0/1,25):
 *   $< 1{,}0$  ⇒ `overload` (hart, Verbotskandidat)
 *   $< 1{,}25$ ⇒ `penalty` (weich)
 *   sonst      ⇒ `ok`
 *
 * `+Infinity` (Nullstrom, keine Belastung) ⇒ `ok`; NaN/negativ ⇒ RangeError
 * (Regel M: fehlende/ungültige Eingabe wird nicht still „ok").
 */
export function classifyBundleMargin(margin: number): BundleMarginClass {
  if (Number.isNaN(margin) || margin < 0) {
    throw new RangeError(`classifyBundleMargin: ungültige Margin ${margin}`);
  }
  if (margin < BUNDLE_MARGIN_OVERLOAD_LT) return 'overload';
  if (margin < BUNDLE_MARGIN_PENALTY_LT) return 'penalty';
  return 'ok';
}

/**
 * Margin eines Leiters im Bündel $n$: $I_{z,eff} / I$ mit der Spec-Formel
 * $I_{z,eff} = I_{z,Tabelle}(A) \cdot k_B(n)$ (Basis B2/30 °C,
 * $k_\vartheta = k_V = 1$, §3.2). Unbekannter Querschnitt liefert
 * $I_{z,eff} = 0$ ⇒ Margin 0 ⇒ `overload` — **fail-safe in die sichere
 * Richtung**, nie ein stiller „ok"-Fallback (Regel M).
 *
 * @throws RangeError wenn `currentA` nicht endlich oder negativ ist
 *   (0 A bleibt zulässig ⇒ `+Infinity`).
 */
export function bundleMargin(currentA: number, crossSectionMm2: number, bundleCircuits: number): number {
  if (!Number.isFinite(currentA) || currentA < 0) {
    throw new RangeError(`bundleMargin: ungültiger Strom ${currentA}`);
  }
  if (currentA === 0) return Number.POSITIVE_INFINITY;
  return designAmpacity(crossSectionMm2, bundleCircuits) / currentA;
}

// ── Geometrische Bündel-Relation (§3.2) ──────────────────────────────────

/**
 * Projektions-Overlap eines parallelen Segmentpaars, oder `null`, wenn die
 * Bedingungen nicht gelten. Segmente sind achsenparallel (Routing-Invariante);
 * degenerierte (punktförmige) Segmente werden verworfen.
 */
function parallelOverlapPx(s: Segment, t: Segment, channelPx: number, minPx: number): number | null {
  const [a, b] = s;
  const [c, d] = t;
  const sZero = a.x === b.x && a.y === b.y;
  const tZero = c.x === d.x && c.y === d.y;
  if (sZero || tZero) return null;

  const sH = a.y === b.y;
  const tH = c.y === d.y;
  const sV = a.x === b.x;
  const tV = c.x === d.x;

  if (sH && tH) {
    if (Math.abs(a.y - c.y) > channelPx) return null;
    const lo1 = Math.min(a.x, b.x);
    const hi1 = Math.max(a.x, b.x);
    const lo2 = Math.min(c.x, d.x);
    const hi2 = Math.max(c.x, d.x);
    const overlap = Math.min(hi1, hi2) - Math.max(lo1, lo2);
    return overlap >= minPx ? overlap : null;
  }
  if (sV && tV) {
    if (Math.abs(a.x - c.x) > channelPx) return null;
    const lo1 = Math.min(a.y, b.y);
    const hi1 = Math.max(a.y, b.y);
    const lo2 = Math.min(c.y, d.y);
    const hi2 = Math.max(c.y, d.y);
    const overlap = Math.min(hi1, hi2) - Math.max(lo1, lo2);
    return overlap >= minPx ? overlap : null;
  }
  return null; // unterschiedliche Orientierung ⇒ nicht parallel
}

/**
 * Erkennt thermische Bündel über die Bündel-Relation §3.2.
 *
 * @param segmentsOf Segmente einer Kante (einmalig aufgerufen — dieselben
 *   Objekt-Referenzen speist der Reverse-Lookup und das Index).
 * @param edgeIds Kandidaten; wird lexikografisch sortiert (R5).
 * @param opts Kanalbreite/Mindest-Overlap, Default `$2·laneGrid` / `$4·laneGrid`.
 * @returns Komponenten, kanonisch sortiert; Einzelkanten (kein Partner)
 *   KEIN Bündel und werden nicht geliefert.
 */
export function detectThermalBundles(
  segmentsOf: (edgeId: string) => readonly Segment[],
  edgeIds: readonly string[],
  opts?: { channelWidthPx?: number; minLengthPx?: number }
): ThermalBundle[] {
  const channel = opts?.channelWidthPx ?? BUNDLE_CHANNEL_WIDTH_PX;
  const minLen = opts?.minLengthPx ?? BUNDLE_MIN_PARALLEL_PX;
  const ids = [...new Set(edgeIds)].sort();

  const all: Segment[] = [];
  const ownerOf = new Map<Segment, string>();
  const segmentsById = new Map<string, Segment[]>();
  for (const id of ids) {
    const segs = [...segmentsOf(id)];
    segmentsById.set(id, segs);
    for (const seg of segs) {
      all.push(seg);
      ownerOf.set(seg, id);
    }
  }

  const index = new SegmentSpatialIndex(all);
  const adj = new Map<string, Set<string>>();
  const parallelPx = new Map<string, number>(); // "e|f" (e < f) → Summe Overlaps
  for (const id of ids) adj.set(id, new Set());

  for (const id of ids) {
    for (const s of segmentsById.get(id) ?? []) {
      const candidates = index.queryNear(s[0], s[1], channel);
      for (const other of candidates) {
        const f = ownerOf.get(other);
        if (f === undefined || f === id) continue;
        const overlap = parallelOverlapPx(s, other, channel, minLen);
        if (overlap === null) continue;
        adj.get(id)!.add(f);
        adj.get(f)!.add(id);
        // Jedes ungerichtete Paar genau einmal summieren (der Scan sieht es
        // von beiden Seiten — R5: keine Doppelzählung).
        if (id < f) {
          const key = `${id}|${f}`;
          parallelPx.set(key, (parallelPx.get(key) ?? 0) + overlap);
        }
      }
    }
  }

  // Zusammenhängende Komponenten über sortierte Nachbarn (deterministisches DFS).
  const seen = new Set<string>();
  const bundles: ThermalBundle[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const component: string[] = [];
    const stack = [id];
    seen.add(id);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      component.push(cur);
      const neighbors = [...(adj.get(cur) ?? [])].sort();
      for (const nb of neighbors) {
        if (seen.has(nb)) continue;
        seen.add(nb);
        stack.push(nb);
      }
    }
    if (component.length < 2) continue; // Singletons sind kein Bündel
    component.sort();
    let parallel = 0;
    for (let i = 0; i < component.length; i++) {
      for (let j = i + 1; j < component.length; j++) {
        parallel += parallelPx.get(`${component[i]}|${component[j]}`) ?? 0;
      }
    }
    bundles.push({ edgeIds: component, parallelLengthPx: parallel });
  }
  bundles.sort((a, b) => (a.edgeIds[0]! < b.edgeIds[0]! ? -1 : a.edgeIds[0]! > b.edgeIds[0]! ? 1 : 0));
  return bundles;
}
