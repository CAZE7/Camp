/**
 * lib/verify/powerPath.ts — PASS 4: Spannungsfall über Leitung und Pfad,
 * Energiebilanz.
 *
 * Die Rechnung selbst steht in `physics.ts` (ΔU = k·L·I_b·ρ(T)/A). Dieser Pass
 * beantwortet die zwei Fragen, die daraus folgen:
 *
 *   1. VDR-001: Hält EINE Leitung das Budget der Lastklasse ihres Verbrauchers?
 *   2. VDR-002: Hält der PFAD von der Quelle zum Verbraucher das Budget?
 *   3. PWR-001: Deckt die Peukert-gewichtete nutzbare Kapazität den Tagesbedarf?
 *
 * Der Pfadwert läuft auf dem Port-Graphen (Dijkstra über die ΔU-Gewichte),
 * damit ein Verbraucher niemals »durch eine Last hindurch« erreicht wird. Als
 * Quellen eines Segments gelten Energiequellen UND Wandlerausgänge: Der
 * Wechselrichter/Ladegerät bildet ein eigenes Segment, und die Suche läuft an
 * seinem Ausgangsport weiter (er ist im Port-Graphen keine Durchführung).
 *
 * Pfadregel ohne stille Annahme: Hat ein Kabel auf dem günstigsten Weg keine
 * Länge/keinen Querschnitt/keinen Strom, wird der Verbraucher UNPROVABLE — es
 * wird NICHT mit 0 m oder einem Tabellen-Ersatzwert »weitergerechnet«.
 */

import type { PassContext } from './context';
import { auditEvent, checkOrNotApplicable, passedCheck } from './events';
import { behaviorOf, labelOfNode } from './graph';
import { usableCapacityWithPeukertAh, peukertExponentOf } from '../peukert';
import {
  voltageDropBudgetPercent,
  voltageDropPercent,
  voltageDropVolts,
  VOLTAGE_DROP_PCT_ALARM,
} from './physics';
import { buildPortGraph, type PortGraph } from './topology';
import { nominalVoltageOfCable } from './graph';
import { sortedCables } from './pathSearch';
import { VDE_BATTERY_DOD, VDE_DOD_REFERENCE } from '../vde-standards';
import type { AuditEvent, CableModel, CheckResult, LoadClass } from './types';

/** Lastklasse des Verbrauchers am Ende einer Leitung (sonst 'standard'). */
function loadClassAt(graph: PassContext['graph'], nodeId: string): LoadClass {
  const behavior = behaviorOf(graph, nodeId);
  return behavior.kind === 'LOAD' ? behavior.loadClass : 'standard';
}

/** Grenze, ab der der Spannungsfall zusätzlich als sicherheitskritisch gilt. */
export const VOLTAGE_DROP_CRITICAL_PERCENT = VOLTAGE_DROP_PCT_ALARM;

function severityForDrop(percent: number): 'CODE_VIOLATION' | 'CRITICAL_SAFETY' {
  return percent > VOLTAGE_DROP_CRITICAL_PERCENT ? 'CRITICAL_SAFETY' : 'CODE_VIOLATION';
}

function remedyForDrop(
  percent: number,
  budget: number,
  crossSectionMm2: number | null,
  currentA: number | null,
  lengthM: number | null
): string {
  const neededFactor = percent / budget;
  const parts: string[] = [];
  if (crossSectionMm2 !== null && neededFactor > 1) {
    const target = crossSectionMm2 * neededFactor;
    parts.push(
      `Querschnitt ${crossSectionMm2} mm² → mindestens ${Math.ceil(target * 10) / 10} mm² (nächster Normquerschnitt)`
    );
  } else {
    parts.push('Querschnitt erhöhen');
  }
  if (lengthM !== null && lengthM > 0) parts.push(`Leitungsweg verkürzen (aktuell ${lengthM.toFixed(2)} m)`);
  if (currentA !== null) parts.push(`Betriebsstrom senken (aktuell ${currentA.toFixed(1)} A)`);
  return `${parts.join(' ODER ')}.`;
}

function dropOfCable(
  context: PassContext,
  cable: CableModel
): { dropV: number; percent: number; nominalV: number } | null {
  if (cable.lengthM === null || cable.crossSectionMm2 === null || cable.currentA === null) return null;
  const nominalV = nominalVoltageOfCable(cable, context.graph.systemVoltageV);
  const dropV = voltageDropVolts({
    lengthM: cable.lengthM,
    crossSectionMm2: cable.crossSectionMm2,
    currentA: cable.currentA,
    temperatureC: context.options.voltageDropTemperatureC,
    currentPathFactor: 2,
  });
  return { dropV, percent: voltageDropPercent(dropV, nominalV), nominalV };
}

/** Erste fehlende Größe einer Leitung als Klartext (für UNPROVABLE-Meldungen). */
function missingDatum(cable: CableModel): string {
  const missing: string[] = [];
  if (cable.lengthM === null) missing.push('Länge');
  if (cable.crossSectionMm2 === null) missing.push('Querschnitt');
  if (cable.currentA === null) missing.push('Betriebsstrom');
  return missing.join(', ');
}

// ============================================================================
// VDR-001 — Spannungsfall einer Leitung
// ============================================================================

export function checkVoltageDropEdge(context: PassContext): CheckResult {
  const ruleId = 'VDR-001-voltage-drop-edge' as const;
  const events: AuditEvent[] = [];
  let evaluated = 0;
  const dcLoadCables = sortedCables(context.graph).filter(
    (cable) =>
      (cable.carrier === 'dc' || cable.carrier === 'solar') &&
      behaviorOf(context.graph, cable.to.nodeId).kind === 'LOAD'
  );
  if (dcLoadCables.length === 0) {
    // Ohne DC-Verbraucher gibt es kein DC-Spannungsfallbudget zu prüfen.
    return passedCheck(ruleId, 0);
  }

  for (const cable of dcLoadCables) {
    const entity = { kind: 'edge' as const, id: cable.edgeId };
    const label = `${labelOfNode(context.graph, cable.from.nodeId)} → ${labelOfNode(context.graph, cable.to.nodeId)}`;
    const drop = dropOfCable(context, cable);
    if (drop === null) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          kind: 'UNVERIFIABLE',
          message: `Leitung ${label}: ${missingDatum(cable)} fehlt — der Spannungsfall ist nicht bestimmbar.`,
          autoFixRemedy:
            'Länge (m), Querschnitt (mm²) und Leistung/Strom des Verbrauchers eintragen, damit ΔU = 2·L·I_b·ρ(T)/A gerechnet werden kann.',
        })
      );
      continue;
    }

    evaluated += 1;
    const loadClass = loadClassAt(context.graph, cable.to.nodeId);
    const budget = voltageDropBudgetPercent(loadClass);
    if (drop.percent > budget + 1e-9) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          severity: severityForDrop(drop.percent),
          calculatedValue: drop.percent,
          allowedLimit: budget,
          unit: '%',
          message: `Leitung ${label}: ΔU = ${drop.percent.toFixed(2)} % (${drop.dropV.toFixed(2)} V von ${drop.nominalV} V) überschreitet das Budget ${budget} % der Lastklasse „${loadClass}“${cable.lengthIsAssumption ? ' — die Länge ist eine Planungsannahme' : ''}.`,
          autoFixRemedy: remedyForDrop(
            drop.percent,
            budget,
            cable.crossSectionMm2,
            cable.currentA,
            cable.lengthM
          ),
        })
      );
    }
  }

  return checkOrNotApplicable(ruleId, events, evaluated);
}

// ============================================================================
// VDR-002 — Spannungsfall über den Gesamtpfad (Dijkstra)
// ============================================================================

interface PathStep {
  cable: CableModel;
  dropPercent: number;
}

interface PathResult {
  steps: readonly PathStep[];
  totalPercent: number;
}

/**
 * Günstigster Pfad (kleinster ΔU) von irgendeinem Segmentursprung zu einem
 * Ziel-Port. Nur Leitungen mit vollständigen Daten sind traversierbar — ein
 * Kabel mit Datenlücke macht den Pfad UNPROVABLE, nicht »kurz«.
 */
function bestPathTo(context: PassContext, portGraph: PortGraph, targetPortKey: string): PathResult | null {
  // Versorgungspfad = PLUSpotential von der Quelle/Umrichterausgang bis zur
  // Last. Der Rückweg steckt im Round-Trip-Faktor 2 von `dropOfCable` — ein
  // Pfad über Minus-/Masseleitungen würde ihn doppelt zählen und die Summe
  // zudem kleiner rechnen (Minusleitung ohne Laststromabfall am Gerät).
  const sources = new Set<string>();
  for (const component of context.graph.components.values()) {
    if (component.behavior.kind === 'SOURCE' || component.behavior.kind === 'CONVERTER') {
      for (const port of component.ports) {
        if (port.polarity === 'positive') sources.add(port.key);
      }
    }
  }

  const best = new Map<string, number>();
  // Auch bauteilinterne Durchführungen (kind 'series') werden als Schritt
  // festgehalten, damit die Rückverfolgung den GESAMTEN Pfad rekonstruiert und
  // nicht am ersten Zwischenknoten abbricht.
  const previous = new Map<string, { from: string; cable: CableModel | null; percent: number }>();
  const done = new Set<string>();
  const frontier: Array<{ key: string; cost: number }> = [];
  for (const key of [...sources].sort()) {
    best.set(key, 0);
    frontier.push({ key, cost: 0 });
  }

  while (frontier.length > 0) {
    frontier.sort((a, b) => (a.cost === b.cost ? a.key.localeCompare(b.key) : a.cost - b.cost));
    const current = frontier.shift();
    if (!current || done.has(current.key)) continue;
    done.add(current.key);
    if (current.key === targetPortKey) break;

    for (const edge of portGraph.adjacency.get(current.key) ?? []) {
      let nextKey: string;
      let added = 0;
      let usedCable: CableModel | null = null;
      if (edge.kind === 'series') {
        nextKey = edge.to;
      } else {
        if (!edge.cableId) continue;
        const cable = context.graph.cableById.get(edge.cableId);
        if (!cable) continue;
        if (cable.carrier !== 'dc' && cable.carrier !== 'solar') continue;
        if (cable.from.polarity !== 'positive' || cable.to.polarity !== 'positive') continue;
        const drop = dropOfCable(context, cable);
        if (drop === null) continue; // Datenlücke: Kante ist nicht traversierbar
        nextKey = edge.to;
        added = drop.percent;
        usedCable = cable;
      }
      if (done.has(nextKey)) continue;
      const candidate = current.cost + added;
      const known = best.get(nextKey);
      if (known === undefined || candidate < known - 1e-12) {
        best.set(nextKey, candidate);
        previous.set(nextKey, { from: current.key, cable: usedCable, percent: added });
        frontier.push({ key: nextKey, cost: candidate });
      }
    }
  }

  if (!best.has(targetPortKey)) return null;
  const steps: PathStep[] = [];
  let cursor = targetPortKey;
  while (previous.has(cursor)) {
    const step = previous.get(cursor);
    if (!step) break;
    if (step.cable) steps.unshift({ cable: step.cable, dropPercent: step.percent });
    cursor = step.from;
  }
  return { steps, totalPercent: best.get(targetPortKey) ?? 0 };
}

export function checkVoltageDropPath(context: PassContext): CheckResult {
  const ruleId = 'VDR-002-voltage-drop-path' as const;
  const events: AuditEvent[] = [];
  let evaluated = 0;
  const portGraph = buildPortGraph(context.graph);

  // Nur DC-/Solar-Verbraucher: Das ΔU-Budget dieses Modells ist eine
  // DC-Auslegungsvorgabe; die 230-V-Seite hat eigene Regeln (RCD-005).
  const loads = [...context.graph.components.values()]
    .filter((component) => component.behavior.kind === 'LOAD')
    .filter((component) => component.ports.some((port) => port.domain === 'DC_ELV'))
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  if (loads.length === 0) return passedCheck(ruleId, 0);

  for (const load of loads) {
    const entity = { kind: 'node' as const, id: load.nodeId };
    const label = labelOfNode(context.graph, load.nodeId);
    const targetPorts = [...load.ports]
      .filter((port) => port.domain === 'DC_ELV' && port.polarity === 'positive')
      .sort((a, b) => a.key.localeCompare(b.key));
    if (targetPorts.length === 0) continue;

    let best: PathResult | null = null;
    for (const port of targetPorts) {
      const candidate = bestPathTo(context, portGraph, port.key);
      if (!candidate) continue;
      if (!best || candidate.totalPercent < best.totalPercent) best = candidate;
    }

    if (!best) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          kind: 'UNVERIFIABLE',
          message: `Verbraucher ${label}: kein vollständig bekannter Versorgungspfad — mindestens eine Leitung auf dem Weg hat keine Länge/keinen Querschnitt/keinen Strom.`,
          autoFixRemedy:
            'Längen und Querschnitte der Leitungen auf dem Weg von der Quelle zum Verbraucher vervollständigen; erst dann ist der kumulierte Spannungsfall prüfbar.',
        })
      );
      continue;
    }

    if (best.steps.length === 0) continue; // Verbraucher sitzt direkt an der Quelle: kein Pfadbudget
    evaluated += 1;
    const loadClass = loadClassAt(context.graph, load.nodeId);
    const budget = voltageDropBudgetPercent(loadClass);
    if (best.totalPercent > budget + 1e-9) {
      const path = [
        labelOfNode(context.graph, best.steps[0]?.cable.from.nodeId ?? load.nodeId),
        ...best.steps.map((step) => labelOfNode(context.graph, step.cable.to.nodeId)),
      ];
      events.push(
        auditEvent({
          ruleId,
          entity,
          severity: severityForDrop(best.totalPercent),
          calculatedValue: best.totalPercent,
          allowedLimit: budget,
          unit: '%',
          message: `Verbraucher ${label}: kumulierter Spannungsfall ${best.totalPercent.toFixed(2)} % über ${best.steps.length} Leitung(en) des günstigsten Versorgungspfades überschreitet das Budget ${budget} % (Lastklasse „${loadClass}“).`,
          autoFixRemedy: `Querschnitt auf dem Pfad erhöhen (größte Einzelbeiträge zuerst: ${best.steps
            .slice()
            .sort((a, b) => b.dropPercent - a.dropPercent)
            .map((step) => step.cable.edgeId)
            .join(', ')}) ODER Leitungsweg verkürzen ODER Last reduzieren.`,
          counterexample: path,
        })
      );
    }
  }

  return checkOrNotApplicable(ruleId, events, evaluated);
}

// ============================================================================
// PWR-001 — Energiebilanz (Peukert)
// ============================================================================

export function checkEnergyBalance(context: PassContext): CheckResult {
  const ruleId = 'PWR-001-energy-balance' as const;
  const events: AuditEvent[] = [];
  let evaluated = 0;

  const houseBatteries = [...context.graph.components.values()]
    .filter(
      (component) =>
        component.behavior.kind === 'SOURCE' &&
        component.behavior.carrier === 'dc' &&
        component.behavior.role === 'house-battery'
    )
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId));

  if (houseBatteries.length === 0) {
    const hasLoads = [...context.graph.components.values()].some(
      (component) => component.behavior.kind === 'LOAD'
    );
    if (!hasLoads) return passedCheck(ruleId, 0);
    return checkOrNotApplicable(
      ruleId,
      [
        auditEvent({
          ruleId,
          entity: { kind: 'system', id: 'energy' },
          kind: 'UNVERIFIABLE',
          message:
            'Energiebilanz: Der Plan hat Verbraucher, aber keine Aufbaubatterie (Rolle „house“) — die nutzbare Kapazität ist nicht bestimmbar.',
          autoFixRemedy:
            'Aufbaubatterie mit Rolle „house“, Kapazität (Ah) und Chemie anlegen oder die Verbraucher einer vorhandenen Batterie zuordnen.',
        }),
      ],
      0
    );
  }

  let capacityAh = 0;
  let exponentK = 1;
  let dod = VDE_DOD_REFERENCE;
  let capacityKnown = false;
  for (const battery of houseBatteries) {
    const node = context.nodes.find((entry) => entry.id === battery.nodeId);
    const data = node?.data as Record<string, unknown> | undefined;
    const capacity = typeof data?.capacity === 'number' && data.capacity > 0 ? data.capacity : null;
    if (capacity === null) continue;
    capacityKnown = true;
    capacityAh += capacity;
    const chemistry = typeof data?.chemistry === 'string' ? data.chemistry : 'LiFePO4';
    dod = Math.min(dod, VDE_BATTERY_DOD[chemistry] ?? VDE_DOD_REFERENCE);
    exponentK = Math.max(exponentK, peukertExponentOf(data));
  }

  if (!capacityKnown || capacityAh <= 0) {
    events.push(
      auditEvent({
        ruleId,
        entity: { kind: 'system', id: 'energy' },
        kind: 'UNVERIFIABLE',
        message:
          'Energiebilanz: keine Aufbaubatterie mit Kapazität (Ah) — die nutzbare Kapazität ist nicht bestimmbar.',
        autoFixRemedy:
          'Kapazität (Ah) und Chemie der Aufbaubatterie eintragen; ohne diese Angaben ist der Tagesbedarf nicht gegen die Batterie zu prüfen.',
      })
    );
    return checkOrNotApplicable(ruleId, events, evaluated);
  }

  const loads = [...context.graph.components.values()]
    .filter((component) => component.behavior.kind === 'LOAD')
    .sort((a, b) => a.nodeId.localeCompare(b.nodeId));

  let dailyWh = 0;
  let missing = 0;
  for (const load of loads) {
    const node = context.nodes.find((entry) => entry.id === load.nodeId);
    const data = node?.data as Record<string, unknown> | undefined;
    const watts = typeof data?.watts === 'number' && data.watts > 0 ? data.watts : null;
    const hours = typeof data?.hours === 'number' && data.hours >= 0 ? data.hours : null;
    if (watts === null || hours === null) {
      if (watts !== null || hours !== null) {
        missing += 1;
        events.push(
          auditEvent({
            ruleId,
            entity: { kind: 'node', id: load.nodeId },
            kind: 'UNVERIFIABLE',
            message: `Verbraucher ${labelOfNode(context.graph, load.nodeId)}: Leistung oder Nutzungsdauer (h/Tag) fehlt — der Tagesbedarf ist unvollständig.`,
            autoFixRemedy:
              'Leistung (W) und tägliche Nutzungsdauer (h) eintragen; der Tagesbedarf wird sonst zu klein gerechnet.',
          })
        );
      }
      continue;
    }
    dailyWh += watts * hours;
  }
  dailyWh += context.options.additionalDailyEnergyWh ?? 0;

  evaluated += 1;
  const loadAh = dailyWh / context.graph.systemVoltageV;
  const referenceCurrentA = context.options.energyReferenceCurrentA ?? loadAh / 24;
  const usableAh = usableCapacityWithPeukertAh(capacityAh, dod, referenceCurrentA, exponentK);
  if (usableAh + 1e-9 < loadAh) {
    events.push(
      auditEvent({
        ruleId,
        entity: { kind: 'system', id: 'energy' },
        calculatedValue: loadAh,
        allowedLimit: usableAh,
        unit: 'Ah',
        message: `Energiebilanz: Tagesbedarf ${loadAh.toFixed(1)} Ah (${dailyWh.toFixed(0)} Wh) übersteigt die nutzbare Kapazität ${usableAh.toFixed(1)} Ah (${capacityAh} Ah × DoD ${dod} × Peukert k = ${exponentK.toFixed(2)})${missing > 0 ? ` — ${missing} Verbraucher ohne vollständige Angaben, der Bedarf ist real höher` : ''}.`,
        autoFixRemedy: `Batteriekapazität auf ≥ ${Math.ceil(loadAh / (dod * 0.9))} Ah erhöhen, Verbrauch senken oder Ladung (Solar/Landstrom) in die Bilanz aufnehmen.`,
      })
    );
  }

  return checkOrNotApplicable(ruleId, events, evaluated);
}

/** Alle Prüfungen des Passes 4 in Prüfreihenfolge. */
export function runPass4(context: PassContext): CheckResult[] {
  return [checkVoltageDropEdge(context), checkVoltageDropPath(context), checkEnergyBalance(context)];
}
