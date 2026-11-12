/**
 * scripts/verification/routing/coreGate.ts — Freigabekette für den Routing-Kern.
 *
 * Warum diese Datei existiert
 * ===========================
 * Vorher gab es `validateCore()` — und niemanden, der sie aufrief. Eine
 * Prüffunktion, die nur in Tests läuft, schützt das Produkt nicht: sie sagt
 * „das war ungültig", nachdem es längst veröffentlicht wurde.
 *
 * Diese Datei ist die **eine** Stelle, an der ein Kern-Ergebnis freigegeben
 * werden darf. Sie ist absichtlich so gebaut, dass man an ihr nicht vorbeikommt,
 * ohne den Umweg sichtbar zu machen:
 *
 *   · `publishableRoutes()` gibt entweder **alle** Routen oder `null` zurück.
 *     Es gibt keinen Zustand „teilweise gültig" — bei `FAIL` bleibt der letzte
 *     gültige Stand stehen (der Aufrufer veröffentlicht nichts).
 *   · Das Urteil stammt aus **zwei** unabhängigen Prüfungen: der eingefrorenen
 *     Produktivprüfung (`validateCore` → `checkInvariants`) und dem Orakel
 *     (`crosscheck`, eigene Geometrie). Widersprechen sie sich, ist das ein
 *     `FAIL` — unabhängig davon, welche Seite recht hat.
 *   · Jedes `FAIL` trägt einen **Grund** in Klartext. Ein Gate, das nur
 *     „ungültig" sagt, führt zu Raterei oder zum Abschalten des Gates.
 *
 * Was hier NICHT passiert
 * =======================
 * Keine Reparatur, kein Nachbessern, keine gelockerte Prüfung. Wenn das
 * Ergebnis nicht durchkommt, kommt es nicht durch. Genau deshalb darf dieser
 * Code nicht in den Kern wandern: der Kern soll routen, nicht über sich selbst
 * urteilen.
 */

import type { CoreInput, CoreResult } from '../../../docs/research/routing-core/kernel';
import { routeCore, validateCore } from '../../../docs/research/routing-core/kernel';
import type { InvariantViolation, NodeRect, RoutedEdge } from '../../../lib/routing/invariants';
import type { Point } from '../../../lib/routing/geometry';
import { crosscheck, type CrosscheckResult } from './oracle/crosscheck';

export type GateStatus = 'PASS' | 'FAIL';

export type GateVerdict = {
  readonly status: GateStatus;
  /** Immer vorhanden — auch bei `FAIL`, für Fehlerakten und Diagnose. */
  readonly result: CoreResult;
  /** Produktivprüfung (I1–I7 über die eingefrorene Instanz). */
  readonly validation: ReturnType<typeof validateCore>;
  /** Gegenprobe mit unabhängiger Geometrie. */
  readonly oracle: CrosscheckResult;
  /** Klartext-Gründe; leer bei `PASS`. */
  readonly reasons: readonly string[];
  /** Routen, die veröffentlicht werden dürfen — `null` bei `FAIL`. */
  readonly publishable: ReadonlyMap<string, Point[]> | null;
};

const nodeRectsOf = (input: CoreInput): NodeRect[] =>
  input.nodes.map((node) => ({
    id: node.id,
    x: node.rect.x,
    y: node.rect.y,
    width: node.rect.width,
    height: node.rect.height,
  }));

const routedEdgesOf = (result: CoreResult, input: CoreInput): RoutedEdge[] => {
  const byId = new Map(input.edges.map((edge) => [edge.id, edge]));
  return [...result.routes.values()]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((route) => ({
      id: route.id,
      source: byId.get(route.id)?.source ?? '',
      target: byId.get(route.id)?.target ?? '',
      waypoints: route.waypoints.map((p) => ({ x: p.x, y: p.y })),
    }));
};

/** Gleiche Polylinie bis auf Gleitkomma-Rauschen? */
const samePath = (a: readonly Point[], b: readonly Point[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((point, i) => {
    const other = b[i] as Point;
    return Math.abs(point.x - other.x) < 1e-6 && Math.abs(point.y - other.y) < 1e-6;
  });
};

const describeViolations = (label: string, violations: readonly InvariantViolation[]): string[] =>
  violations.slice(0, 5).map((violation) => `${label} ${violation.invariant}: ${violation.detail}`);

/**
 * Führt Kern + beide Prüfungen aus und entscheidet über die Freigabe.
 *
 * Die Reihenfolge der Prüfungen ist die Reihenfolge ihrer Verbindlichkeit:
 * Vollständigkeit → Geometrie → Klarheit → deterministische Reproduktion →
 * ORACLE-Zustimmung → gesperrte Leitungen.
 */
export function routeAndValidate(input: CoreInput): GateVerdict {
  const result = routeCore(input);
  const validation = validateCore(result, input);
  const edges = routedEdgesOf(result, input);
  const oracle = crosscheck(edges, nodeRectsOf(input));
  const reasons: string[] = [];

  // 1. Vollständigkeit: jede angeforderte Kante hat eine Route oder einen Grund.
  const routed = new Set(result.routes.keys());
  const missing = input.edges.filter((edge) => !routed.has(edge.id)).map((edge) => edge.id);
  if (missing.length > 0) {
    reasons.push(`unvollständig: ${missing.length} Kante(n) ohne Route (${missing.slice(0, 5).join(', ')})`);
  }
  const silent = result.unroutable.filter((entry) => entry.reason.trim().length === 0);
  if (silent.length > 0) {
    reasons.push(`unvollständig: ${silent.length} Kante(n) ohne Begründung`);
  }

  // 2. Geometrie: I1/I2/I3 sind hart, nicht verhandelbar.
  if (validation.counts.I1 > 0) reasons.push(`I1: ${validation.counts.I1} Bauteildurchdringung(en)`);
  if (validation.counts.I2 > 0) reasons.push(`I2: ${validation.counts.I2} unzulässige Überdeckung(en)`);
  if (validation.counts.I3 > 0) reasons.push(`I3: ${validation.counts.I3} Clearance-Verletzung(en)`);
  reasons.push(...describeViolations('Prüfinstanz', validation.invariants.I1));
  reasons.push(...describeViolations('Prüfinstanz', validation.invariants.I2));
  reasons.push(...describeViolations('Prüfinstanz', validation.invariants.I3));

  // 3. Gegenprobe: Orakel und Produktivprüfung müssen übereinstimmen. Eine
  //    Divergenz ist ein Befund über die Prüfungen selbst — und damit ein FAIL,
  //    egal welche Seite irrt.
  if (oracle.divergences.length > 0) {
    const first = oracle.divergences[0];
    reasons.push(
      `Orakel-Divergenz: ${oracle.divergences.length} Abweichung(en), erste: ${first?.kind ?? '?'} ${first?.invariant ?? '?'} ${first?.detail ?? ''}`
    );
  }

  // 4. Gesperrte Leitungen bleiben bitgenau unverändert.
  for (const edge of input.edges) {
    if (!edge.locked || !edge.lockedWaypoints || edge.lockedWaypoints.length < 2) continue;
    const route = result.routes.get(edge.id);
    if (!route || !samePath(route.waypoints, edge.lockedWaypoints)) {
      reasons.push(`gesperrte Route verändert: ${edge.id}`);
    }
  }

  // 5. Determinismus: derselbe Input ergibt dasselbe Ergebnis (I9). Der Doppel-
  //    lauf ist billig im Vergleich zu einem stillen Zufall.
  const second = routeCore(input);
  for (const [id, route] of result.routes) {
    const other = second.routes.get(id);
    if (!other || !samePath(route.waypoints, other.waypoints)) {
      reasons.push(`nicht deterministisch: ${id}`);
      break;
    }
  }

  const status: GateStatus = reasons.length === 0 ? 'PASS' : 'FAIL';
  const publishable =
    status === 'PASS'
      ? new Map([...result.routes].map(([id, route]) => [id, route.waypoints.map((p) => ({ ...p }))]))
      : null;

  return { status, result, validation, oracle, reasons, publishable };
}

/**
 * Freigabe in einem Schritt: Routen oder `null`.
 *
 * Der Aufrufer hat damit keine Möglichkeit, ein `FAIL` zu „übersehen": es gibt
 * schlicht nichts zu veröffentlichen.
 */
export function publishableRoutes(input: CoreInput): ReadonlyMap<string, Point[]> | null {
  return routeAndValidate(input).publishable;
}
