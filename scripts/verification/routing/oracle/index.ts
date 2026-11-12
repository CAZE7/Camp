/**
 * Orakel-Prüfung: I1–I6 als **reine** Geometrie, ohne Ausnahmen.
 *
 * Warum ohne Ausnahmen
 * ====================
 * Der Produktivpfad kennt dokumentierte Ausnahmen (Port-Bündel ADR 0009/0025,
 * gegenüberliegende Stubs ROUTE-BUG-7). Ein Orakel, das diese Ausnahmen
 * nachbaut, wäre eine zweite Interpretation derselben Sonderfälle — und damit
 * genau die Fehlerquelle, die es finden soll.
 *
 * Deshalb prüft das Orakel **streng**: es meldet einen Obermengen-Befund. Die
 * Kreuzprobe (`crosscheck.ts`) verlangt dann zwei Dinge:
 *
 *   1. Jede Verletzung der Produktivprüfung MUSS im Orakel auftauchen.
 *      (Sonst meldet der Produktivpfad etwas, das geometrisch nicht existiert.)
 *   2. Jede **nur** im Orakel gefundene Verletzung MUSS durch eine dokumentierte
 *      Ausnahme erklärbar sein. (Sonst verschluckt der Produktivpfad etwas.)
 *
 * I7 (Treppenmuster) ist bewusst **nicht** Teil des Orakels: es ist eine
 * Qualitätsheuristik, keine geometrische Invariante. Ein Orakel, das eine
 * Heuristik nachbaut, prüft die Heuristik gegen sich selbst. Siehe
 * docs/ROUTING-QUALITY-AND-VERIFICATION.md §5.1.
 */

import type { Point, Segment } from '../../../../lib/routing/geometry';
import type { InvariantViolation, RoutedEdge } from '../../../../lib/routing/invariants';
import { ROUTING_TOKENS, type RoutingTokens } from '../../../../lib/routing/tokens';
import {
  collinearOverlap,
  segmentDistance,
  segmentHitsRect,
  segmentRectDistance,
  segmentsCross,
} from './primitives';

export type OracleInvariantId = 'I1' | 'I2' | 'I3' | 'I4' | 'I5' | 'I6';

export type OracleReport = Record<OracleInvariantId, InvariantViolation[]>;

const EPS = 1e-6;

/**
 * Eigene Vereinfachung: doppelte Punkte weg, monotone Zwischenpunkte weg.
 *
 * **Wichtig:** Eine Kehre (Punkt liegt *außerhalb* seiner Nachbarn, also
 * `(b−a)·(c−b) < 0`) bleibt stehen. Sie zu entfernen würde die Kehre
 * wegdefinieren — und damit die Invariante I4, die sie finden soll. Das ist
 * genau die Art stiller Semantikänderung, die das Orakel nicht nachbauen darf:
 * die Bedingung ist geteilt, der Code ist es nicht.
 */
export function simplifyPolyline(points: readonly Point[]): Point[] {
  const deduped: Point[] = [];
  for (const point of points) {
    const last = deduped[deduped.length - 1];
    if (last && Math.abs(last.x - point.x) <= EPS && Math.abs(last.y - point.y) <= EPS) continue;
    deduped.push({ x: point.x, y: point.y });
  }

  const out: Point[] = [];
  for (const point of deduped) {
    if (out.length >= 2) {
      const a = out[out.length - 2] as Point;
      const b = out[out.length - 1] as Point;
      const bothSameX = Math.abs(a.x - b.x) <= EPS && Math.abs(b.x - point.x) <= EPS;
      const bothSameY = Math.abs(a.y - b.y) <= EPS && Math.abs(b.y - point.y) <= EPS;
      if (bothSameX) {
        const forward = Math.sign(b.y - a.y);
        const onward = Math.sign(point.y - b.y);
        if (forward === 0 || onward === 0 || forward === onward) {
          out[out.length - 1] = point;
          continue;
        }
      }
      if (bothSameY) {
        const forward = Math.sign(b.x - a.x);
        const onward = Math.sign(point.x - b.x);
        if (forward === 0 || onward === 0 || forward === onward) {
          out[out.length - 1] = point;
          continue;
        }
      }
    }
    out.push(point);
  }
  return out;
}

/** Segmente einer Polylinie (ohne Nullsegmente). */
export function segmentsOf(points: readonly Point[]): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i + 1 < points.length; i += 1) {
    const a = points[i] as Point;
    const b = points[i + 1] as Point;
    if (Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS) continue;
    out.push([a, b]);
  }
  return out;
}

const label = (a: Point, b: Point): string => `(${a.x},${a.y})→(${b.x},${b.y})`;

/**
 * Prüft eine Kantenmenge gegen Bauteilboxen — streng, ohne Ausnahmen.
 *
 * @param edges Routen mit Waypoints (Weltkoordinaten)
 * @param nodes Bauteilboxen (dieselben, die der Router als Hindernis sieht)
 */
export function oracleReport(
  edges: readonly RoutedEdge[],
  nodes: readonly { id: string; x: number; y: number; width: number; height: number }[],
  tokens: RoutingTokens = ROUTING_TOKENS
): OracleReport {
  const report: OracleReport = { I1: [], I2: [], I3: [], I4: [], I5: [], I6: [] };
  const clearance = tokens.cableClearance;

  const prepared = edges.map((edge) => ({
    edge,
    points: simplifyPolyline(edge.waypoints),
  }));
  const withSegments = prepared.map((entry) => ({
    ...entry,
    segments: segmentsOf(entry.points),
  }));

  for (const entry of withSegments) {
    const foreign = nodes.filter((node) => node.id !== entry.edge.source && node.id !== entry.edge.target);

    // ---- I1: Durchdringung eines fremden Bauteils -------------------------
    for (const segment of entry.segments) {
      for (const rect of foreign) {
        if (segmentHitsRect(segment, rect)) {
          report.I1.push({
            invariant: 'I1',
            edgeId: entry.edge.id,
            otherId: rect.id,
            detail: `Segment ${label(segment[0], segment[1])} durchdringt ${rect.id}`,
          });
        }
      }
    }

    // ---- I3a: Freigabe zu fremden Bauteilen -------------------------------
    for (const segment of entry.segments) {
      for (const rect of foreign) {
        if (segmentHitsRect(segment, rect)) continue; // I1, nicht I3
        const distance = segmentRectDistance(segment, rect);
        if (distance < clearance - EPS) {
          report.I3.push({
            invariant: 'I3',
            edgeId: entry.edge.id,
            otherId: rect.id,
            detail: `Abstand ${distance.toFixed(2)}px < ${clearance}px zu ${rect.id}`,
          });
        }
      }
    }

    // ---- I2: Selbstüberlappung -------------------------------------------
    const own = entry.segments;
    for (let i = 0; i < own.length; i += 1) {
      for (let j = i + 1; j < own.length; j += 1) {
        if (collinearOverlap(own[i] as Segment, own[j] as Segment)) {
          report.I2.push({
            invariant: 'I2',
            edgeId: entry.edge.id,
            otherId: entry.edge.id,
            detail: `Kante ${entry.edge.id} überdeckt sich selbst kollinear (Segmente ${i}↔${j})`,
          });
        }
      }
    }

    // ---- I4: Kehre am Anschluss ------------------------------------------
    if (entry.segments.length >= 2) {
      const first = entry.segments[0] as Segment;
      const second = entry.segments[1] as Segment;
      const last = entry.segments[entry.segments.length - 1] as Segment;
      const beforeLast = entry.segments[entry.segments.length - 2] as Segment;
      if (isReversal(first, second)) {
        report.I4.push({
          invariant: 'I4',
          edgeId: entry.edge.id,
          detail: 'U-Turn direkt am Quell-Anschluss',
        });
      }
      if (isReversal(beforeLast, last)) {
        report.I4.push({
          invariant: 'I4',
          edgeId: entry.edge.id,
          detail: 'U-Turn direkt am Ziel-Anschluss',
        });
      }
    }

    // ---- I5: Stubs --------------------------------------------------------
    const firstSegment = entry.segments[0];
    const lastSegment = entry.segments[entry.segments.length - 1];
    const firstLength = firstSegment ? lengthOf(firstSegment) : 0;
    const lastLength = lastSegment ? lengthOf(lastSegment) : 0;
    if (
      entry.segments.length > 0 &&
      (firstLength < tokens.stubMin - EPS || lastLength < tokens.stubMin - EPS)
    ) {
      report.I5.push({
        invariant: 'I5',
        edgeId: entry.edge.id,
        detail: `Stub ${firstLength.toFixed(1)}/${lastLength.toFixed(1)}px < ${tokens.stubMin}px`,
      });
    }

    // ---- I6: Jedes Segment mindestens `segmentMin` ------------------------
    for (const segment of entry.segments) {
      const length = lengthOf(segment);
      if (length < tokens.segmentMin - EPS) {
        report.I6.push({
          invariant: 'I6',
          edgeId: entry.edge.id,
          detail: `Segment ${length.toFixed(1)}px < ${tokens.segmentMin}px`,
        });
        break;
      }
    }
  }

  // ---- I2/I3b: Paare verschiedener Kanten --------------------------------
  for (let i = 0; i < withSegments.length; i += 1) {
    const a = withSegments[i] as (typeof withSegments)[number];
    for (let j = i + 1; j < withSegments.length; j += 1) {
      const b = withSegments[j] as (typeof withSegments)[number];
      let overlap = false;
      let proximity: { distance: number } | null = null;
      for (const s1 of a.segments) {
        for (const s2 of b.segments) {
          if (collinearOverlap(s1, s2)) {
            overlap = true;
            break;
          }
          if (segmentsCross(s1, s2)) continue; // Kreuzung ist erlaubt, nicht I3
          const distance = segmentDistance(s1, s2);
          if (distance < clearance - EPS) {
            if (!proximity || distance < proximity.distance) proximity = { distance };
          }
        }
        if (overlap) break;
      }
      if (overlap) {
        report.I2.push({
          invariant: 'I2',
          edgeId: a.edge.id,
          otherId: b.edge.id,
          detail: `Kanten ${a.edge.id} und ${b.edge.id} überdecken sich kollinear`,
        });
      } else if (proximity) {
        report.I3.push({
          invariant: 'I3',
          edgeId: a.edge.id,
          otherId: b.edge.id,
          detail: `Abstand ${proximity.distance.toFixed(2)}px < ${clearance}px zwischen ${a.edge.id} und ${b.edge.id}`,
        });
      }
    }
  }

  return report;
}

const lengthOf = (segment: Segment): number =>
  Math.abs(segment[1].x - segment[0].x) + Math.abs(segment[1].y - segment[0].y);

const directionOf = (segment: Segment): Point => {
  const dx = segment[1].x - segment[0].x;
  const dy = segment[1].y - segment[0].y;
  return {
    x: Math.abs(dx) <= EPS ? 0 : Math.sign(dx),
    y: Math.abs(dy) <= EPS ? 0 : Math.sign(dy),
  };
};

const isReversal = (a: Segment, b: Segment): boolean => {
  const da = directionOf(a);
  const db = directionOf(b);
  const bothZero = da.x === 0 && da.y === 0;
  return !bothZero && da.x === -db.x && da.y === -db.y;
};

/** Gesamtzahl der Orakel-Verletzungen (Diagnose/Kurzbericht). */
export function oracleViolationCount(report: OracleReport): number {
  return (Object.keys(report) as OracleInvariantId[]).reduce((sum, key) => sum + report[key].length, 0);
}
