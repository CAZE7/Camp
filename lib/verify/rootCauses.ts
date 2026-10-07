/**
 * lib/verify/rootCauses.ts — URSACHENGRUPPEN ÜBER BEFUNDEN (Auftrag Phase 10).
 *
 * Das Problem, das dieses Modul löst: Ein Plan mit einer einzigen Ursache
 * (z. B. „der Wechselrichter zieht 147 A über eine 70-mm²-Leitung") erzeugte
 * bisher viele gleichartige Critical-Meldungen auf mehreren Leitungen — jedes
 * Kabel ein Befund, kein Zusammenhang. Der Nutzer sah zwölf Fehler, obwohl er
 * nur eine Entscheidung treffen muss.
 *
 * Die Gruppierung ist eine **Einordnung, keine Abschwächung**:
 *
 *   - Jeder Befund bleibt als Ereignis erhalten (Regel-ID, Werte, Abhilfe).
 *   - Zusätzlich trägt jedes Ereignis einen `rootCauseId`; die Ursache selbst
 *     führt die betroffenen Leitungen und Bauteile.
 *   - Es wird NICHTS zusammengefasst, was fachlich verschieden ist: Fehlt eine
 *     Angabe (UNVERIFIABLE), ist das eine Datenursache (`DATA-MISSING`), nicht
 *     dieselbe Ursache wie eine Überlast (`INVERTER-LOAD`).
 *
 * Die Vergabe ist deterministisch: Gruppen werden nach einem stabilen
 * Schlüssel sortiert, die laufende Nummer entsteht daraus (`…-001`).
 */

import type { RuleId } from './types';
import type { AuditEvent } from './types';
import { isCoverageEvent } from './events';

/** Fachliche Klasse einer Ursache — die Kennung vor der laufenden Nummer. */
export type RootCauseKind =
  /** Eine Last/ein Verbraucher zieht zu viel Strom für die verlegte Leitung. */
  | 'INVERTER-LOAD'
  | 'BRANCH-LOAD'
  /** Schutzorgan und Leiter passen nicht zusammen (I_n > I_z, keine Sicherung). */
  | 'PROTECTION-COORDINATION'
  /** Schutzorgan fehlt an der Quelle (0,2-m-Regel). */
  | 'SOURCE-PROTECTION'
  /** 230-V-Stromkreis ohne FI auf seinem Versorgungspfad. */
  | 'RCD-MISSING'
  /** Abzweig vor dem vorhandenen FI. */
  | 'RCD-POSITION'
  /** Angaben fehlen (Querschnitt, Strom, Länge, Schutzorgan …). */
  | 'DATA-MISSING'
  /** Alles andere — mit Regel-ID als Suffix, damit nichts verschwindet. */
  | 'OTHER';

export interface RootCauseFindingRef {
  ruleId: RuleId;
  /** Entität des Befunds (`edge`/`node`/`system`). */
  entityKind: 'edge' | 'node' | 'net' | 'path' | 'system';
  entityId: string;
  /** Kurztext des Befunds (erste Zeile der Meldung). */
  message: string;
}

/**
 * Eine Ursache mit ihren Folgen. `affectedEdges`/`affectedComponents` sind
 * sortiert und enthalten nur echte Plan-Entitäten (Leitungen/Knoten).
 */
export interface RootCause {
  rootCauseId: string;
  kind: RootCauseKind;
  title: string;
  /** Regeln, die zu dieser Ursache gemeldet haben (sortiert). */
  ruleIds: readonly RuleId[];
  affectedEdges: readonly string[];
  affectedComponents: readonly string[];
  findings: readonly RootCauseFindingRef[];
}

/** Knoten-Typ → fachliche Klasse einer Lastursache. */
function loadKindOf(nodeType: string | undefined): RootCauseKind {
  if (nodeType === 'inverter') return 'INVERTER-LOAD';
  return 'BRANCH-LOAD';
}

const KIND_TITLE: Record<RootCauseKind, string> = {
  'INVERTER-LOAD': 'Wechselrichter zieht zu viel Strom für die Leitung',
  'BRANCH-LOAD': 'Verbraucherlast übersteigt die verlegte Leitung',
  'PROTECTION-COORDINATION': 'Schutzorgan und Leitung sind nicht koordiniert',
  'SOURCE-PROTECTION': 'Kein Schutzorgan an der Quelle',
  'RCD-MISSING': '230-V-Stromkreis ohne Fehlerstromschutz auf seinem Pfad',
  'RCD-POSITION': 'Abzweig vor der Fehlerstrom-Schutzeinrichtung',
  'DATA-MISSING': 'Angabe fehlt — der Punkt ist nicht bewertbar',
  OTHER: 'Weiterer Befund',
};

interface GroupKey {
  kind: RootCauseKind;
  /** Stabiler Gruppenschlüssel (Teil der ID-Bildung ist die Sortierung). */
  key: string;
  /** Haupt-Entität der Ursache (Verbraucher/Bauteil), falls bekannt. */
  componentId: string | null;
}

/**
 * Gruppenschlüssel EINES Befunds — die fachliche Zuordnung.
 *
 * Bewusst nur aus dem Ereignis abgeleitet (kein zweiter Blick in den Plan):
 * Was die Engine nicht in `details` gelegt hat, kann hier nicht erfunden
 * werden. Fehlt die Angabe, landete der Befund früher bei `DATA-MISSING` —
 * genau das ist die richtige Aussage.
 */
function groupKeyOf(event: AuditEvent): GroupKey {
  if (event.kind === 'UNVERIFIABLE') {
    return { kind: 'DATA-MISSING', key: `data:${event.ruleId}`, componentId: null };
  }

  const contributors = event.details?.contributors ?? [];
  const loadContributor = contributors
    .filter((entry) => entry.role === 'load')
    .reduce<(typeof contributors)[number] | null>(
      (worst, entry) => (worst === null || entry.contribution > worst.contribution ? entry : worst),
      null
    );
  const componentId = loadContributor?.componentId ?? null;

  switch (event.ruleId) {
    case 'AMP-001-ib-in-iz':
    case 'AMP-002-i2-vs-iz':
      if (componentId !== null) {
        // Der dominante Lastbeitrag trägt die Ursache: Ist die Leitung wegen
        // des Wechselrichters zu heiß, gehört sie zu DIESER Ursache.
        return { kind: 'INVERTER-LOAD', key: `load:${componentId}`, componentId };
      }
      return {
        kind: 'PROTECTION-COORDINATION',
        key: `coord:${event.entity.kind}:${event.entity.id}`,
        componentId: null,
      };
    case 'AMP-003-source-protection-position':
      return { kind: 'SOURCE-PROTECTION', key: `source:${event.entity.id}`, componentId: null };
    case 'RCD-001-rcd-deviation':
      return {
        kind: 'RCD-MISSING',
        key: `rcd:${event.details?.consumerId ?? event.entity.id}`,
        componentId: event.details?.consumerId ?? null,
      };
    case 'RCD-003-rcd-position':
      return {
        kind: 'RCD-POSITION',
        key: `rcdpos:${event.details?.consumerId ?? event.entity.id}`,
        componentId: event.details?.consumerId ?? null,
      };
    case 'AMP-004-breaking-capacity':
      return { kind: 'PROTECTION-COORDINATION', key: `breaking:${event.entity.id}`, componentId: null };
    default:
      return { kind: 'OTHER', key: `other:${event.ruleId}`, componentId: null };
  }
}

/** Läuft die Klasse unter einem Last- oder Wandlerknoten? */
function kindForLoad(nodeType: string | undefined, base: RootCauseKind): RootCauseKind {
  return base === 'INVERTER-LOAD' ? loadKindOf(nodeType) : base;
}

/**
 * Leitet die Ursachengruppen aus den Ereignissen ab.
 *
 * @param events  Alle Ereignisse des Laufs (Reihenfolge egal — es wird sortiert).
 * @param nodeTypes Knoten-ID → Bauteiltyp (für die fachliche Klasse einer
 *   Lastursache). Fehlt der Typ, bleibt es bei der allgemeinen Klasse.
 */
export function deriveRootCauses(
  events: readonly AuditEvent[],
  nodeTypes: ReadonlyMap<string, string> = new Map()
): RootCause[] {
  const groups = new Map<
    string,
    {
      key: GroupKey;
      ruleIds: Set<RuleId>;
      edges: Set<string>;
      components: Set<string>;
      findings: RootCauseFindingRef[];
    }
  >();

  for (const event of events) {
    if (isCoverageEvent(event)) continue;
    const key = groupKeyOf(event);
    const kind = kindForLoad(nodeTypes.get(key.componentId ?? ''), key.kind);
    const id = `${kind}|${key.key}`;
    let group = groups.get(id);
    if (!group) {
      group = {
        key: { ...key, kind },
        ruleIds: new Set(),
        edges: new Set(),
        components: new Set(),
        findings: [],
      };
      groups.set(id, group);
    }
    group.ruleIds.add(event.ruleId);
    if (event.entity.kind === 'edge') group.edges.add(event.entity.id);
    if (event.entity.kind === 'node') group.components.add(event.entity.id);
    const componentId = event.details?.consumerId;
    if (typeof componentId === 'string') group.components.add(componentId);
    group.findings.push({
      ruleId: event.ruleId,
      entityKind: event.entity.kind,
      entityId: event.entity.id,
      message: event.message,
    });
  }

  // Deterministische Nummerierung: erst nach Klasse, dann nach Gruppenschlüssel.
  const sorted = [...groups.values()].sort(
    (a, b) => a.key.kind.localeCompare(b.key.kind) || a.key.key.localeCompare(b.key.key)
  );
  const counters = new Map<RootCauseKind, number>();
  return sorted.map((group) => {
    const next = (counters.get(group.key.kind) ?? 0) + 1;
    counters.set(group.key.kind, next);
    const rootCauseId = `${group.key.kind}-${String(next).padStart(3, '0')}`;
    return {
      rootCauseId,
      kind: group.key.kind,
      title: KIND_TITLE[group.key.kind],
      ruleIds: [...group.ruleIds].sort(),
      affectedEdges: [...group.edges].sort(),
      affectedComponents: [...group.components].sort(),
      findings: group.findings,
    };
  });
}

/**
 * Trägt `rootCauseId` in die Ereignisse ein und liefert beide Artefakte.
 *
 * Rein additiv: Meldung, Werte, Abhilfe und Schwere eines Ereignisses bleiben
 * unverändert — die Zuordnung ist eine zusätzliche Information.
 */
export function attachRootCauses(
  events: readonly AuditEvent[],
  nodeTypes: ReadonlyMap<string, string> = new Map()
): { events: AuditEvent[]; rootCauses: RootCause[] } {
  const rootCauses = deriveRootCauses(events, nodeTypes);
  const idByFinding = new Map<string, string>();
  for (const cause of rootCauses) {
    for (const finding of cause.findings) {
      // Schlüssel = Regel + Entität + Meldung: identische Befunde (kann es
      // durch die Regelstruktur nicht geben) bekämen dieselbe Ursache.
      idByFinding.set(
        `${finding.ruleId}|${finding.entityKind}:${finding.entityId}|${finding.message}`,
        cause.rootCauseId
      );
    }
  }
  return {
    events: events.map((event) => {
      const rootCauseId = idByFinding.get(
        `${event.ruleId}|${event.entity.kind}:${event.entity.id}|${event.message}`
      );
      return rootCauseId === undefined
        ? { ...event }
        : { ...event, details: { ...event.details, rootCauseId } };
    }),
    rootCauses,
  };
}
