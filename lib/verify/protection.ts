/**
 * lib/verify/protection.ts — PASS 5: Erdung, Fehlerstromschutz und Netzform.
 *
 * Die 230-V-Seite ist kein DC-Problem: Hier entscheidet die TOPOLOGIE, ob ein
 * Fehlerstrom überhaupt einen Pfad zum Zurückfließen hat — und damit, ob eine
 * Fehlerstrom-Schutzeinrichtung (RCD) auslösen KANN. Genau das wird hier
 * geprüft, und zwar mit den Daten, die der Plan wirklich hat:
 *
 *   - RCD-001  jeder 230-V-Stromkreis hinter einem FI ≤ 30 mA
 *   - RCD-002  Fehlerstromtyp der Wechselrichter-Insel (glatte Gleichfehlerströme)
 *   - RCD-003  kein Abzweig VOR der Fehlerstrom-Schutzeinrichtung
 *   - RCD-004  zweipolige Abschaltung der Einspeisung (nur Profil PRACTICE,
 *              weil im Repo nicht klausenbelegt — s. Regelmatrix)
 *   - RCD-005  Abschaltbedingung über `evaluateAcEdgeProtection` (EINE Quelle)
 *   - RCD-006  Selektivität zweier RCDs in Reihe
 *   - GND-001  Querschnitt der Masseanbindung (16 mm² Planungsvorgabe)
 *   - NET-001  kein PEN / deklarierte Netzform der Einspeisung
 *   - NET-002  Fehlerschleife der Insel (N-PE-Bezug + FI)
 *
 * Wichtig für die Aussagekraft: Der Plan modelliert die Fahrzeugseite
 * EINLEITERIG (L und N sind nicht als getrennte Kanten abgebildet). Alle
 * Aussagen über »vor/hinter dem FI« sind deshalb Aussagen über die Position im
 * Leitungspfad, nicht über einzelne Leiter — genau so steht es in der
 * Einschränkung der Regeln.
 */

import { acSourceKindOf, evaluateAcEdgeProtection } from '../acProtection';
import type { AcProtectionDescriptor } from '../acProtection';
import { isOvercurrentProtection, type OvercurrentProtectionDevice } from './deviceClasses';

import type { PassContext } from './context';
import { auditEvent, checkOrNotApplicable, passedCheck } from './events';
import { labelOfNode } from './graph';
import { RCD_SELECTIVITY_RATIO_HEURISTIC } from './physics';
import { sortedCables, upstreamChain } from './pathSearch';
import { buildPortGraph, type PortGraph } from './topology';
import type { AuditEvent, CheckResult, PortRef, ProtectionDevice, ProtectionPlacement } from './types';

/** Mindestquerschnitt der Masseanbindung (AutoWire-Planungsvorgabe). */
export const CHASSIS_BOND_MIN_MM2 = 16;

/** Zulässiger Bemessungsdifferenzstrom eines FI für Endstromkreise im Fahrzeug. */
export const MAX_RCD_RESIDUAL_CURRENT_A = 0.03;

type RcdDevice = Extract<ProtectionDevice, { type: 'rcd' }>;

const isRcd = (device: ProtectionDevice): device is RcdDevice => device.type === 'rcd';

/** Platzierung MIT RCD — die Typprüfung hält ihn aus der Überstromlogik heraus. */
type RcdPlacement = ProtectionPlacement & { device: RcdDevice };
const isRcdPlacement = (placement: ProtectionPlacement): placement is RcdPlacement => isRcd(placement.device);

const isOvercurrentPlacement = (
  placement: ProtectionPlacement
): placement is ProtectionPlacement & { device: OvercurrentProtectionDevice } =>
  isOvercurrentProtection(placement.device);

// ============================================================================
// AC-WALK — Erreichbarkeit auf der 230-V-Seite
// ============================================================================

interface AcWalkEntry {
  portKey: string;
  nodeId: string;
  /** Wurde auf dem Weg ein FI durchlaufen (oder sitzt er an der Einspeisung)? */
  protectedByRcd: boolean;
  /** FI-Bemessungsdifferenzströme auf dem Weg (A). */
  rcdResidualCurrentsA: readonly number[];
  /** Knoten-Namen auf dem Weg (Gegenbeispiel im Audit-Event). */
  path: readonly string[];
}

/**
 * Erreichbarkeitssuche auf der AC-Seite ab einem Einspeiseport.
 *
 * Die Suche ist gerichtet gedacht (Einspeisung → Last), läuft aber technisch
 * ungerichtet über die Port-Verbindungen: Für die Frage »gibt es einen
 * Durchgang ohne FI?« zählt jeder elektrisch leitende Weg, unabhängig von der
 * Pfeilrichtung der Zeichnung.
 */
function acWalk(context: PassContext, portGraph: PortGraph, starts: readonly PortRef[]): AcWalkEntry[] {
  const visited = new Set<string>();
  const out: AcWalkEntry[] = [];
  const queue: Array<{ key: string; protectedByRcd: boolean; residuals: number[]; path: string[] }> = [];

  for (const port of [...starts].sort((a, b) => a.key.localeCompare(b.key))) {
    if (visited.has(port.key)) continue;
    visited.add(port.key);
    queue.push({
      key: port.key,
      protectedByRcd: false,
      residuals: [],
      path: [labelOfNode(context.graph, port.nodeId)],
    });
  }

  let head = 0;
  while (head < queue.length) {
    const state = queue[head];
    head += 1;
    if (!state) continue;
    const port = portGraph.ports.get(state.key);
    if (!port) continue;
    out.push({
      portKey: state.key,
      nodeId: port.nodeId,
      protectedByRcd: state.protectedByRcd,
      rcdResidualCurrentsA: state.residuals,
      path: state.path,
    });

    for (const edge of portGraph.adjacency.get(state.key) ?? []) {
      const nextKey = edge.to;
      let protectedByRcd = state.protectedByRcd;
      let residuals = state.residuals;
      // Wird in jedem Zweig gesetzt, der nicht `continue`t.
      let nextNodeId: string;
      let throughCable = false;
      if (edge.kind === 'cable' && edge.cableId) {
        const cable = context.graph.cableById.get(edge.cableId);
        if (!cable || cable.domain !== 'AC_LV') continue;
        throughCable = true;
        nextNodeId = cable.from.nodeId === port.nodeId ? cable.to.nodeId : cable.from.nodeId;
        const rcds = cable.protections.map((placement) => placement.device).filter(isRcd);
        if (rcds.length > 0) {
          protectedByRcd = true;
          residuals = [...residuals, ...rcds.map((rcd) => rcd.ratedResidualCurrentA)];
        }
      } else if (edge.kind === 'series') {
        const target = portGraph.ports.get(edge.to);
        if (!target || target.domain !== 'AC_LV') continue;
        nextNodeId = target.nodeId;
      } else {
        continue;
      }
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);
      queue.push({
        key: nextKey,
        protectedByRcd,
        residuals,
        path: throughCable ? [...state.path, labelOfNode(context.graph, nextNodeId)] : state.path,
      });
    }
  }
  return out;
}

/** Einspeisepunkte der 230-V-Seite mit ihrer Schutzwirkung »ab Werk«. */
interface AcSupply {
  nodeId: string;
  label: string;
  /** FI am Einspeisepunkt laut Plandaten (`hasRcd`). */
  rcdAtSource: boolean;
  ports: readonly PortRef[];
}

function acSupplies(context: PassContext): AcSupply[] {
  const supplies: AcSupply[] = [];
  for (const component of [...context.graph.components.values()].sort((a, b) =>
    a.nodeId.localeCompare(b.nodeId)
  )) {
    const behavior = component.behavior;
    const isShore = behavior.kind === 'SOURCE' && behavior.carrier === 'ac';
    const isInverter = behavior.kind === 'CONVERTER' && behavior.outputDomain === 'AC_LV';
    if (!isShore && !isInverter) continue;
    const node = context.nodes.find((entry) => entry.id === component.nodeId);
    const hasRcd = (node?.data as { hasRcd?: unknown } | undefined)?.hasRcd === true;
    supplies.push({
      nodeId: component.nodeId,
      label: labelOfNode(context.graph, component.nodeId),
      rcdAtSource: hasRcd,
      ports: component.ports.filter((port) => port.domain === 'AC_LV'),
    });
  }
  return supplies;
}

/** 230-V-Verbraucher: Lastknoten der AC-Domäne und Wandler mit AC-Eingang. */
function acLoadNodes(context: PassContext): string[] {
  const nodes: string[] = [];
  for (const component of context.graph.components.values()) {
    const hasAcPort = component.ports.some((port) => port.domain === 'AC_LV');
    if (!hasAcPort) continue;
    const behavior = component.behavior;
    const isConsumer = behavior.kind === 'LOAD';
    const isAcFedConverter = behavior.kind === 'CONVERTER' && behavior.inputDomain === 'AC_LV';
    if (isConsumer || isAcFedConverter) nodes.push(component.nodeId);
  }
  return nodes.sort();
}

interface ReachReport {
  /** Lasten, die auf mindestens einem Weg OHNE FI erreichbar sind. */
  unprotected: Array<{ nodeId: string; path: readonly string[] }>;
  /** Lasten, die gar nicht erreichbar sind (kein AC-Pfad). */
  unreachable: string[];
  /** Lasten mit FI auf jedem Weg. */
  protectedNodes: string[];
  /** true = mindestens ein Weg führte durch einen FI. */
  anyRcdInPlan: boolean;
}

function analyseAcCoverage(context: PassContext, portGraph: PortGraph): ReachReport {
  const loads = new Set(acLoadNodes(context));
  const supplies = acSupplies(context);
  const unprotected = new Map<string, readonly string[]>();
  const protectedNodes = new Set<string>();
  const reachable = new Set<string>();
  let anyRcdInPlan = false;

  for (const supply of supplies) {
    const walks = acWalk(context, portGraph, supply.ports);
    for (const entry of walks) {
      if (!loads.has(entry.nodeId)) continue;
      reachable.add(entry.nodeId);
      const covered = supply.rcdAtSource || entry.protectedByRcd;
      if (covered) {
        protectedNodes.add(entry.nodeId);
        if (entry.rcdResidualCurrentsA.length > 0 || supply.rcdAtSource) anyRcdInPlan = true;
      } else if (!unprotected.has(entry.nodeId)) {
        unprotected.set(entry.nodeId, entry.path);
      }
    }
    if (supply.rcdAtSource) anyRcdInPlan = true;
  }

  const unreachable = [...loads].filter((nodeId) => !reachable.has(nodeId)).sort();
  const unprotectedList = [...unprotected.entries()]
    .filter(([nodeId]) => !protectedNodes.has(nodeId))
    .map(([nodeId, path]) => ({ nodeId, path }))
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId));

  return {
    unprotected: unprotectedList,
    unreachable,
    protectedNodes: [...protectedNodes].sort(),
    anyRcdInPlan,
  };
}

// ============================================================================
// RCD-001 — Fehlerstromschutz je Stromkreis
// ============================================================================

export function checkRcdCoverage(context: PassContext): CheckResult {
  const ruleId = 'RCD-001-rcd-deviation' as const;
  const loadNodes = acLoadNodes(context);
  if (loadNodes.length === 0) {
    // Leere Quantifizierung ist bewiesen wahr — aber der Report weist sie als
    // »0 geprüfte Entitäten« aus (PASS ohne Scheinaussage über 230 V).
    return passedCheck(ruleId, 0);
  }

  const events: AuditEvent[] = [];
  const portGraph = buildPortGraph(context.graph);
  const coverage = analyseAcCoverage(context, portGraph);
  const overLimit = rcdsOverLimit(context);

  for (const entry of coverage.unprotected) {
    events.push(
      auditEvent({
        ruleId,
        entity: { kind: 'node', id: entry.nodeId },
        severity: 'CRITICAL_SAFETY',
        message: `230-V-Stromkreis ${labelOfNode(context.graph, entry.nodeId)}: auf dem Weg von der Einspeisung führt kein FI ≤ 30 mA — der Stromkreis ist nicht fehlerstromgeschützt.`,
        autoFixRemedy: `FI (30 mA, Typ A; Typ B bei möglichen glatten Gleichfehlerströmen) unmittelbar hinter der Einspeisung bzw. am Wechselrichter-Ausgang für diesen Stromkreis setzen und die 230-V-Leitung dahinter führen.`,
        counterexample: entry.path,
      })
    );
  }

  for (const nodeId of coverage.unreachable) {
    events.push(
      auditEvent({
        ruleId,
        entity: { kind: 'node', id: nodeId },
        kind: 'UNVERIFIABLE',
        message: `230-V-Stromkreis ${labelOfNode(context.graph, nodeId)}: kein Versorgungspfad gefunden — ohne Pfad ist kein FI nachweisbar.`,
        autoFixRemedy:
          'Stromkreis an Landstrom bzw. Wechselrichterausgang anschließen; erst danach ist der Fehlerstromschutz prüfbar.',
      })
    );
  }

  for (const finding of overLimit) {
    events.push(
      auditEvent({
        ruleId,
        entity: { kind: 'edge', id: finding.edgeId },
        severity: 'CRITICAL_SAFETY',
        calculatedValue: finding.ratedResidualCurrentA * 1000,
        allowedLimit: MAX_RCD_RESIDUAL_CURRENT_A * 1000,
        unit: 'mA',
        message: `FI auf Leitung ${finding.edgeId}: Bemessungsdifferenzstrom ${finding.ratedResidualCurrentA * 1000} mA überschreitet 30 mA.`,
        autoFixRemedy:
          'FI mit IΔn ≤ 30 mA einsetzen (für Personenschutz in Caravan/Motorcaravan zulässig: höchstens 30 mA).',
      })
    );
  }

  return checkOrNotApplicable(
    ruleId,
    events,
    coverage.protectedNodes.length + coverage.unprotected.length + overLimit.length
  );
}

/** FI-Organe mit IΔn > 30 mA auf AC-Leitungen (unabhängig vom Pfad). */
function rcdsOverLimit(context: PassContext): Array<{ edgeId: string; ratedResidualCurrentA: number }> {
  const findings: Array<{ edgeId: string; ratedResidualCurrentA: number }> = [];
  for (const cable of sortedCables(context.graph)) {
    if (cable.domain !== 'AC_LV') continue;
    for (const placement of cable.protections) {
      if (!isRcd(placement.device)) continue;
      if (placement.device.ratedResidualCurrentA > MAX_RCD_RESIDUAL_CURRENT_A + 1e-12) {
        findings.push({
          edgeId: cable.edgeId,
          ratedResidualCurrentA: placement.device.ratedResidualCurrentA,
        });
      }
    }
  }
  return findings;
}

// ============================================================================
// RCD-002 — Fehlerstromtyp der Insel
// ============================================================================

export function checkRcdType(context: PassContext): CheckResult {
  const ruleId = 'RCD-002-rcd-type' as const;
  const events: AuditEvent[] = [];
  let evaluated = 0;

  const inverters = [...context.graph.components.values()]
    .filter(
      (component) => component.behavior.kind === 'CONVERTER' && component.behavior.outputDomain === 'AC_LV'
    )
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId));

  if (inverters.length === 0) return passedCheck(ruleId, 0);

  const portGraph = buildPortGraph(context.graph);
  const loads = new Set(acLoadNodes(context));

  for (const inverter of inverters) {
    const ports = inverter.ports.filter((port) => port.domain === 'AC_LV');
    if (ports.length === 0) continue;
    const walks = acWalk(context, portGraph, ports);
    const islandLoads = [
      ...new Set(walks.map((entry) => entry.nodeId).filter((nodeId) => loads.has(nodeId))),
    ];
    if (islandLoads.length === 0) continue;

    // FI-Typen der Insel: Kabel-FIs im erreichbaren Bereich + integrierter FI.
    const residualTypes = new Set<string>();
    for (const edge of walks.flatMap((entry) => portGraph.adjacency.get(entry.portKey) ?? [])) {
      if (edge.kind !== 'cable' || !edge.cableId) continue;
      const cable = context.graph.cableById.get(edge.cableId);
      if (!cable || cable.domain !== 'AC_LV') continue;
      for (const placement of cable.protections) {
        if (isRcd(placement.device)) residualTypes.add(placement.device.residualType);
      }
    }
    const integrated = inverter.behavior.kind === 'CONVERTER' ? inverter.behavior.hasIntegratedRcd : null;

    if (residualTypes.size === 0 && integrated !== true) {
      // Kein FI vorhanden → das ist RCD-001, hier nicht doppelt gemeldet.
      continue;
    }

    evaluated += 1;
    const entity = { kind: 'node' as const, id: inverter.nodeId };
    const label = labelOfNode(context.graph, inverter.nodeId);

    if (residualTypes.has('AC')) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          severity: 'CRITICAL_SAFETY',
          message: `Wechselrichter-Insel ${label}: FI vom Typ AC ist für Inselnetze mit Halbleiterquelle unzureichend — glatte Gleichfehlerströme können ihn blind machen.`,
          autoFixRemedy: `FI Typ B (oder Typ A mit Herstellererklärung „keine glatten Gleichfehlerströme“) am ${label}-Ausgang vorsehen.`,
        })
      );
      continue;
    }

    const types = [...residualTypes].sort().join(', ');
    events.push(
      auditEvent({
        ruleId,
        entity,
        kind: 'UNVERIFIABLE',
        message: `Wechselrichter-Insel ${label}: FI-Typ ${types === '' ? '(integrierter FI ohne Typangabe)' : types} — ob der ${label} glatte Gleichfehlerströme liefern kann, sagt der Plan nicht; Typ A ist dann NICHT belegt.`,
        autoFixRemedy: `Herstellererklärung des ${label} („erzeugt keine glatten Gleichfehlerströme“) als Nachweis hinterlegen und im Plan dokumentieren — oder unmittelbar FI Typ B einsetzen.`,
      })
    );
  }

  return checkOrNotApplicable(ruleId, events, evaluated);
}

// ============================================================================
// RCD-003 — kein Abzweig vor der Schutzeinrichtung
// ============================================================================

export function checkRcdPosition(context: PassContext): CheckResult {
  const ruleId = 'RCD-003-rcd-position' as const;
  const loadNodes = acLoadNodes(context);
  if (loadNodes.length === 0) return passedCheck(ruleId, 0);

  const portGraph = buildPortGraph(context.graph);
  const coverage = analyseAcCoverage(context, portGraph);
  const events: AuditEvent[] = [];
  let evaluated = 0;

  if (!coverage.anyRcdInPlan) {
    // Es gibt überhaupt keinen FI: Diese Regel prüft Abzweige VOR einer
    // vorhandenen Schutzeinrichtung — ohne FI ist sie nicht anwendbar; die
    // Grundanforderung meldet RCD-001.
    return passedCheck(ruleId, 0);
  }

  for (const entry of coverage.unprotected) {
    evaluated += 1;
    events.push(
      auditEvent({
        ruleId,
        entity: { kind: 'node', id: entry.nodeId },
        severity: 'CRITICAL_SAFETY',
        message: `Abzweig vor dem FI: Stromkreis ${labelOfNode(context.graph, entry.nodeId)} ist von der Einspeisung erreichbar, ohne einen vorhandenen FI zu durchlaufen.`,
        autoFixRemedy:
          'Diesen Stromkreis hinter die Fehlerstrom-Schutzeinrichtung legen (Abzweig erst nach deren Eingangsklemmen) oder einen eigenen FI ≤ 30 mA für diesen Abzweig einsetzen.',
        counterexample: entry.path,
      })
    );
  }

  evaluated += coverage.protectedNodes.length;
  return checkOrNotApplicable(ruleId, events, evaluated);
}

// ============================================================================
// RCD-004 — zweipolige Abschaltung (Profil PRACTICE)
// ============================================================================

export function checkTwoPoleSwitching(context: PassContext): CheckResult {
  const ruleId = 'RCD-004-two-pole-switching' as const;
  const shore = context.graph.components.values();
  const shoreEntries = [...shore].filter(
    (component) => component.behavior.kind === 'SOURCE' && component.behavior.carrier === 'ac'
  );
  if (shoreEntries.length === 0) return passedCheck(ruleId, 0);

  const events: AuditEvent[] = [];
  let evaluated = 0;

  for (const entry of shoreEntries.sort((a, b) => a.nodeId.localeCompare(b.nodeId))) {
    const cables = sortedCables(context.graph).filter(
      (cable) => cable.domain === 'AC_LV' && cable.from.nodeId === entry.nodeId
    );
    const devices = cables.flatMap((cable) => cable.protections.map((placement) => placement.device));
    if (devices.length === 0) {
      events.push(
        auditEvent({
          ruleId,
          entity: { kind: 'node', id: entry.nodeId },
          kind: 'UNVERIFIABLE',
          message: `Einspeisung ${labelOfNode(context.graph, entry.nodeId)}: kein Schutzorgan an der Einspeiseleitung — die Polzahl (L+N abschaltend) ist nicht bestimmbar.`,
          autoFixRemedy:
            'Schutzorgan an der Einspeiseleitung eintragen (Feld `fuseSize`/`acProtection`) und dessen Polzahl im Datenblatt nachweisen.',
        })
      );
      continue;
    }
    for (const cable of cables) {
      for (const placement of cable.protections) {
        const device = placement.device;
        // Polzahl ist bei LS und FI/LS modelliert; eine Sicherung hat keine
        // Polangabe — sie bleibt ausdrücklich unbekannt (UNPROVABLE).
        const poles = device.type === 'mcb' || device.type === 'rcd' ? (device.poles ?? null) : null;
        if (poles === null) {
          events.push(
            auditEvent({
              ruleId,
              entity: { kind: 'edge', id: cable.edgeId },
              kind: 'UNVERIFIABLE',
              message: `Einspeiseleitung ${cable.edgeId}: Polzahl des Schutzorgans ist nicht angegeben — zweipolige Abschaltung (L+N) ist nicht belegt.`,
              autoFixRemedy:
                'Polzahl aus dem Datenblatt nachtragen (zweipoliger LS/FI/LS) — einpolige Einspeise-Schutzorgane sind für Caravan-Einspeisungen nicht zulässig.',
            })
          );
          continue;
        }
        evaluated += 1;
        if (poles < 2) {
          events.push(
            auditEvent({
              ruleId,
              entity: { kind: 'edge', id: cable.edgeId },
              calculatedValue: poles,
              allowedLimit: 2,
              message: `Einspeiseleitung ${cable.edgeId}: Schutzorgan schaltet nur ${poles} Pol(e) — L und N müssen gemeinsam abgeschaltet werden.`,
              autoFixRemedy:
                'Zweipoligen Leitungsschutzschalter (L+N) bzw. zweipoligen FI/LS an der Einspeisung einsetzen.',
            })
          );
        }
      }
    }
  }

  return checkOrNotApplicable(ruleId, events, evaluated);
}

// ============================================================================
// RCD-005 — Abschaltbedingung (Schleifenimpedanz)
// ============================================================================

export function checkLoopImpedance(context: PassContext): CheckResult {
  const ruleId = 'RCD-005-loop-impedance' as const;
  const acCables = sortedCables(context.graph).filter((cable) => cable.domain === 'AC_LV');
  if (acCables.length === 0) return passedCheck(ruleId, 0);

  const events: AuditEvent[] = [];
  let evaluated = 0;
  const anyUpstreamRcd = acSupplies(context).some((supply) => supply.rcdAtSource);
  const withoutDevice = sortedCables(context.graph).filter(
    (cable) =>
      cable.domain === 'AC_LV' && !cable.protections.some((placement) => isOvercurrentPlacement(placement))
  );

  for (const cable of acCables) {
    const withProtection = cable.protections.filter(isOvercurrentPlacement);
    if (withProtection.length === 0) continue;
    const edge = context.edges.find((entry) => entry.id === cable.edgeId);
    const descriptor = edge?.data?.acProtection as AcProtectionDescriptor | undefined;
    const sourceNode = context.nodes.find((entry) => entry.id === cable.from.nodeId);
    const supplyProspectiveIkA = prospectiveIkOf(sourceNode?.data);

    for (const placement of withProtection) {
      const device = placement.device;
      evaluated += 1;
      if (device.type === 'fuse') continue; // DC-Sicherung auf einer AC-Leitung: kein LS-Verdikt
      const assessment = evaluateAcEdgeProtection({
        ratedCurrentA: device.ratedCurrentA > 0 ? device.ratedCurrentA : undefined,
        descriptor,
        lengthM: cable.lengthM ?? undefined,
        crossSection: cable.crossSectionMm2 ?? undefined,
        sourceKind: acSourceKindOf(cable.from.nodeType),
        upstreamRcd: anyUpstreamRcd,
        supplyProspectiveIkA,
      });
      const entity = { kind: 'edge' as const, id: cable.edgeId };
      if (assessment.verdict === 'fail' || assessment.verdict === 'breaking-capacity-fail') {
        events.push(
          auditEvent({
            ruleId,
            entity,
            severity: 'CRITICAL_SAFETY',
            calculatedValue: assessment.prospectiveIkA,
            allowedLimit:
              assessment.descriptor?.breakingCapacityKA !== undefined
                ? assessment.descriptor.breakingCapacityKA * 1000
                : null,
            unit: 'A',
            message: `Abschaltbedingung auf Leitung ${cable.edgeId} nicht erfüllt: ${assessment.reason}`,
            autoFixRemedy:
              assessment.verdict === 'breaking-capacity-fail'
                ? 'Schutzorgan mit höherem Bemessungs-Abschaltvermögen (z. B. 10 kA) einsetzen oder Einbauort näher an die Einspeisung legen.'
                : 'Leitungslänge verkürzen, Querschnitt erhöhen (senkt Z_s) oder Schutzorgan mit kleinerem I_n/Charakteristik B wählen.',
          })
        );
        continue;
      }
      if (assessment.verdict === 'ok-with-assumption' || assessment.verdict === 'rcd-covered') continue;
      events.push(
        auditEvent({
          ruleId,
          entity,
          kind: 'UNVERIFIABLE',
          message: `Abschaltbedingung auf Leitung ${cable.edgeId} nicht entscheidbar (${assessment.verdict}): ${assessment.reason}`,
          autoFixRemedy:
            assessment.limitation === 'breaking-capacity-reach'
              ? 'Mit dem Versorgungsnetzbetreiber abgestimmten Messwert (prospektiver Kurzschlussstrom) eintragen.'
              : 'Länge, Querschnitt und Schutzorgan-Datenblatt (Charakteristik, I_cn) der 230-V-Leitung vollständig eintragen.',
        })
      );
    }
  }

  for (const cable of withoutDevice) {
    events.push(
      auditEvent({
        ruleId,
        entity: { kind: 'edge', id: cable.edgeId },
        kind: 'UNVERIFIABLE',
        message: `230-V-Leitung ${cable.edgeId}: kein Schutzorgan deklariert — die Abschaltbedingung (Z_s · I_a ≤ U_0) ist nicht prüfbar.`,
        autoFixRemedy:
          'Schutzorgan der Leitung angeben (Feld `fuseSize`/`acProtection` mit Charakteristik und Bemessungs-Abschaltvermögen).',
      })
    );
  }

  return checkOrNotApplicable(ruleId, events, evaluated);
}

function prospectiveIkOf(data: Record<string, unknown> | undefined): number | undefined {
  const values = [data?.prospectiveIkA, data?.acCurrentA];
  const first = values.find((value) => typeof value === 'number' && Number.isFinite(value) && value > 0);
  return typeof first === 'number' ? first : undefined;
}

// ============================================================================
// RCD-006 — Selektivität der FI-Kaskade
// ============================================================================

export function checkRcdSelectivity(context: PassContext): CheckResult {
  const ruleId = 'RCD-006-rcd-selectivity' as const;
  const portGraph = buildPortGraph(context.graph);
  const events: AuditEvent[] = [];
  let evaluated = 0;

  for (const cable of sortedCables(context.graph)) {
    if (cable.domain !== 'AC_LV') continue;
    const downstreamRcds = cable.protections.filter(isRcdPlacement);
    if (downstreamRcds.length === 0) continue;

    const chain = upstreamChain(context.graph, portGraph, cable);
    const upstreamRcds = chain.devices
      .map((entry) => entry.placement)
      .filter(isRcdPlacement)
      .sort((a, b) => b.device.ratedResidualCurrentA - a.device.ratedResidualCurrentA);
    const upstream = upstreamRcds[0];
    if (!upstream) continue;

    for (const downstream of downstreamRcds) {
      evaluated += 1;
      const ratio = upstream.device.ratedResidualCurrentA / downstream.device.ratedResidualCurrentA;
      if (upstream.device.selective === true || ratio >= RCD_SELECTIVITY_RATIO_HEURISTIC) continue;
      events.push(
        auditEvent({
          ruleId,
          entity: { kind: 'edge', id: cable.edgeId },
          severity: 'CODE_VIOLATION',
          calculatedValue: ratio,
          allowedLimit: RCD_SELECTIVITY_RATIO_HEURISTIC,
          message: `FI-Kaskade auf Leitung ${cable.edgeId}: vorgelagerter FI (${(upstream.device.ratedResidualCurrentA * 1000).toFixed(0)} mA) und nachgelagerter FI (${(downstream.device.ratedResidualCurrentA * 1000).toFixed(0)} mA) sind nicht selektiv (Verhältnis ${ratio.toFixed(2)}:1, nicht selektiv/zeitverzögert).`,
          autoFixRemedy:
            'Vorgelagerten FI selektiv (Typ S, zeitverzögert) ausführen oder sein IΔn mindestens verdreifachen — oder Herstellerangaben zur Selektivität des Paares nachweisen.',
        })
      );
    }
  }

  // Weniger als zwei FI in Reihe: Regel hat keine Eingabe.
  return checkOrNotApplicable(ruleId, events, evaluated);
}

// ============================================================================
// GND-001 — Querschnitt der Masseanbindung
// ============================================================================

export function checkChassisBond(context: PassContext): CheckResult {
  const ruleId = 'GND-001-chassis-bond-cross-section' as const;
  const groundNodes = new Set(
    [...context.graph.components.values()]
      .filter((component) => component.behavior.kind === 'REFERENCE')
      .map((component) => component.nodeId)
  );
  if (groundNodes.size === 0) return passedCheck(ruleId, 0);

  const events: AuditEvent[] = [];
  let evaluated = 0;
  for (const cable of sortedCables(context.graph)) {
    if (!groundNodes.has(cable.from.nodeId) && !groundNodes.has(cable.to.nodeId)) continue;
    evaluated += 1;
    const entity = { kind: 'edge' as const, id: cable.edgeId };
    const label = `${labelOfNode(context.graph, cable.from.nodeId)} → ${labelOfNode(context.graph, cable.to.nodeId)}`;
    if (cable.crossSectionMm2 === null) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          kind: 'UNVERIFIABLE',
          message: `Masseanbindung ${label}: Querschnitt fehlt — die Mindestanbindung ist nicht belegt.`,
          autoFixRemedy: `Querschnitt der Masseleitung auf mindestens ${CHASSIS_BOND_MIN_MM2} mm² setzen und eintragen.`,
        })
      );
      continue;
    }
    if (cable.crossSectionMm2 < CHASSIS_BOND_MIN_MM2 - 1e-9) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          severity: 'CODE_VIOLATION',
          calculatedValue: cable.crossSectionMm2,
          allowedLimit: CHASSIS_BOND_MIN_MM2,
          unit: 'mm²',
          message: `Masseanbindung ${label}: ${cable.crossSectionMm2} mm² liegt unter der Planungsvorgabe von ${CHASSIS_BOND_MIN_MM2} mm².`,
          autoFixRemedy: `Querschnitt der Masseleitung von ${cable.crossSectionMm2} mm² auf ${CHASSIS_BOND_MIN_MM2} mm² erhöhen (Karosserieanbindung).`,
        })
      );
    }
  }

  return checkOrNotApplicable(ruleId, events, evaluated);
}

// ============================================================================
// NET-001 — kein PEN in der Fahrzeuginstallation
// ============================================================================

export function checkPenForbidden(context: PassContext): CheckResult {
  const ruleId = 'NET-001-pen-forbidden' as const;
  const shoreEntries = [...context.graph.components.values()]
    .filter((component) => component.behavior.kind === 'SOURCE' && component.behavior.carrier === 'ac')
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  if (shoreEntries.length === 0) return passedCheck(ruleId, 0);

  const events: AuditEvent[] = [];
  let evaluated = 0;
  for (const entry of shoreEntries) {
    evaluated += 1;
    const entity = { kind: 'node' as const, id: entry.nodeId };
    const label = labelOfNode(context.graph, entry.nodeId);
    const form = entry.behavior.kind === 'SOURCE' ? (entry.behavior.declaredSystemForm ?? null) : null;
    if (form === 'TN-C') {
      events.push(
        auditEvent({
          ruleId,
          entity,
          severity: 'CRITICAL_SAFETY',
          message: `Einspeisung ${label}: Netzform TN-C deklariert — die Anlage würde über einen PEN-Leiter versorgt, der in Caravan/Motorcaravan unzulässig ist.`,
          autoFixRemedy:
            'Einspeisung als TN-S ausführen (N und PE getrennt bis zur Einspeisestelle) und den Stromkreisverteiler entsprechend aufbauen.',
        })
      );
      continue;
    }
    if (form !== 'TN-S') {
      events.push(
        auditEvent({
          ruleId,
          entity,
          kind: 'UNVERIFIABLE',
          message: `Einspeisung ${label}: Netzform ${form ?? '(nicht deklariert)'} — die geforderte TN-S-Ausführung ohne PEN ist nicht belegt.`,
          autoFixRemedy:
            'Netzform der Einspeisung als TN-S im Bauteil deklarieren (Feld `systemForm`) oder die PEN-Freiheit projektseitig nachweisen.',
        })
      );
    }
  }

  return checkOrNotApplicable(ruleId, events, evaluated);
}

// ============================================================================
// NET-002 — Fehlerschleife der Insel
// ============================================================================

export function checkIslandFaultLoop(context: PassContext): CheckResult {
  const ruleId = 'NET-002-island-fault-loop' as const;
  const inverters = [...context.graph.components.values()]
    .filter(
      (component) => component.behavior.kind === 'CONVERTER' && component.behavior.outputDomain === 'AC_LV'
    )
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  if (inverters.length === 0) return passedCheck(ruleId, 0);

  const portGraph = buildPortGraph(context.graph);
  const loads = new Set(acLoadNodes(context));
  const events: AuditEvent[] = [];
  let evaluated = 0;

  for (const inverter of inverters) {
    const ports = inverter.ports.filter((port) => port.domain === 'AC_LV');
    if (ports.length === 0) continue;
    const walks = acWalk(context, portGraph, ports);
    const islandLoads = [
      ...new Set(walks.map((entry) => entry.nodeId).filter((nodeId) => loads.has(nodeId))),
    ];
    if (islandLoads.length < 2) continue;
    evaluated += 1;

    const behavior = inverter.behavior;
    if (behavior.kind !== 'CONVERTER') continue;
    const bond = behavior.neutralEarthBond ?? null;
    const entity = { kind: 'node' as const, id: inverter.nodeId };
    const label = labelOfNode(context.graph, inverter.nodeId);

    if (bond === null) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          kind: 'UNVERIFIABLE',
          message: `Insel ${label}: ${islandLoads.length} Verbraucher, aber kein N-PE-Erdungsschlüssel im Plan — ob ein Fehlerstrom überhaupt zurückfließen kann, ist nicht entscheidbar.`,
          autoFixRemedy: `Datenblattangabe des ${label} zum N-PE-Bezug eintragen (Feld „neutralEarthBond“ = always/dynamic/never) — ohne sie ist kein Fehlerschutz nachweisbar.`,
        })
      );
      continue;
    }

    const hasRcd = behavior.hasIntegratedRcd === true || islandHasRcd(context, portGraph, ports);
    if (bond === 'never') {
      events.push(
        auditEvent({
          ruleId,
          entity,
          severity: 'CRITICAL_SAFETY',
          message: `Insel ${label}: N-PE-Bezug ausdrücklich „never“ bei ${islandLoads.length} Verbrauchern — im Fehlerfall entsteht kein geschlossener Fehlerstromkreis, ein FI kann nicht auslösen.`,
          autoFixRemedy: hasRcd
            ? `N-PE-Bezug des ${label} gemäß Datenblatt aktivieren (Schlüsselbrücke/Relais) ODER jeden Verbraucher über Trenntrafo/Schutztrennung versorgen.`
            : `N-PE-Bezug des ${label} gemäß Datenblatt aktivieren UND einen FI ≤ 30 mA (Typ B bei glatten Gleichfehlerströmen) in jedem Ausgangsstromkreis vorsehen.`,
        })
      );
      continue;
    }

    if (!hasRcd) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          severity: 'CRITICAL_SAFETY',
          message: `Insel ${label}: N-PE-Bezug „${bond}“ vorhanden, aber kein FI ≤ 30 mA im Inselnetz — der Fehlerschutz ist nicht vollständig.`,
          autoFixRemedy: `${label}-Ausgang mit FI/LS (30 mA, Typ B bei glatten Gleichfehlerströmen) ausführen bzw. einen vorhandenen integrierten FI im Plan deklarieren (Feld „hasRcd“).`,
        })
      );
    }
  }

  return checkOrNotApplicable(ruleId, events, evaluated);
}

/** FI im erreichbaren Inselbereich (Kabel-FIs) oder integrierter FI. */
function islandHasRcd(context: PassContext, portGraph: PortGraph, ports: readonly PortRef[]): boolean {
  const walks = acWalk(context, portGraph, ports);
  for (const entry of walks) {
    if (entry.rcdResidualCurrentsA.length > 0) return true;
    for (const edge of portGraph.adjacency.get(entry.portKey) ?? []) {
      if (edge.kind !== 'cable' || !edge.cableId) continue;
      const cable = context.graph.cableById.get(edge.cableId);
      if (!cable || cable.domain !== 'AC_LV') continue;
      if (cable.protections.some((placement) => isRcd(placement.device))) return true;
    }
  }
  return false;
}

// ============================================================================
// PASS 5
// ============================================================================

/** Alle Prüfungen des Passes 5 in Prüfreihenfolge. */
export function runPass5(context: PassContext): CheckResult[] {
  return [
    checkChassisBond(context),
    checkRcdCoverage(context),
    checkRcdType(context),
    checkRcdPosition(context),
    checkTwoPoleSwitching(context),
    checkLoopImpedance(context),
    checkRcdSelectivity(context),
    checkPenForbidden(context),
    checkIslandFaultLoop(context),
  ];
}
