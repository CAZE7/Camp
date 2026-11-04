/**
 * lib/autoWire/designBudget.ts — BMS ALS DESIGN-CONSTRAINT, NICHT ALS WARNUNG.
 *
 * P0 / V2-BMS-002 (Review 2026-11): `computeCurrentBudget()` und die
 * Batteriebank-Modellierung existierten bereits, aber `sizeDcEdges`/
 * `applyFuseSizes` dimensionierten ausschließlich gegen den LASTSTROM
 * (`modelCurrentOf`). Das Ergebnis war ein Plan, der „passendes Kabel +
 * passende Sicherung“ zeigte, obwohl die Batterie die Last gar nicht liefern
 * kann: 12,8 V, 50-A-BMS, 1500-W-Wechselrichter ⇒ ≈117 A idealisiert
 * (≈147 A im Strommodell mit η und Entladeschlussspannung).
 *
 * WICHTIG — was hier bewusst NICHT passiert: Der Laststrom wird **nicht** auf
 * das BMS-Budget gekappt. Ein Kabel für 50 A zu dimensionieren, während
 * 147 A fließen, wäre gefährlicher als die bisherige Warnung. Die
 * Dimensionierung bleibt physikalisch (`modelCurrentOf`); das BMS wird als
 * EIGENE, gleichrangige Grenze in `computeCurrentBudget` aufgenommen und das
 * Ergebnis wird als KRITISCHER KONFLIKT in den AutoWire-Report geschrieben.
 * Damit landet es vor dem Anwenden im Review-Dialog und danach über
 * `autoWireWarnings` als kritische Warnung im Release-Gate.
 *
 * Die Meldung trennt ausdrücklich vier Aussagen, die früher zu einer
 * „geeigneten Dimensionierung“ vermischt wurden:
 *
 * ```text
 * Kabel kann die Last tragen?        I_b ≤ I_z(verlegt)
 * Sicherung ist passend?             I_b ≤ I_n
 * Batterie kann die Last liefern?    I_b ≤ I_BMS,Entladung
 * Gesamtsystem ist geeignet?         I_b ≤ min(aller bekannten Grenzen)
 * ```
 *
 * Fehlende Grenzen werden NICHT erfunden (Regel M): ohne BMS-Angabe ist die
 * Versorgung „nicht bewertbar“ und wird als offene Frage gemeldet.
 */

import { deriveBatteryBanks, primaryHouseBank } from '../electricalGraph/batteryBank';
import {
  computeCurrentBudget,
  evaluateLoadFeasibility,
  CURRENT_LIMIT_LABEL,
  type CurrentBudget,
  type CurrentLimits,
  type LoadFeasibility,
} from '../electricalGraph/currentBudget';
import { resolveComponentConstraints } from '../electricalGraph/constraints';
import { computeCableCurrents } from '../electricalGraph/currentFlow';
import { designAmpacity } from '../electrical';
import { amps, type Amps, type Volts } from '../units';
import type { Node } from '../domain/graph';
import { MAX_CROSS_SECTION, type CableEdge } from './primitives';
import type { ConflictCollector } from './conflicts';

/** Regel-IDs des Design-Budgets — stabil für Tests und Warnzentrale. */
export const DESIGN_BUDGET_RULES = {
  missingBms: 'AUTO-BMS-000',
  exceeded: 'AUTO-BMS-001',
  headroom: 'AUTO-BMS-002',
  otherLimit: 'AUTO-BUDGET-001',
} as const;

export type DesignBudgetAssessment = 'ok' | 'warning' | 'critical' | 'not-assessable';

export interface DesignBudgetVerdict {
  /** Bank, gegen die bewertet wurde (`undefined` = keine Aufbaubank bekannt). */
  bankId?: string;
  batteryIds: readonly string[];
  /** Benötigter Dauer-ENTLADEstrom der Bank in A (aus dem EINEN Strommodell). */
  requiredCurrent: Amps;
  /** Alle bekannten Grenzen — `limitedBy` nennt die kleinste. */
  budget: CurrentBudget;
  feasibility: LoadFeasibility;
  assessment: DesignBudgetAssessment;
  bmsLimit?: Amps;
  cableLimit?: Amps;
  fuseLimit?: Amps;
  componentLimit?: Amps;
  systemLimit?: Amps;
  /** Je `undefined`, wenn die Grenze nicht bewertbar ist — nie geraten. */
  cableCanCarry?: boolean;
  fuseSuitable?: boolean;
  batteryCanSupply?: boolean;
  /** Datenlücken, die eine Bewertung verhindern (Klartext). */
  notAssessable: readonly string[];
  /** Konkrete Lösungswege statt einer abstrakten Warnung. */
  remedies: readonly string[];
  /** Batterie-Plus-Leitungen, auf denen der Bedarf gemessen wurde. */
  edgeIds: readonly string[];
  /** Lastknoten (v. a. Wechselrichter), die den Bedarf verursachen. */
  loadNodeIds: readonly string[];
}

/** Ist die Kante eine DC-Plus-Leitung eines Mitglieds der Aufbaubank? */
const isBatteryPlusEdge = (edge: CableEdge, batteryIds: ReadonlySet<string>): boolean => {
  if (edge.data?.edgeDomain === 'AC_230V' || edge.data?.edgeDomain === 'Solar') return false;
  return (
    (batteryIds.has(edge.source) && (edge.sourceHandle?.includes('plus') ?? false)) ||
    (batteryIds.has(edge.target) && (edge.targetHandle?.includes('plus') ?? false))
  );
};

const finitePositive = (value: unknown): number | undefined => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
};

/** Kleinster Wert einer Liste; `undefined` bei leerer Liste (kein Ersatzwert). */
const minOf = (values: readonly number[]): Amps | undefined =>
  values.length > 0 ? amps(Math.min(...values)) : undefined;

/**
 * Bewertet den dimensionierten Plan gegen das kleinste bekannte Strombudget.
 * Rein: keine Mutation an `nodes`/`edges`, keine UI, kein Store.
 */
export function evaluateDesignBudget(
  nodes: readonly Node[],
  edges: readonly CableEdge[],
  sysVoltage: Volts,
  houseBatteryId?: string
): DesignBudgetVerdict {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const bankModel = deriveBatteryBanks(nodes, sysVoltage);
  const bank =
    (houseBatteryId
      ? bankModel.banks.find(
          (candidate) => candidate.role === 'house' && candidate.batteryIds.includes(houseBatteryId)
        )
      : undefined) ?? primaryHouseBank(bankModel);
  const batteryIds = bank?.batteryIds ?? [];
  const batteryIdSet = new Set<string>(batteryIds);
  const plusEdges =
    batteryIdSet.size > 0 ? edges.filter((edge) => isBatteryPlusEdge(edge, batteryIdSet)) : [];

  // EINE Stromquelle: dasselbe Topologie-Modell wie Sizing, Anzeige und
  // Live-Validierung. Beiträge mit role 'load' sind Entladung; 'source'
  // (Ladegeräte) zählen NICHT gegen die Entladegrenze.
  // Bewusst die reine Variante ohne Render-Cache: AutoWire mutiert dieselbe
  // `edges`-Referenz noch während des Laufs; ein WeakMap-Treffer aus einem
  // Zwischenzustand würde `sizeDcEdges` (G7-Idempotenz) verfälschen.
  const currentModel = computeCableCurrents({ nodes, edges, systemVoltageV: sysVoltage });
  let required = 0;
  let modeled = false;
  const loadNodeIds = new Set<string>();
  for (const edge of plusEdges) {
    const entry = currentModel.byEdgeId.get(edge.id);
    if (!entry) continue;
    modeled = true;
    const contributions = entry.contributingLoads ?? [];
    if (contributions.length > 0) {
      for (const contribution of contributions) {
        if (contribution.role !== 'load') continue;
        required += contribution.contribution;
        loadNodeIds.add(contribution.componentId);
      }
    } else if (batteryIdSet.has(edge.source) && (edge.sourceHandle?.includes('plus') ?? false)) {
      // Fallback nur ohne Beitragsliste (z. B. expliziter totalAmps):
      // Richtung wie in der Live-Validierung, keine erfundene Zahl.
      required += entry.operatingCurrent ?? 0;
    }
  }
  const requiredCurrent = amps(required);

  const crossSections = plusEdges
    .map((edge) => finitePositive(edge.data?.crossSection))
    .filter((value): value is number => value !== undefined);
  const cableLimits = crossSections.map((cs) => designAmpacity(cs)).filter((value) => value > 0);
  const cableLimit = minOf(cableLimits);
  const fuseLimit = minOf(
    plusEdges
      .map((edge) => finitePositive(edge.data?.fuseSize))
      .filter((value): value is number => value !== undefined)
  );

  // Bauteilgrenzen der direkt an den Batterie-Plus-Leitungen liegenden
  // Verteilorgane (Sammelschiene etc.). Batterie und Wechselrichter sind
  // hier Quelle bzw. Last, keine Durchgangsgrenze.
  const componentCandidates: number[] = [];
  for (const edge of plusEdges) {
    for (const id of [edge.source, edge.target]) {
      const node = nodeMap.get(id);
      if (!node || node.type === 'battery' || node.type === 'inverter') continue;
      const continuous = resolveComponentConstraints(node).continuousCurrent;
      if (continuous !== undefined && continuous > 0) componentCandidates.push(continuous);
    }
  }
  const componentLimit = minOf(componentCandidates);
  const systemLimit = amps(designAmpacity(MAX_CROSS_SECTION)); // Modellgrenze 70 mm²

  const bmsLimit = bank?.maxDischargeCurrent;
  const limits: CurrentLimits = {
    ...(bmsLimit !== undefined ? { bms: bmsLimit } : {}),
    ...(componentLimit !== undefined ? { component: componentLimit } : {}),
    ...(fuseLimit !== undefined ? { fuse: fuseLimit } : {}),
    ...(cableLimit !== undefined ? { cable: cableLimit } : {}),
    system: systemLimit,
  };
  const budget = computeCurrentBudget(limits);
  const subject = bank
    ? `Die Aufbaubatterie-Bank „${bank.id}“ (Entladung)`
    : 'Die Aufbaubatterie (Entladung)';
  const feasibility = evaluateLoadFeasibility(requiredCurrent, budget, subject);

  const notAssessable: string[] = [];
  if (!modeled) notAssessable.push('Für die Batterie-Plus-Leitungen liegt kein Strommodell vor.');
  if (bmsLimit === undefined)
    notAssessable.push(
      'Am Akku ist kein BMS-Dauerentladestrom eingetragen — die Lieferfähigkeit der Batterie ist nicht bewertbar.'
    );
  if (cableLimit === undefined)
    notAssessable.push('Kein dimensionierter Querschnitt an den Batterie-Plus-Leitungen.');
  if (fuseLimit === undefined)
    notAssessable.push('Keine Sicherung an den Batterie-Plus-Leitungen eingetragen.');

  const remedies: string[] = [];
  if (feasibility.limitedBy === 'bms') {
    remedies.push(
      'Batteriebank mit höherem zulässigem Dauerentladestrom wählen oder weitere parallelschaltbare Akkus ergänzen.'
    );
    remedies.push(
      'Wechselrichter mit geringerer Dauerleistung einsetzen oder die gleichzeitige 230-V-Last reduzieren.'
    );
    remedies.push('BMS-Grenzwert am Akku gegen das Datenblatt prüfen (Feld „BMS Dauerentladung").');
  } else if (feasibility.limitedBy !== 'unknown') {
    remedies.push(
      `Die kleinste Grenze ist ${CURRENT_LIMIT_LABEL[feasibility.limitedBy]}: Querschnitt, Sicherung und Verteilung auf diesen Strom auslegen oder die Last reduzieren.`
    );
  }

  return {
    ...(bank ? { bankId: bank.id } : {}),
    batteryIds,
    requiredCurrent,
    budget,
    feasibility,
    assessment:
      notAssessable.length > 0 && !feasibility.feasible
        ? 'critical'
        : notAssessable.length > 0
          ? 'not-assessable'
          : feasibility.severity === 'critical'
            ? 'critical'
            : feasibility.severity === 'warning'
              ? 'warning'
              : 'ok',
    ...(bmsLimit !== undefined ? { bmsLimit } : {}),
    ...(cableLimit !== undefined ? { cableLimit } : {}),
    ...(fuseLimit !== undefined ? { fuseLimit } : {}),
    ...(componentLimit !== undefined ? { componentLimit } : {}),
    systemLimit,
    ...(cableLimit !== undefined ? { cableCanCarry: required <= cableLimit } : {}),
    ...(fuseLimit !== undefined ? { fuseSuitable: required <= fuseLimit } : {}),
    ...(bmsLimit !== undefined ? { batteryCanSupply: required <= bmsLimit } : {}),
    notAssessable,
    remedies,
    edgeIds: plusEdges.map((edge) => edge.id),
    loadNodeIds: [...loadNodeIds].sort(),
  };
}

/**
 * Meldet das Budget-Ergebnis an den AutoWire-Report. Kritische Befunde
 * blockieren über `hasCriticalConflict` bzw. die Warnzentrale die Freigabe;
 * sie werden NICHT durch Still-Korrigieren des Plans „wegoptimiert“.
 */
export function addDesignBudgetConflicts(
  nodes: readonly Node[],
  edges: readonly CableEdge[],
  sysVoltage: Volts,
  houseBatteryId: string | undefined,
  collector: ConflictCollector
): DesignBudgetVerdict {
  const verdict = evaluateDesignBudget(nodes, edges, sysVoltage, houseBatteryId);
  if (verdict.requiredCurrent <= 0) return verdict;

  const round = (value: number) => `${Math.round(value)} A`;
  const nodeIds = [...verdict.batteryIds, ...verdict.loadNodeIds];
  const basis = `Benötigt: ${round(verdict.requiredCurrent)}. `;
  const parts = [
    verdict.cableCanCarry === undefined
      ? 'Kabeltragfähigkeit: nicht bewertbar'
      : `Kabel kann ${verdict.cableCanCarry ? 'die Last tragen' : 'die Last NICHT tragen'} (I_z ${round(verdict.cableLimit!)})`,
    verdict.fuseSuitable === undefined
      ? 'Sicherung: nicht bewertbar'
      : `Sicherung ${verdict.fuseSuitable ? 'passend' : 'NICHT passend'} (I_n ${round(verdict.fuseLimit!)})`,
    verdict.batteryCanSupply === undefined
      ? 'Batterie: nicht bewertbar (BMS-Grenze fehlt)'
      : `Batterie kann die Last ${verdict.batteryCanSupply ? 'liefern' : 'NICHT liefern'} (BMS ${round(verdict.bmsLimit!)})`,
  ].join(' · ');

  if (verdict.bmsLimit === undefined) {
    collector.add({
      kind: 'load-exceeds-limit',
      severity: 'warning',
      ruleId: DESIGN_BUDGET_RULES.missingBms,
      message: `${basis}${parts}. Die Versorgung ist fachlich NICHT bewertbar — ein passendes Kabel ist kein Nachweis, dass die Batterie liefern kann.`,
      edgeIds: verdict.edgeIds,
      nodeIds,
    });
    collector.ask(
      'Wie hoch ist der maximal zulässige Dauerentladestrom des BMS (Datenblatt der Aufbaubatterie)? Ohne diese Angabe bleibt die Systemauslegung unbewertet.'
    );
  }

  if (!verdict.feasibility.feasible) {
    const limitedByBms = verdict.feasibility.limitedBy === 'bms';
    const limitingName = limitedByBms
      ? CURRENT_LIMIT_LABEL.bms
      : verdict.feasibility.limitedBy === 'unknown'
        ? 'unbekannte Grenze'
        : CURRENT_LIMIT_LABEL[verdict.feasibility.limitedBy];
    const remedies = verdict.remedies.length > 0 ? ` Lösungswege: ${verdict.remedies.join(' ')}` : '';
    collector.add({
      kind: 'load-exceeds-limit',
      // KRITISCH und damit freigabesperrend, wenn das BMS die kleinste Grenze
      // ist. Andere Grenzen (Kabel/Sicherung/70-mm²-Modellgrenze) sind bereits
      // über `fuseWarning` kritisch in der Live-Validierung verankert; hier
      // stehen sie als benannter Hinweis, damit das Budget vollständig bleibt
      // und kein zweiter, abweichender Schweregrad entsteht.
      severity: limitedByBms ? 'critical' : 'warning',
      ruleId: limitedByBms ? DESIGN_BUDGET_RULES.exceeded : DESIGN_BUDGET_RULES.otherLimit,
      message: `${limitedByBms ? 'Kritisch: ' : ''}${basis}Kleinste Grenze: ${limitingName} (${round(verdict.budget.allowedCurrent ?? 0)}). ${parts}. Das Gesamtsystem ist für diese Last NICHT geeignet — die Dimensionierung von Kabel und Sicherung ersetzt nicht die Lieferfähigkeit der Batterie.${remedies}`,
      edgeIds: verdict.edgeIds,
      nodeIds,
    });
  } else if (verdict.assessment === 'warning' && verdict.feasibility.limitedBy === 'bms') {
    collector.add({
      kind: 'load-exceeds-limit',
      severity: 'warning',
      ruleId: DESIGN_BUDGET_RULES.headroom,
      message: `${basis}${parts}. Ohne Reserve: ${verdict.feasibility.message}`,
      edgeIds: verdict.edgeIds,
      nodeIds,
    });
  }
  return verdict;
}
