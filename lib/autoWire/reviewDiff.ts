/**
 * lib/autoWire/reviewDiff.ts — VORHER/NACHHER JE LEITUNG IM AUTO-WIRE-REVIEW.
 *
 * Reine Projektion: Sie liest ausschließlich die Kanten des aktuellen Plans
 * („Vorher") und die Kanten des Vorschlags („Nachher") und stellt je Leitung
 * Querschnitt, Sicherung, Verlegebedingung und eine Begründung zusammen.
 *
 * Es wird HIER NICHTS ELEKTRISCH GERECHNET (ARCH-Regel D/M): kein Strom, kein
 * Querschnitt und keine Sicherung wird neu bestimmt. Die Werte stammen aus den
 * `edge.data` des Vorschlags; die Begründung benennt die Datenquelle
 * (`cableSizingFor` liefert nur Label/Herkunft/Gültigkeit der bereits
 * gespeicherten Verlegebedingung) und die Konflikte aus `AutoWireReport`.
 *
 * Warum eine eigene Datei: Der Review-Dialog darf keine zweite Fachlogik
 * neben `performAutoWiring` aufbauen. Die Projektion ist testbar, rein und
 * damit unabhängig von React prüfbar.
 */

import { cableSizingFor } from '../cableConditions';
import type { CableEdgeData } from '../domain/cableEdgeData';
import type { Edge, Node } from '../domain/graph';
import type { AutoWireConflict } from './conflicts';

export type AutoWireDiffStatus = 'new' | 'changed' | 'unchanged' | 'removed';

/** Anzeigewerte EINER Leitung — unverändert aus `edge.data` übernommen. */
export interface AutoWireEdgeValues {
  crossSection: number | null;
  fuseSize: number | null;
  conditionId: string;
  conditionLabel: string;
  /** Herkunftsstufe der I_z-Basis, nie als „geprüft" formuliert. */
  assessment: string;
  /** `false` ⇒ gespeicherte Verlegebedingung ungültig (kein stiller Rückfall). */
  valid: boolean;
  error?: string;
  domainLabel: string;
  /** Erklärung der I_z-Basis aus `lib/cableConditions.ts`. */
  basis: string;
}

export interface AutoWireEdgeDiff {
  id: string;
  /** „Batterie → Verbraucher" (Knotennamen), mit ID als Rückfall. */
  label: string;
  status: AutoWireDiffStatus;
  before: AutoWireEdgeValues | null;
  after: AutoWireEdgeValues | null;
  /** Begründungen aus dem Vorschlag, nie aus einer UI-Rechnung. */
  reasons: readonly string[];
  /** Konflikte des AutoWire-Reports, die diese Leitung nennen. */
  conflicts: readonly AutoWireConflict[];
}

const ASSESSMENT_LABEL: Readonly<Record<string, string>> = Object.freeze({
  'reference-model': 'Referenzmodell (0,7-Pauschale)',
  'assumption-based': 'eigene Annahmen (f₁/f₂)',
  'manufacturer-data': 'Datenblatt (Hersteller-I_z)',
});

const DOMAIN_LABEL: Readonly<Record<string, string>> = Object.freeze({
  DC_12V: 'DC 12 V',
  AC_230V: '230 V AC',
  Solar: 'Solar',
});

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const mm2 = (value: number | null): string =>
  value === null ? '—' : `${String(value).replace('.', ',')} mm²`;

const ampere = (value: number | null): string =>
  value === null ? '—' : `${String(value).replace('.', ',')} A`;

/** Ein Leser für die gespeicherten Felder; ungültige Daten bleiben sichtbar. */
function valuesOf(edge: Edge<CableEdgeData>): AutoWireEdgeValues {
  const data: CableEdgeData = edge.data ?? {};
  const sizing = cableSizingFor({
    installationCondition: data.installationCondition,
    ambientC: data.ambientC,
    bundledCircuits: data.bundledCircuits,
    cableInsulation: data.cableInsulation,
    manufacturerIzA: data.manufacturerIzA,
  });
  return {
    crossSection: numberOrNull(data.crossSection),
    fuseSize: numberOrNull(data.fuseSize),
    conditionId: sizing.conditions.conditionId,
    conditionLabel: sizing.conditions.label,
    assessment: ASSESSMENT_LABEL[sizing.conditions.assessment] ?? sizing.conditions.assessment,
    valid: sizing.valid,
    ...(sizing.error !== undefined ? { error: sizing.error } : {}),
    domainLabel: DOMAIN_LABEL[data.edgeDomain ?? ''] ?? 'Domäne nicht angegeben',
    basis: sizing.conditions.explanation,
  };
}

/** Kurzname eines Bauteils — gleiche Regel wie im Strommodell, ohne UI-Import. */
function nodeLabelOf(node: Node | undefined): string {
  const label = (node?.data as { label?: unknown } | undefined)?.label;
  return typeof label === 'string' && label.trim() !== '' ? label : (node?.type ?? node?.id ?? '');
}

function labelOf(edge: Edge<CableEdgeData>, nodesById: ReadonlyMap<string, Node>): string {
  const source = nodeLabelOf(nodesById.get(edge.source)) || edge.source;
  const target = nodeLabelOf(nodesById.get(edge.target)) || edge.target;
  return `${source} → ${target}`;
}

function sameValues(a: AutoWireEdgeValues | null, b: AutoWireEdgeValues | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.crossSection === b.crossSection &&
    a.fuseSize === b.fuseSize &&
    a.conditionId === b.conditionId &&
    a.valid === b.valid &&
    a.error === b.error
  );
}

function reasonsFor(
  status: AutoWireDiffStatus,
  before: AutoWireEdgeValues | null,
  after: AutoWireEdgeValues | null
): string[] {
  const reasons: string[] = [];
  if (status === 'new') {
    reasons.push(
      'Neu vorgeschlagene Leitung: Querschnitt und Sicherung stammen aus der Dimensionierung des Vorschlags — nicht aus einer Berechnung der Anzeige.'
    );
  } else if (status === 'removed') {
    reasons.push('Diese Leitung ist im Vorschlag nicht mehr enthalten.');
  } else if (status === 'unchanged') {
    reasons.push('Keine Änderung an Querschnitt, Sicherung oder Verlegebedingung.');
  } else if (before !== null && after !== null) {
    if (before.crossSection !== after.crossSection) {
      reasons.push(
        `Querschnitt ${mm2(before.crossSection)} → ${mm2(after.crossSection)}: im Vorschlag neu dimensioniert (Wert aus dem Vorschlag, keine UI-Rechnung).`
      );
    }
    if (before.fuseSize !== after.fuseSize) {
      reasons.push(
        `Sicherung ${ampere(before.fuseSize)} → ${ampere(after.fuseSize)}: folgt der geänderten Auslegung im Vorschlag.`
      );
    }
    if (before.conditionLabel !== after.conditionLabel) {
      reasons.push(
        `Verlegebedingung „${before.conditionLabel}" → „${after.conditionLabel}": ${after.assessment}.`
      );
    }
  }

  if (after !== null) {
    if (!after.valid) {
      reasons.push(
        `Nicht ausführbar: ${after.error ?? 'ungültige Verlegebedingung'}. Der Prüfbericht meldet UNVERIFIABLE — es gibt keinen stillen Rückfall auf die Referenz.`
      );
    } else if (after.conditionId !== 'reference') {
      reasons.push(`I_z-Basis: ${after.basis} (${after.assessment}).`);
    }
  }
  return reasons;
}

const STATUS_ORDER: Readonly<Record<AutoWireDiffStatus, number>> = Object.freeze({
  changed: 0,
  new: 1,
  removed: 2,
  unchanged: 3,
});

/**
 * Projektion für den Review-Dialog. Deterministische Reihenfolge: geänderte,
 * neue, entfernte, unveränderte Leitungen — innerhalb jeder Gruppe nach ID.
 *
 * Der dritte Parameter `nodes` dient ausschließlich der Beschriftung; er darf
 * aus dem aktuellen Plan UND dem Vorschlag zusammengesetzt werden (neue Knoten
 * gewinnen). `conflicts` werden nur an die Leitungen gehängt, die der Report
 * namentlich in `edgeIds` führt — es wird kein Konflikt erfunden oder verteilt.
 */
export function autoWireEdgeDiff(
  previous: readonly Edge<CableEdgeData>[],
  proposed: readonly Edge<CableEdgeData>[],
  nodes: readonly Node[] = [],
  conflicts: readonly AutoWireConflict[] = []
): AutoWireEdgeDiff[] {
  const nodesById = new Map<string, Node>(nodes.map((node) => [node.id, node]));
  const beforeById = new Map(previous.map((edge) => [edge.id, edge]));
  const afterById = new Map(proposed.map((edge) => [edge.id, edge]));
  const ids = new Set<string>([...beforeById.keys(), ...afterById.keys()]);

  const rows: AutoWireEdgeDiff[] = [];
  for (const id of ids) {
    const beforeEdge = beforeById.get(id);
    const afterEdge = afterById.get(id);
    const before = beforeEdge ? valuesOf(beforeEdge) : null;
    const after = afterEdge ? valuesOf(afterEdge) : null;
    const status: AutoWireDiffStatus =
      before === null
        ? 'new'
        : after === null
          ? 'removed'
          : sameValues(before, after)
            ? 'unchanged'
            : 'changed';
    const labelEdge = afterEdge ?? beforeEdge;
    rows.push({
      id,
      label: labelEdge ? labelOf(labelEdge, nodesById) : id,
      status,
      before,
      after,
      reasons: reasonsFor(status, before, after),
      conflicts: conflicts.filter((conflict) => conflict.edgeIds.includes(id)),
    });
  }

  return rows.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.id.localeCompare(b.id));
}

/** Einzeilige Zusammenfassung für die Überschrift des Review-Abschnitts. */
export function autoWireDiffSummary(rows: readonly AutoWireEdgeDiff[]): string {
  const count = (status: AutoWireDiffStatus) => rows.filter((row) => row.status === status).length;
  return `${count('changed')} geändert · ${count('new')} neu · ${count('removed')} entfernt · ${count('unchanged')} unverändert`;
}
