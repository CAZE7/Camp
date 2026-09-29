/**
 * lib/verify/topology.ts — PASS 1 (Syntax/Connectivity) und PASS 2
 * (Domänen-, Polaritäts- und Topologie-Invarianten).
 *
 * Kernidee: Die elektrische Analyse läuft auf einem **Port-Graphen** — nicht
 * auf dem Knoten-Graphen. Ein Knoten ist ein Bauteil mit mehreren Anschlüssen,
 * und die entscheidende Frage lautet: „Welche Anschlüsse sind INNERHALB des
 * Bauteils verbunden?“ Genau das trennt einen Kurzschluss von einem
 * Betriebsstrom:
 *
 *   - `PASSIVE` (Sammelschiene, Leerrohr): verbindet gleiche Polaritäten
 *     (Durchführung) — kein Übergang Plus↔Minus.
 *   - `PROTECTION` / `MEASUREMENT` (Sicherungsknoten, Shunt): ebenfalls
 *     Durchführung derselben Polarität.
 *   - `LOAD` / `CONVERTER`: Übergang Plus↔Minus **ist** der Verbraucher — wer
 *     ihn durchquert, hat eine definierte Last im Pfad und damit KEINEN
 *     Kurzschluss.
 *   - `SOURCE` (Batterie): verbindet ihre Pole — das ist die Gefahrenquelle;
 *     sie wird nie durchquert, sondern nur verlassen.
 *
 * Damit ist `TOPO-001` entscheidbar: Ein Kurzschlusspfad existiert genau dann,
 * wenn ein Pfad vom Pluspol einer Quelle zum Minuspol/Bezugspunkt führt, der
 * ausschließlich Leitungen und Durchführungen benutzt. Der Pfad ist das
 * Gegenbeispiel im Audit-Event — nicht ein „irgendwo stimmt etwas nicht“.
 */

import { auditEvent, checkFromEvents, checkOrNotApplicable, passedCheck } from './events';
import { behaviorOf, cablesAt, labelOfNode, otherPort } from './graph';
import type {
  AuditEvent,
  CableModel,
  CheckResult,
  ComponentBehavior,
  ConductionGraph,
  Polarity,
  PortKey,
  PortRef,
} from './types';

// ============================================================================
// 0. HILFSSTRUKTUREN
// ============================================================================

/** Kante im Port-Graphen: Leitung (Kabel) oder bauteilinterne Durchführung. */
interface PortEdge {
  to: PortKey;
  kind: 'cable' | 'series';
  cableId: string | null;
}

/** Port-Graph über allen elektrischen Leitungen (nicht Wasser). */
export interface PortGraph {
  ports: ReadonlyMap<PortKey, PortRef>;
  adjacency: ReadonlyMap<PortKey, readonly PortEdge[]>;
}

/** Durchführungspolarität: `none`-Handles (Leerrohr) werden gemeinsam geführt. */
function walkPolarity(port: PortRef): string {
  if (port.polarity === 'neutral' || port.polarity === 'protective-earth') return 'negative';
  if (port.polarity === 'line') return 'positive';
  return port.polarity;
}

/**
 * Baut den Port-Graphen.
 *
 * Interne Durchführungen entstehen nur für Verhaltensklassen, die elektrisch
 * wirklich durchverbinden. Für alles andere bleibt das Bauteil im Graphen eine
 * „Sackgasse“ — der Walk endet dort, und genau das ist die Aussage.
 */
export function buildPortGraph(graph: ConductionGraph): PortGraph {
  const ports = new Map<PortKey, PortRef>();
  const adjacency = new Map<PortKey, PortEdge[]>();
  const link = (from: PortKey, edge: PortEdge): void => {
    const list = adjacency.get(from);
    if (list) list.push(edge);
    else adjacency.set(from, [edge]);
  };

  for (const component of [...graph.components.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId))) {
    const behavior = component.behavior;
    for (const port of component.ports) ports.set(port.key, port);

    if (behavior.kind !== 'PASSIVE' && behavior.kind !== 'PROTECTION' && behavior.kind !== 'MEASUREMENT') {
      continue;
    }
    const groups = new Map<string, PortRef[]>();
    for (const port of component.ports) {
      const key = walkPolarity(port);
      const list = groups.get(key);
      if (list) list.push(port);
      else groups.set(key, [port]);
    }
    for (const list of [...groups.values()]) {
      const sorted = [...list].sort((a, b) => a.key.localeCompare(b.key));
      for (let i = 0; i < sorted.length; i += 1) {
        for (let j = i + 1; j < sorted.length; j += 1) {
          const a = sorted[i];
          const b = sorted[j];
          if (!a || !b) continue;
          link(a.key, { to: b.key, kind: 'series', cableId: null });
          link(b.key, { to: a.key, kind: 'series', cableId: null });
        }
      }
    }
  }

  for (const cable of [...graph.cables].sort((a, b) => a.edgeId.localeCompare(b.edgeId))) {
    ports.set(cable.from.key, cable.from);
    ports.set(cable.to.key, cable.to);
    link(cable.from.key, { to: cable.to.key, kind: 'cable', cableId: cable.edgeId });
    link(cable.to.key, { to: cable.from.key, kind: 'cable', cableId: cable.edgeId });
  }

  return { ports, adjacency };
}

/** BFS-Ergebnis: Ziel-Port und Pfad (Ports + benutzte Leitungen). */
interface WalkResult {
  target: PortKey;
  ports: PortKey[];
  cableIds: string[];
}

/**
 * Breitensuche über den Port-Graphen.
 *
 * @param blocked Ports, die nicht betreten werden dürfen (z. B. Shunt-Terminals).
 * @param isGoal  Zielprädikat.
 * @param onCable optionale Kantenfilterung (z. B. „nur DC-Kanten“).
 */
export function walk(
  graph: PortGraph,
  starts: readonly PortRef[],
  isGoal: (port: PortRef) => boolean,
  options: {
    blocked?: ReadonlySet<PortKey>;
    acceptCable?: (cableId: string | null) => boolean;
    /**
     * Filter für Ports, die als ZWISCHENSCHRITT betreten werden dürfen.
     * Das Ziel wird immer akzeptiert (sonst könnte eine Prüfung nie treffen).
     */
    acceptIntermediate?: (port: PortRef) => boolean;
    maxVisited?: number;
  } = {}
): WalkResult | null {
  const blocked = options.blocked ?? new Set<PortKey>();
  const acceptCable = options.acceptCable ?? ((): boolean => true);
  const acceptIntermediate = options.acceptIntermediate ?? ((): boolean => true);
  const maxVisited = options.maxVisited ?? 10_000;
  const queue: PortKey[] = [];
  const parent = new Map<PortKey, { from: PortKey; cableId: string | null }>();
  const seen = new Set<PortKey>();

  for (const start of [...starts].sort((a, b) => a.key.localeCompare(b.key))) {
    if (blocked.has(start.key) || seen.has(start.key)) continue;
    const startPort = graph.ports.get(start.key) ?? start;
    if (isGoal(startPort)) {
      return { target: start.key, ports: [start.key], cableIds: [] };
    }
    seen.add(start.key);
    queue.push(start.key);
  }

  while (queue.length > 0) {
    const current = queue.shift() as PortKey;
    if (seen.size > maxVisited) break;
    for (const edge of graph.adjacency.get(current) ?? []) {
      if (blocked.has(edge.to) || seen.has(edge.to)) continue;
      if (edge.kind === 'cable' && !acceptCable(edge.cableId)) continue;
      const port = graph.ports.get(edge.to);
      if (!port) continue;
      if (!isGoal(port) && !acceptIntermediate(port)) continue;
      seen.add(edge.to);
      parent.set(edge.to, { from: current, cableId: edge.cableId });
      if (isGoal(port)) {
        const chain: PortKey[] = [edge.to];
        const cables: string[] = [];
        let cursor: PortKey | undefined = edge.to;
        while (cursor !== undefined) {
          const step: { from: PortKey; cableId: string | null } | undefined = parent.get(cursor);
          if (!step) break;
          if (step.cableId !== null) cables.push(step.cableId);
          chain.unshift(step.from);
          cursor = step.from;
        }
        return { target: edge.to, ports: chain, cableIds: cables.reverse() };
      }
      queue.push(edge.to);
    }
  }
  return null;
}

/** Knotenbeschriftungen eines Port-Pfads (für das Gegenbeispiel im Event). */
export function describePath(
  graph: ConductionGraph,
  ports: readonly PortKey[],
  portGraph?: PortGraph
): string[] {
  const labels: string[] = [];
  for (const key of ports) {
    const port = portGraph?.ports.get(key);
    const nodeId = port ? port.nodeId : (key.split('::')[0] ?? key);
    const handle = port?.handleId ?? '?';
    const label = `${labelOfNode(graph, nodeId)} [${handle}]`;
    if (labels[labels.length - 1] !== label) labels.push(label);
  }
  return labels;
}

/** Minuspol-Ports eines Knotens. */
function minusPortsOf(graph: ConductionGraph, nodeId: string): PortRef[] {
  const component = graph.components.get(nodeId);
  if (!component) return [];
  return component.ports.filter((port) => port.polarity === 'negative');
}

/** Ist der Knoten ein Verbraucher (Last oder Wandler)? */
function isConsuming(behavior: ComponentBehavior): boolean {
  return behavior.kind === 'LOAD' || behavior.kind === 'CONVERTER';
}

// ============================================================================
// 1. PASS 1 — SYNTAX & CONNECTIVITY
// ============================================================================

/** SYN-001: Kanten mit fehlendem Endknoten. */
function checkDanglingEndpoints(graph: ConductionGraph): CheckResult {
  const events = [...graph.danglingEdges]
    .sort((a, b) => `${a.edgeId}:${a.missingNodeId}`.localeCompare(`${b.edgeId}:${b.missingNodeId}`))
    .map((entry) =>
      auditEvent({
        ruleId: 'SYN-001-dangling-endpoint',
        entity: { kind: 'edge', id: entry.edgeId },
        calculatedValue: null,
        allowedLimit: null,
        message: `Leitung „${entry.edgeId}“ verweist auf den nicht vorhandenen Knoten „${entry.missingNodeId}“. Die Leitung ist damit nicht bewertbar.`,
        autoFixRemedy:
          'Kante löschen oder den fehlenden Knoten wiederherstellen (Import/Altplan prüfen). Ohne Endknoten ist keine Dimensionierung möglich.',
        counterexample: [`${entry.edgeId} → ${entry.missingNodeId} (nicht vorhanden)`],
      })
    );
  return checkFromEvents('SYN-001-dangling-endpoint', events, graph.cables.length + events.length);
}

/** SYN-002: Bauteile ohne Verhaltensklasse. */
function checkUnmodeledComponents(graph: ConductionGraph): CheckResult {
  const seen = new Set<string>();
  const events: AuditEvent[] = [];
  for (const entry of [...graph.unmodeledComponents].sort((a, b) =>
    `${a.nodeId}:${a.edgeId}`.localeCompare(`${b.nodeId}:${b.edgeId}`)
  )) {
    if (seen.has(entry.nodeId)) continue;
    seen.add(entry.nodeId);
    events.push(
      auditEvent({
        ruleId: 'SYN-002-unmodeled-component',
        entity: { kind: 'node', id: entry.nodeId },
        kind: 'UNVERIFIABLE',
        message: `Bauteil „${labelOfNode(graph, entry.nodeId)}“ (Typ „${entry.nodeType}“) hat keine Verhaltensklasse im Verifikationsmodell. Seine Wirkung auf den Stromkreis ist damit unbekannt — die Prüfung dieses Zweigs ist nicht möglich.`,
        autoFixRemedy:
          'Bauteiltyp in die Verhaltensmatrix aufnehmen (lib/verify/graph.ts) oder das Bauteil aus dem elektrischen Kreis entfernen.',
        counterexample: [`Kante ${entry.edgeId} berührt ${entry.nodeId}`],
      })
    );
  }
  return checkFromEvents('SYN-002-unmodeled-component', events, graph.components.size);
}

/** SYN-003: Handles außerhalb der Registry-Deklaration. */
function checkUnknownPorts(graph: ConductionGraph): CheckResult {
  const seen = new Set<string>();
  const events: AuditEvent[] = [];
  for (const entry of [...graph.unknownPorts].sort((a, b) =>
    `${a.nodeId}:${String(a.handleId)}`.localeCompare(`${b.nodeId}:${String(b.handleId)}`)
  )) {
    const key = `${entry.nodeId}:${String(entry.handleId)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push(
      auditEvent({
        ruleId: 'SYN-003-unknown-port',
        entity: { kind: 'node', id: entry.nodeId },
        kind: 'UNVERIFIABLE',
        message: `Anschluss „${entry.handleId ?? '(ohne Handle)'}“ am Bauteil „${labelOfNode(graph, entry.nodeId)}“ ist nicht deklariert. Domäne und Polarität dieses Anschlusses sind damit nicht bestimmbar.`,
        autoFixRemedy:
          'Verbindung lösen und an einem deklarierten Anschluss neu ziehen, oder das Handle in der Bauteil-Registry ergänzen.',
        counterexample: [`Kante ${entry.edgeId} @ ${entry.nodeId}/${String(entry.handleId)}`],
      })
    );
  }
  return checkFromEvents('SYN-003-unknown-port', events, graph.components.size);
}

/** SYN-004: Leitungen über Domänengrenzen (DC-Kleinspannung ↔ 230 V AC). */
function checkDomainCrossings(graph: ConductionGraph): CheckResult {
  const events = graph.cables
    .filter((cable) => cable.from.domain !== cable.to.domain)
    .filter((cable) => cable.from.domain !== 'FLUID' && cable.to.domain !== 'FLUID')
    .sort((a, b) => a.edgeId.localeCompare(b.edgeId))
    .map((cable) =>
      auditEvent({
        ruleId: 'SYN-004-domain-crossing',
        entity: { kind: 'edge', id: cable.edgeId },
        calculatedValue: null,
        allowedLimit: null,
        message: `Leitung „${cable.edgeId}“ verbindet „${labelOfNode(graph, cable.from.nodeId)}“ (${cable.from.domain}) mit „${labelOfNode(graph, cable.to.nodeId)}“ (${cable.to.domain}). Eine Leitung über Domänengrenzen würde Netzspannung in den Kleinspannungskreis einkoppeln.`,
        autoFixRemedy:
          'Leitung trennen und in der richtigen Domäne neu verdrahten (12-V-Kreis bleibt 12 V, 230-V-Kreis bleibt 230 V); für den Übergang ein Bauteil mit getrennten Ein-/Ausgängen (Wechselrichter, Ladegerät) verwenden.',
        counterexample: [`${cable.from.nodeId} → ${cable.to.nodeId}`],
      })
    );
  return checkFromEvents('SYN-004-domain-crossing', events, graph.cables.length);
}

/** Pass 1 vollständig. */
export function runPass1(graph: ConductionGraph): CheckResult[] {
  return [
    checkDanglingEndpoints(graph),
    checkUnmodeledComponents(graph),
    checkUnknownPorts(graph),
    checkDomainCrossings(graph),
  ];
}

// ============================================================================
// 2. PASS 2 — POLARITÄT, KURZSCHLUSSFREIHEIT, SHUNT, MASSE
// ============================================================================

/** DOM-001: Kante Plus↔Minus im DC-Kreis. */
function checkPolarityCross(graph: ConductionGraph): CheckResult {
  const events = graph.cables
    .filter((cable) => cable.from.domain === 'DC_ELV' && cable.to.domain === 'DC_ELV')
    .filter((cable) => {
      const pair = [cable.from.polarity, cable.to.polarity];
      // Serienausnahme der Domäne: Solar-Module in Reihe (plus↔minus) sind
      // zulässig — die einzige Ausnahme, und sie wird namentlich geprüft.
      const isSeriesSolar =
        cable.carrier === 'solar' && cable.from.nodeType === 'solar' && cable.to.nodeType === 'solar';
      return !isSeriesSolar && pair.includes('positive') && pair.includes('negative');
    })
    .sort((a, b) => a.edgeId.localeCompare(b.edgeId))
    .map((cable) =>
      auditEvent({
        ruleId: 'DOM-001-polarity-cross',
        entity: { kind: 'edge', id: cable.edgeId },
        calculatedValue: null,
        allowedLimit: null,
        message: `Leitung „${cable.edgeId}“ verbindet Plus mit Minus (${labelOfNode(graph, cable.from.nodeId)} → ${labelOfNode(graph, cable.to.nodeId)}). Das ist ein satter Kurzschluss ohne Verbraucher.`,
        autoFixRemedy:
          'Leitung trennen. Plus und Minus dürfen sich nur über ein Verbraucher-Bauteil treffen; wenn eine Reihenschaltung gemeint ist, nur Solar-Module in Reihe schalten.',
        counterexample: [`${cable.from.nodeId} (plus) → ${cable.to.nodeId} (minus)`],
      })
    );
  return checkFromEvents('DOM-001-polarity-cross', events, graph.cables.length);
}

/** DOM-002: Kante Plus↔Masse/PE. */
function checkPositiveToReference(graph: ConductionGraph): CheckResult {
  const events = graph.cables
    .filter((cable) => {
      const hasPositive = [cable.from.polarity, cable.to.polarity].includes('positive');
      const reachesReference = [cable.from.nodeId, cable.to.nodeId].some(
        (nodeId) => behaviorOf(graph, nodeId).kind === 'REFERENCE'
      );
      const hasMinus = [cable.from.polarity, cable.to.polarity].includes('negative');
      return hasPositive && (reachesReference || hasMinus);
    })
    .sort((a, b) => a.edgeId.localeCompare(b.edgeId))
    .map((cable) =>
      auditEvent({
        ruleId: 'DOM-002-positive-to-reference',
        entity: { kind: 'edge', id: cable.edgeId },
        calculatedValue: null,
        allowedLimit: null,
        message: `Leitung „${cable.edgeId}“ führt den Pluspol auf Masse/Schutzleiter (${labelOfNode(graph, cable.from.nodeId)} → ${labelOfNode(graph, cable.to.nodeId)}). Der Kurzschlussstrom fließt über Karosserie bzw. PE.`,
        autoFixRemedy:
          'Leitung trennen. Plus nur über das Verbraucher-Bauteil führen; Masse-/PE-Anbindung ausschließlich auf der Minusseite (Massepunkt-Knoten).',
        counterexample: [`${cable.from.nodeId} → ${cable.to.nodeId}`],
      })
    );
  return checkFromEvents('DOM-002-positive-to-reference', events, graph.cables.length);
}

/**
 * TOPO-001: Kurzschlusspfad ohne Last.
 *
 * Beweisform: Für jede Quelle wird ein Pfad vom Pluspol gesucht, der nur
 * Leitungen und Durchführungen benutzt und am Minuspol einer Quelle oder an
 * einem Bezugspunkt (Masse) endet. Ein solcher Pfad ist ein Gegenbeispiel zur
 * Invariante „kein unbelasteter Plus-Minus-Pfad“.
 */
function checkShortPathWithoutLoad(graph: ConductionGraph, portGraph: PortGraph): CheckResult {
  const sourcePlusPorts: PortRef[] = [];
  let evaluated = 0;
  for (const component of [...graph.components.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId))) {
    if (component.behavior.kind !== 'SOURCE') continue;
    evaluated += 1;
    for (const port of component.ports) {
      if (port.polarity === 'positive' && port.domain === 'DC_ELV') sourcePlusPorts.push(port);
    }
  }

  const events: AuditEvent[] = [];
  const isGoal = (port: PortRef): boolean => {
    if (port.polarity !== 'negative') return false;
    const behavior = behaviorOf(graph, port.nodeId);
    if (behavior.kind === 'REFERENCE' || behavior.kind === 'SOURCE') return true;
    // Der Minuspol eines Verbrauchers beendet den Fehlerpfad NICHT als
    // Kurzschluss — dort fließt der Strom durch die Last. Er zählt deshalb
    // nicht als Ziel; der restliche Rückweg läuft über die Minusleiter und
    // wird beim Batteriepol gefunden.
    return false;
  };

  for (const start of sourcePlusPorts) {
    const result = walk(portGraph, [start], isGoal, {
      // Deklariertes Prädikat (TOPO-001): kein Schutzorgan auf irgendeiner
      // Leitung des Pfades …
      acceptCable: (cableId) => {
        const cable = cableId === null ? null : graph.cableById.get(cableId);
        if (!cable) return cableId === null;
        return cable.domain === 'DC_ELV' && cable.protections.length === 0;
      },
      // … und als Zwischenschritt ausschließlich PASSIVE Bauteile (keine Last,
      // kein Wandler, kein Schutzorgan, keine Messung).
      acceptIntermediate: (port) => behaviorOf(graph, port.nodeId).kind === 'PASSIVE',
    });
    if (!result) continue;
    const path = describePath(graph, result.ports, portGraph);
    events.push(
      auditEvent({
        ruleId: 'TOPO-001-short-path',
        entity: { kind: 'path', id: `${start.nodeId}${'→'}${result.target}` },
        calculatedValue: null,
        allowedLimit: null,
        message: `Unbelasteter Pfad vom Pluspol „${labelOfNode(graph, start.nodeId)}“ zum Minuspol/Masse: ${path.join(' → ')}. Dieser Pfad enthält weder eine Last noch ein Schutzorgan.`,
        autoFixRemedy:
          'Pfad auftrennen: Die Plusleitung muss über ein Verbraucher-Bauteil geführt werden. Wenn eine Masseverbindung auf der Plusseite entstanden ist, Leitung auf die Minusseite umklemmen. Zusätzlich ein Schutzorgan in diesem Abzweig vorsehen (200-mm-Regel).',
        counterexample: path,
      })
    );
  }
  return checkFromEvents('TOPO-001-short-path', events, evaluated);
}

/** Batterieknoten (DC-Quellen) eines Plans, deterministisch sortiert. */
function dcSourceNodeIds(graph: ConductionGraph): string[] {
  return [...graph.components.values()]
    .filter((component) => component.behavior.kind === 'SOURCE' && component.behavior.carrier === 'dc')
    .map((component) => component.nodeId)
    .sort();
}

/** TOPO-002: Direkte Kante Batterie-Minus ↔ Verbraucher. */
function checkShuntDirectBypass(graph: ConductionGraph): CheckResult {
  if (graph.shunts.length === 0) {
    // Kein Shunt im Plan ⇒ die Invariante ist leer erfüllt (kein stiller Pass:
    // die Regel erscheint als »nicht anwendbar« im Report).
    return passedCheck('TOPO-002-shunt-direct-bypass', 0);
  }
  const events: AuditEvent[] = [];
  let evaluated = 0;
  for (const shunt of graph.shunts) {
    // Nur die AUFBAU-Batterie: Das Minus einer Startbatterie läuft
    // fachgerecht direkt auf den Karosserie-Massepunkt und NICHT über den
    // Aufbau-Shunt — ein Booster-Strom auf der Starterseite ist kein
    // Aufbau-Verbrauch. Die Rollenlogik (`role`-Feld, sonst Label) ist
    // dieselbe wie in der App; ohne diese Ausnahme meldete die Regel genau
    // die Starterseite, die die App selbst so verdrahtet (Regel-Limitation
    // dieser Regel: „Startbatterien … sind ausgenommen“).
    const batteryIds = dcSourceNodeIds(graph).filter((nodeId) => {
      const behavior = behaviorOf(graph, nodeId);
      return behavior.kind === 'SOURCE' && behavior.role === 'house-battery';
    });
    for (const batteryId of batteryIds) {
      for (const cable of sortedCablesAt(graph, batteryId)) {
        const batteryPort = cable.from.nodeId === batteryId ? cable.from : cable.to;
        const other = otherPort(cable, batteryId);
        if (batteryPort.polarity !== 'negative') continue;
        evaluated += 1;
        if (other.nodeId === shunt.nodeId) continue;
        if (!isConsuming(behaviorOf(graph, other.nodeId))) continue;
        if (other.polarity !== 'negative') continue;
        events.push(
          auditEvent({
            ruleId: 'TOPO-002-shunt-direct-bypass',
            entity: { kind: 'edge', id: cable.edgeId },
            message: `Der Minuspol der Batterie „${labelOfNode(graph, batteryId)}“ ist direkt mit „${labelOfNode(graph, other.nodeId)}“ verbunden (Leitung „${cable.edgeId}“). Dieser Strom fließt am Messshunt vorbei und wird nie gemessen.`,
            autoFixRemedy:
              'Minusleitung am Shunt vorbei entfernen: Die Leitung von der Batterie-Minusseite zur Last-Messseite (LOAD−) des Shunts führen und die Last dort anschließen.',
            counterexample: [`${batteryId} (minus) → ${other.nodeId} (minus)`],
          })
        );
      }
    }
  }
  return checkFromEvents('TOPO-002-shunt-direct-bypass', events, evaluated);
}

/**
 * TOPO-003: Trennebene der Shunt-Messseite.
 *
 * Formal: Entfernt man alle Ports des Shunts aus dem Konduktionsgraphen, darf
 * kein Minuspol einer (Aufbau-)Batterie mehr einen Verbraucher-Minuspol
 * erreichen. Ein gefundener Pfad ist das Gegenbeispiel.
 */
function checkShuntCut(graph: ConductionGraph, portGraph: PortGraph): CheckResult {
  if (graph.shunts.length === 0) return passedCheck('TOPO-003-shunt-cut', 0);
  const events: AuditEvent[] = [];
  const evaluated = graph.shunts.length;

  for (const shunt of graph.shunts) {
    const blocked = new Set<PortKey>();
    const component = graph.components.get(shunt.nodeId);
    for (const port of component?.ports ?? []) blocked.add(port.key);

    const batteryNodes = [...graph.components.values()]
      .filter(
        (entry) =>
          entry.behavior.kind === 'SOURCE' &&
          entry.behavior.carrier === 'dc' &&
          entry.behavior.role === 'house-battery'
      )
      .map((entry) => entry.nodeId)
      .sort();
    const seek = (port: PortRef): boolean => consumeNodes.has(port.nodeId);

    const consumeNodes = new Set(
      [...graph.components.values()]
        .filter((entry) => isConsuming(entry.behavior))
        .map((entry) => entry.nodeId)
    );

    for (const batteryId of batteryNodes) {
      const starts = minusPortsOf(graph, batteryId);
      if (starts.length === 0) continue;
      const result = walk(portGraph, starts, seek, { blocked });
      if (!result) continue;
      const path = describePath(graph, result.ports, portGraph);
      events.push(
        auditEvent({
          ruleId: 'TOPO-003-shunt-cut',
          entity: { kind: 'path', id: `shunt:${shunt.nodeId}` },
          message: `Der Minusstrom von „${labelOfNode(graph, batteryId)}“ erreicht „${labelOfNode(graph, result.target.split('::')[0] ?? '')}“ ohne die Messseite des Shunts: ${path.join(' → ')}.`,
          autoFixRemedy:
            'Die Minusverbindung an der Last-Messseite (LOAD−) des Shunts zusammenführen: Alle Verbraucher-Minusleitungen an LOAD− anschließen, der Batteriepol bleibt ausschließlich an BAT−.',
          counterexample: path,
        })
      );
      break; // Ein Gegenbeispiel genügt für dieses Verdikt.
    }
  }
  return checkFromEvents('TOPO-003-shunt-cut', events, evaluated);
}

/**
 * TOPO-004: Masseschleife (geschlossener Referenzpfad).
 *
 * Eine Schleife liegt vor, wenn es im Minus-/Masse-System einen Zyklus gibt,
 * der mindestens einen Massepunkt berührt: Zwei Wege zwischen denselben
 * Potentialpunkten führen zu Ausgleichsströmen über Karosserie und PE.
 *
 * Präzisierung gegenüber dem reinen Kabelsgraph (deshalb zwei Zyklenbegriffe):
 *   - Betrachtet werden nur REFERENZLEITER (beide Enden im Minus-/PE-/N-Potential
 *     oder ein Ende an einem Massepunkt). Ein Plus↔Masse-Kabel ist ein
 *     Kurzschluss (DOM-002) und keine Masseschleife.
 *   - Parallel gebündelte Leitungen zwischen DEMSELBEN Knotenpaar gelten als ein
 *     Weg (gleiche Potentialpunkte, keine ausgleichsstromfähige Fläche); erst
 *     zwei unterschiedliche Knotenfolgen bilden eine Schleife.
 */
function checkGroundLoops(graph: ConductionGraph): CheckResult {
  const referenceNodes = [...graph.components.values()]
    .filter((component) => component.behavior.kind === 'REFERENCE')
    .map((component) => component.nodeId)
    .sort();
  if (referenceNodes.length === 0) {
    return passedCheck('TOPO-004-ground-loop', 0);
  }

  const events: AuditEvent[] = [];
  const seen = new Set<string>();
  for (const referenceId of referenceNodes) {
    const cycle = findReferenceLoop(graph, referenceId);
    if (!cycle) continue;
    const key = [...cycle].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const labels = cycle.map((nodeId) => labelOfNode(graph, nodeId));
    events.push(
      auditEvent({
        ruleId: 'TOPO-004-ground-loop',
        entity: { kind: 'node', id: referenceId },
        message: `Geschlossene Masse-/Minusschleife über „${labelOfNode(graph, referenceId)}“: ${labels.join(' → ')} → zurück zu ${labels[0]}. Zwei Wege zwischen denselben Potentialpunkten führen zu Ausgleichsströmen über Karosserie und Schutzleiter.`,
        autoFixRemedy:
          'Masse als Sternpunkt ausführen: zweiten Massepunkt (oder die doppelte Bondleitung) entfernen, sodass jeder Stromkreis genau eine Masseanbindung hat.',
        counterexample: [...labels, `${labels[0]} (zurück)`],
      })
    );
  }
  return checkFromEvents('TOPO-004-ground-loop', events, referenceNodes.length);
}

/**
 * Zyklus über Referenzleiter, der `startId` berührt — einfache Sicht
 * (parallele Leitungen zwischen demselben Knotenpaar zählen einmal),
 * Rückgabe OHNE wiederholten Startknoten.
 *
 * Verfahren: Für jede inzidente Referenzleitung wird versucht, den
 * Nachbarknoten über einen ANDEREN Referenzweg wieder zu erreichen. Da
 * Knotenpaare kollabiert werden, ist ein gefundener Weg immer eine echte
 * Knotenfolge ≥ 3. Deterministisch (sortierte Iteration).
 */
export function findReferenceLoop(graph: ConductionGraph, startId: string): string[] | null {
  const incident = cablesAt(graph, startId).filter((cable) => isReferenceConductor(graph, cable));
  const pairs = new Set<string>();
  for (const first of [...incident].sort((a, b) => a.edgeId.localeCompare(b.edgeId))) {
    const neighbor = first.from.nodeId === startId ? first.to.nodeId : first.from.nodeId;
    if (neighbor === startId) continue;
    const pairKey = [startId, neighbor].sort().join('|');
    if (pairs.has(pairKey)) continue; // Bündel zwischen denselben Punkten = ein Weg
    pairs.add(pairKey);
    const path = findReferencePath(graph, neighbor, startId, pairKey);
    if (path) return path;
  }
  return null;
}

/** Ist die Leitung ein Referenzleiter (Minus/PE/N oder an einem Massepunkt)? */
const REFERENCE_POLARITIES = new Set<Polarity>(['negative', 'protective-earth', 'neutral']);

function isReferenceConductor(graph: ConductionGraph, cable: CableModel): boolean {
  if (REFERENCE_POLARITIES.has(cable.from.polarity) && REFERENCE_POLARITIES.has(cable.to.polarity)) {
    return true;
  }
  return (
    behaviorOf(graph, cable.from.nodeId).kind === 'REFERENCE' ||
    behaviorOf(graph, cable.to.nodeId).kind === 'REFERENCE'
  );
}

/**
 * BFS über Referenzleiter von `from` nach `to`; das kollabierte Knotenpaar
 * `forbiddenPair` darf nicht erneut benutzt werden.
 */
function findReferencePath(
  graph: ConductionGraph,
  from: string,
  to: string,
  forbiddenPair: string
): string[] | null {
  const queue: string[] = [from];
  const parent = new Map<string, string>();
  const seen = new Set<string>([from]);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const cables = [...cablesAt(graph, current)]
      .filter((cable) => isReferenceConductor(graph, cable))
      .sort((a, b) => a.edgeId.localeCompare(b.edgeId));
    for (const cable of cables) {
      const neighbor = cable.from.nodeId === current ? cable.to.nodeId : cable.from.nodeId;
      if (neighbor === current) continue;
      const pairKey = [current, neighbor].sort().join('|');
      if (pairKey === forbiddenPair) continue;
      if (seen.has(neighbor)) continue;
      seen.add(neighbor);
      parent.set(neighbor, current);
      if (neighbor === to) {
        const chain = [to];
        let cursor = current;
        while (cursor !== undefined && cursor !== from) {
          chain.unshift(cursor);
          cursor = parent.get(cursor) as string;
        }
        // `from` ist der (nicht wiederholte) Anschlusspunkt der Schleife.
        chain.unshift(from);
        return chain;
      }
      queue.push(neighbor);
    }
  }
  return null;
}

/** TOPO-005: Leitung zwischen Fluidik/Dachfläche und Elektrik. */
function checkFluidBridges(graph: ConductionGraph): CheckResult {
  const events = graph.fluidBridges
    .slice()
    .sort((a, b) => a.edgeId.localeCompare(b.edgeId))
    .map((bridge) =>
      auditEvent({
        ruleId: 'TOPO-005-fluid-electrical-bridge',
        entity: { kind: 'edge', id: bridge.edgeId },
        calculatedValue: null,
        allowedLimit: null,
        message: `Fluidik-/Flächenknoten „${labelOfNode(graph, bridge.fluidNodeId)}“ ist über die Leitung „${bridge.edgeId}“ mit dem elektrischen Knoten „${labelOfNode(graph, bridge.otherNodeId)}“ verbunden.`,
        autoFixRemedy:
          'Verbindung löschen. Wasser/Gas und elektrische Leiter werden getrennt geführt; eine Leitung zwischen beiden Domänen ist im Modell nicht darstellbar.',
        counterexample: [`${bridge.fluidNodeId} → ${bridge.otherNodeId}`],
      })
    );
  return checkOrNotApplicable(
    'TOPO-005-fluid-electrical-bridge',
    events,
    graph.fluidBridges.length + graph.cables.length
  );
}

/** Pass 2 vollständig. */
export function runPass2(graph: ConductionGraph): CheckResult[] {
  const portGraph = buildPortGraph(graph);
  return [
    checkPolarityCross(graph),
    checkPositiveToReference(graph),
    checkShortPathWithoutLoad(graph, portGraph),
    checkShuntDirectBypass(graph),
    checkShuntCut(graph, portGraph),
    checkGroundLoops(graph),
    checkFluidBridges(graph),
  ];
}

/** Alle Kabel eines Knotens, deterministisch sortiert (Hilfsfunktion). */
export function sortedCablesAt(graph: ConductionGraph, nodeId: string): CableModel[] {
  return [...cablesAt(graph, nodeId)].sort((a, b) => a.edgeId.localeCompare(b.edgeId));
}
