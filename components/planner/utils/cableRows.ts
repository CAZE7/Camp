import { type Node, type Edge } from '@xyflow/react';
import { type CableEdgeData } from '../../edges/CableEdge';
import { getComponentSpec } from '../../registry';

/**
 * Kabelliste (Recherche A4): zeilenweises Leitungsmodell über den elektrischen
 * Kantenbestand.
 *
 * Zeilen-Semantik (mit dem Nutzer abgestimmt, gemischte Lösung):
 * - Plus-/Minus-Leitungen derselben Strecke (gleiche ungeordnete Endpunkte,
 *   entgegengesetzte Polarität, DC- oder Solar-Domäne) werden zu EINER Zeile
 *   gebündelt (Adern = 2).
 * - Leitungen ohne zugehörige Gegenleitung (z. B. einzelne Minus-Rückleitung
 *   zum Massepunkt, AC-Leitungen) sind eigene Zeilen: AC 230 V wird als
 *   Mantelleitung geführt (Adern = 3), DC/Solar-Einzeladern mit Adern = 1.
 *
 * Die Funktion ist bewusst pure (kein Store-Zugriff), damit Sortierung,
 * Gruppierung und Status in Tests deterministisch prüfbar sind.
 */

export type CableDomain = 'DC_12V' | 'AC_230V' | 'Solar';
export type CablePolarity = 'plus' | 'minus';

/** Anzeige-Namen für die Funktionen-Spalte (Domäne + ggf. Polarität). */
export const DOMAIN_LABEL: Record<CableDomain, string> = {
  DC_12V: '12-V-Gleichstrom',
  AC_230V: '230-V-Wechselstrom',
  Solar: 'Solar',
};

/** Sortierreihenfolge der Status-Spalte (schwerste Warnung zuerst). */
export const STATUS_ORDER: Record<RowStatus, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  ok: 3,
};

export type RowStatus = 'critical' | 'warning' | 'info' | 'ok';

export interface CableRow {
  /** Stabile Zeilen-ID (repräsentative Kante, sonst Kanten-ID). */
  key: string;
  /** Alle Kanten-IDs der Zeile (bei Bündelung Plus + Minus). */
  edgeIds: string[];
  /** Kante, die im Plan fokussiert wird (bei Bündelung die Plus-Leitung). */
  representativeEdgeId: string;
  fromId: string;
  toId: string;
  fromLabel: string;
  toLabel: string;
  domain: CableDomain | 'mixed' | undefined;
  polarity: CablePolarity | 'pair' | undefined;
  /** Aderzahl der Zeile (2 = Plus/Minus-Bündel, 3 = 230-V-Mantelleitung, sonst 1). */
  cores: number;
  /** Querschnitte der Zeile in mm² (aufsteigend, dedupliziert). */
  crossSections: number[];
  /** Leitungsdaten der Zeile (bei Bündelung Plus zuerst). */
  edges: Edge<CableEdgeData>[];
}

/** Menschlicher Name eines Knotens: eigenes Label, sonst Registry-Bezeichnung. */
export function nodeDisplayName(node: Node | undefined): string {
  if (!node) return '—';
  const own = node.data?.label;
  if (typeof own === 'string' && own.trim() !== '') return own;
  const spec = getComponentSpec(node.type ?? '');
  return spec?.label ?? node.type ?? '—';
}

/** Polarität einer Kante anhand ihrer Handle-IDs ('plus'/'minus'). */
export function polarityOfEdge(edge: Edge<CableEdgeData>): CablePolarity | undefined {
  const handles = [edge.sourceHandle, edge.targetHandle].filter(Boolean).join(' ');
  if (handles.includes('minus')) return 'minus';
  if (handles.includes('plus')) return 'plus';
  return undefined;
}

/** Adernzahl einer einzelnen Leitung nach Domäne (ohne Paar-Bündelung). */
export function coresOfDomain(domain: CableDomain | undefined): number {
  if (domain === 'AC_230V') return 3;
  return 1;
}

/** Bündelt Plus-/Minus-Gegenleitungen zu Zeilen (Details im Datei-Kopf). */
export function buildCableRows(nodes: readonly Node[], edges: readonly Edge<CableEdgeData>[]): CableRow[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  // Nur echte Kabel-Kanten (keine Wasserleitungen — Aufrufer übergibt bereits
  // den elektrischen Bestand, der Filter ist trotzdem defensiv).
  const cables = edges.filter((edge) => edge.type === 'cableEdge' || edge.data?.edgeDomain !== undefined);

  const rows: CableRow[] = [];
  const usedEdgeIds = new Set<string>();

  // 1) Paar-Suche über gleiche ungeordnete Endpunkte.
  const byEndpoints = new Map<string, Edge<CableEdgeData>[]>();
  for (const edge of cables) {
    if (edge.data?.edgeDomain === 'AC_230V') continue; // AC ist eigene Zeile
    const key = [edge.source, edge.target].sort().join('|');
    const bucket = byEndpoints.get(key) ?? [];
    bucket.push(edge);
    byEndpoints.set(key, bucket);
  }
  for (const bucket of byEndpoints.values()) {
    const plus = bucket.filter((edge) => polarityOfEdge(edge) === 'plus');
    const minus = bucket.filter((edge) => polarityOfEdge(edge) === 'minus');
    // Paar nur, wenn auf derselben Strecke je mindestens eine Plus- und eine
    // Minus-Leitung liegt — und die Domänen zueinander passen (DC/Solar).
    const pairs = Math.min(plus.length, minus.length);
    for (let i = 0; i < pairs; i++) {
      const plusEdge = plus[i];
      const minusEdge = minus[i];
      if (!plusEdge || !minusEdge) continue;
      usedEdgeIds.add(plusEdge.id);
      usedEdgeIds.add(minusEdge.id);
      rows.push(createRow([plusEdge, minusEdge], nodeMap));
    }
  }

  // 2) Restliche Leitungen als Einzelzeilen (inkl. AC).
  for (const edge of cables) {
    if (usedEdgeIds.has(edge.id)) continue;
    rows.push(createRow([edge], nodeMap));
  }

  return rows.sort((a, b) =>
    a.fromLabel === b.fromLabel
      ? a.toLabel.localeCompare(b.toLabel, 'de')
      : a.fromLabel.localeCompare(b.fromLabel, 'de')
  );
}

function createRow(edges: Edge<CableEdgeData>[], nodeMap: Map<string, Node>): CableRow {
  const primary = edges[0];
  if (!primary) throw new Error('createRow ohne Kanten ist kein gültiger Aufruf');
  const fromNode = nodeMap.get(primary.source);
  const toNode = nodeMap.get(primary.target);
  const domains = Array.from(new Set(edges.map((edge) => edge.data?.edgeDomain).filter(Boolean)));
  const polarities = edges.map(polarityOfEdge).filter(Boolean);
  const isPair = edges.length === 2 && polarities.length === 2;
  const domain =
    domains.length === 1 ? (domains[0] as CableDomain) : domains.length > 1 ? 'mixed' : undefined;
  const polarity = isPair ? 'pair' : (polarities[0] ?? undefined);
  const cores = isPair ? 2 : domain === 'AC_230V' ? 3 : 1;
  const crossSections = Array.from(
    new Set(edges.map((edge) => edge.data?.crossSection).filter((v): v is number => v !== undefined))
  ).sort((a, b) => a - b);
  const representative = primary;

  return {
    key: representative.id,
    edgeIds: edges.map((edge) => edge.id),
    representativeEdgeId: representative.id,
    fromId: primary.source,
    toId: primary.target,
    fromLabel: nodeDisplayName(fromNode),
    toLabel: nodeDisplayName(toNode),
    domain,
    polarity,
    cores,
    crossSections,
    edges,
  };
}

/** Maximale Leitungslänge der Zeile in Metern (bei Bündelung: gleiche Trasse). */
export function rowLengthMeters(row: CableRow): number | undefined {
  const lengths = row.edges.map((edge) => edge.data?.length).filter((v): v is number => v !== undefined);
  if (lengths.length === 0) return undefined;
  return Math.max(...lengths);
}

/** Querschnittsanzeige („4" oder bei Abweichung „2,5/4"). */
export function rowCrossSectionLabel(row: CableRow): string {
  if (row.crossSections.length === 0) return '—';
  return row.crossSections.map((v) => String(v)).join('/');
}

/**
 * Sicherungs-/Stromkreis-Kennzeichnung einer Zeile: bevorzugt die
 * Plus-Leitung (bei Bündelung die erste Kante). Ohne Angabe „—".
 */
export function rowFuseLabel(row: CableRow): string {
  const edge = row.edges.find((candidate) => polarityOfEdge(candidate) === 'plus') ?? row.edges[0];
  const data = edge?.data;
  const parts: string[] = [];
  if (data?.fuseSize !== undefined) parts.push(`${data.fuseSize} A`);
  if (data?.acProtection) {
    const characteristic = data.acProtection.characteristic ? ` ${data.acProtection.characteristic}` : '';
    const kind = data.acProtection.kind === 'rcbo' ? 'FI/LS' : 'LS';
    parts.push(`${kind}${characteristic}`);
  } else if (typeof data?.fuseType === 'string' && data.fuseType !== '') {
    parts.push(data.fuseType.toUpperCase());
  }
  return parts.join(' ') || '—';
}

/** Status der Zeile aus den Plan-Warnungen (schwerste Kante gewinnt). */
export function rowStatus(row: CableRow, warningsByEdgeId: Map<string, RowStatus>): RowStatus {
  let worst: RowStatus | undefined;
  for (const edgeId of row.edgeIds) {
    const status = warningsByEdgeId.get(edgeId);
    if (!status) continue;
    if (worst === undefined || STATUS_ORDER[status] < STATUS_ORDER[worst]) worst = status;
  }
  return worst ?? 'ok';
}
