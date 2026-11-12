/**
 * Kreuzprobe: Orakel (reine Geometrie, ohne Ausnahmen) gegen Produktivprüfung.
 *
 * Die beiden Befunde dürfen sich unterscheiden — aber **nur** in einer
 * Richtung, und **nur** aus dokumentierten Gründen:
 *
 * ```text
 * Produktivpfad meldet  ⊆  Orakel meldet          (nichts erfunden)
 * Orakel \ Produktivpfad = dokumentierte Ausnahmen (nichts verschluckt)
 * ```
 *
 * Jede Abweichung von dieser Regel ist eine Divergenz und damit ein Befund:
 * eine der beiden Seiten rechnet falsch. Das Orakel ist nicht „richtiger“ —
 * es ist unabhängig. Welche Seite irrt, entscheidet die Untersuchung, nicht
 * diese Funktion.
 *
 * Die Ausnahmen werden **nicht nachgebaut**, sondern hier aus der Rules-Schicht
 * abgefragt (Port-Bündel ADR 0009/0025/0031/0034, Stub-Verkürzung ROUTE-BUG-7).
 * Damit bleibt die Semantik an einer Stelle — nur die Bedingung „trifft diese
 * Ausnahme zu?“ wird ausgeliehen, die Geometrieprüfung nicht.
 */

import type { InvariantViolation, NodeRect, RoutedEdge } from '../../invariants';
import { checkInvariants, requiredStubLength, type InvariantReport } from '../../invariants';
import {
  isPortBundleOverlap,
  isPortBundleProximity,
  portBundleSizes,
  routedPathGeometry,
} from '../../rules/portBundle';
import type { Segment } from '../../geometry';
import { ROUTING_TOKENS, type RoutingTokens } from '../../tokens';
import {
  oracleReport,
  segmentsOf,
  simplifyPolyline,
  type OracleInvariantId,
  type OracleReport,
} from './index';

export type CrosscheckDivergence = {
  /** `production-only`: Produktivpfad meldet, Orakel nicht. `oracle-only`: umgekehrt. */
  kind: 'production-only' | 'oracle-only';
  invariant: OracleInvariantId;
  edgeId: string;
  otherId?: string;
  detail: string;
};

export type CrosscheckResult = {
  divergences: CrosscheckDivergence[];
  /** Orakel-Befunde, die durch eine dokumentierte Ausnahme erklärt sind. */
  explained: number;
  /** Ausnahmen, die tatsächlich gegriffen haben (Transparenz im Bericht). */
  exceptionsApplied: { portBundle: number; shortenedStub: number };
  production: InvariantReport;
  oracle: OracleReport;
};

const keyOf = (violation: InvariantViolation): string =>
  `${violation.invariant}|${violation.edgeId}|${violation.otherId ?? ''}`;

const ORACLE_IDS: readonly OracleInvariantId[] = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6'];

/**
 * Führt beide Prüfungen aus und vergleicht die Befundmengen.
 *
 * Die Kanten beider Seiten sind identisch; verglichen wird über
 * `(Invariante, Kante, Gegenseite)`. Mehrfachbefunde auf demselben Schlüssel
 * (z. B. zwei durchstoßene Segmente desselben Nodes) zählen einmal.
 */
export function crosscheck(
  edges: readonly RoutedEdge[],
  nodes: readonly NodeRect[],
  tokens: RoutingTokens = ROUTING_TOKENS
): CrosscheckResult {
  return compareReports(
    checkInvariants(edges, nodes, tokens),
    oracleReport(edges, nodes, tokens),
    edges,
    tokens
  );
}

/**
 * Reiner Vergleich zweier Befundberichte.
 *
 * Getrennt von `crosscheck`, damit der Vergleich **selbst** prüfbar ist: ein
 * Test kann einen absichtlich verstümmelten Bericht einspeisen und muss dann
 * eine Divergenz sehen. Ein Detektor, den man nicht gegen einen bekannten
 * Fehler prüfen kann, ist kein Detektor.
 */
export function compareReports(
  production: InvariantReport,
  oracle: OracleReport,
  edges: readonly RoutedEdge[],
  tokens: RoutingTokens = ROUTING_TOKENS
): CrosscheckResult {
  const productionKeys = new Set<string>();
  for (const id of ORACLE_IDS) for (const violation of production[id]) productionKeys.add(keyOf(violation));

  const oracleKeys = new Map<string, InvariantViolation>();
  for (const id of ORACLE_IDS) {
    for (const violation of oracle[id]) {
      const key = keyOf(violation);
      if (!oracleKeys.has(key)) oracleKeys.set(key, violation);
    }
  }

  const divergences: CrosscheckDivergence[] = [];

  // 1) Produktivpfad meldet etwas, das das Orakel nicht sieht: erfunden.
  for (const id of ORACLE_IDS) {
    for (const violation of production[id]) {
      if (oracleKeys.has(keyOf(violation))) continue;
      divergences.push({
        kind: 'production-only',
        invariant: violation.invariant as OracleInvariantId,
        edgeId: violation.edgeId,
        otherId: violation.otherId,
        detail: `Produktivpfad meldet ${violation.invariant} (${violation.detail}); Orakel sieht keine Verletzung`,
      });
    }
  }

  // 2) Orakel meldet etwas, das der Produktivpfad nicht meldet: nur als
  //    dokumentierte Ausnahme zulässig.
  const geometryByEdge = new Map<string, ReturnType<typeof routedPathGeometry>>();
  for (const edge of edges) geometryByEdge.set(edge.id, routedPathGeometry(edge.waypoints));
  const bundleSizes = portBundleSizes(edges.map((edge) => ({ id: edge.id, waypoints: edge.waypoints })));

  let explained = 0;
  const exceptionsApplied = { portBundle: 0, shortenedStub: 0 };

  for (const [key, violation] of oracleKeys) {
    if (productionKeys.has(key)) continue;

    const reason = explainOracleOnly(violation, edges, geometryByEdge, bundleSizes, tokens);
    if (reason) {
      explained += 1;
      if (reason === 'port-bundle') exceptionsApplied.portBundle += 1;
      else exceptionsApplied.shortenedStub += 1;
      continue;
    }

    divergences.push({
      kind: 'oracle-only',
      invariant: violation.invariant as OracleInvariantId,
      edgeId: violation.edgeId,
      otherId: violation.otherId,
      detail: `Orakel meldet ${violation.invariant} (${violation.detail}); Produktivpfad verschluckt sie ohne dokumentierte Ausnahme`,
    });
  }

  return { divergences, explained, exceptionsApplied, production, oracle };
}

type Explanation = 'port-bundle' | 'shortened-stub' | null;

function explainOracleOnly(
  violation: InvariantViolation,
  edges: readonly RoutedEdge[],
  geometryByEdge: Map<string, ReturnType<typeof routedPathGeometry>>,
  bundleSizes: ReturnType<typeof portBundleSizes>,
  tokens: RoutingTokens
): Explanation {
  const { invariant, edgeId, otherId } = violation;

  // Stub-/Segmentlänge: ROUTE-BUG-7 verkürzt die Forderung, wenn sich zwei
  // Ports gegenüberliegen. Produktivpfad prüft gegen die verkürzte Forderung,
  // das Orakel gegen das Token — genau diese Differenz ist die Ausnahme.
  if (invariant === 'I5' || invariant === 'I6') {
    const edge = edges.find((candidate) => candidate.id === edgeId);
    if (!edge) return null;
    const required = requiredStubLength(simplifyPolyline(edge.waypoints), tokens.stubMin);
    return required < tokens.stubMin - 1e-6 ? 'shortened-stub' : null;
  }

  // Freigabe-/Überlappungsbefunde zwischen zwei Kanten: Port-Bündel.
  if ((invariant === 'I2' || invariant === 'I3') && otherId && otherId !== edgeId) {
    const a = geometryByEdge.get(edgeId);
    const b = geometryByEdge.get(otherId);
    if (!a || !b) return null;
    for (const s1 of a.segments as readonly Segment[]) {
      for (const s2 of b.segments as readonly Segment[]) {
        if (invariant === 'I2') {
          if (isPortBundleOverlap(a, b, s1, s2)) return 'port-bundle';
        } else if (isPortBundleProximity(a, b, s1, s2, tokens.portFacingClearance, bundleSizes)) {
          return 'port-bundle';
        }
      }
    }
    return null;
  }

  return null;
}

/** Bequemer Zugriff auf die geprüften Segmente einer Kante (Diagnose). */
export const oracleSegmentsOf = segmentsOf;
