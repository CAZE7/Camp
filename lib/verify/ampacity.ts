/**
 * lib/verify/ampacity.ts — PASS 3: Ampazität, Schutz und Selektivität.
 *
 * Der Kern dieses Passes ist die Normungleichung aus IEC 60364-4-43 §433.1:
 *
 *   (1)  I_b ≤ I_n ≤ I_z
 *   (2)  I_2 ≤ 1,45 · I_z
 *
 * mit
 *   I_b  Betriebsstrom der Leitung (aus `calculateEdgeCurrent` / `acCurrentA`,
 *        NICHT neu gerechnet — eine Autorität je Frage),
 *   I_n  Bemessungsstrom des wirksamen Schutzorgans,
 *   I_z  Belastbarkeit nach Korrekturfaktoren (`physics.effectiveAmpacityA`),
 *   I_2  konventioneller Auslösestrom des Schutzorgans (`deviceClasses`).
 *
 * Dazu kommen die Regeln, die im Modell KEINE Ungleichung, sondern eine
 * Existenz- oder Topologieaussage sind:
 *   - AMP-003: Leitungsabgangsschutz an der Quelle innerhalb 0,2 m,
 *   - AMP-004: Abschaltvermögen ≥ prospektiver Kurzschlussstrom,
 *   - AMP-005: Selektivität der Kaskade (I²t oder Verhältnis-Heuristik),
 *   - AMP-006: Leerrohr-Füllgrad.
 *
 * Grundsatz „No Silent Fallback“: Jede Zahl, die zur Entscheidung fehlt
 * (Querschnitt, Länge, Nennstrom, I_2, Abschaltvermögen), erzeugt ein
 * UNVERIFIABLE-Ereignis mit benannter Entität und Remediation. Es gibt keinen
 * Zweig, der bei fehlenden Daten »passt schon« sagt.
 */

import {
  DERATE_FACTOR,
  FUSE_MAX_UNPROTECTED_LENGTH_M,
  VDE_SIZES,
  evaluateCableProtection,
  maxFuseForDisplay,
  selectFuseSize,
} from '../electrical';
import { bankShortCircuitCurrentA, shortCircuitAtFuseA } from '../shortCircuit';
import type { Node } from '../domain/graph';
import { mm2 } from '../units';
import {
  VDE_CONDUIT_INNER_DIAMETERS,
  VDE_MAX_CONDUIT_FILL_PERCENT,
  calculateConduitFillPercent,
  recommendConduitType,
} from '../vde-standards';

import { bundledCircuitsFor, type PassContext } from './context';
import {
  breakingCapacityOf,
  conventionalOperatingCurrentI2,
  describeDevice,
  isOvercurrentProtection,
  type OvercurrentProtectionDevice,
} from './deviceClasses';
import { auditEvent, checkOrNotApplicable } from './events';
import { behaviorOf, labelOfNode } from './graph';
import { calculateCorrectedIz, effectiveAmpacityA } from './physics';
import type { AuditEventDetails } from './types';
import {
  effectiveOvercurrentDevice,
  protectionsOnCable,
  sortedCables,
  upstreamChain,
  type OvercurrentPlacement,
  type UpstreamChain,
  type UpstreamDevice,
} from './pathSearch';

/**
 * Schutzorgane, die GENAU DIESE Leitung schützen.
 *
 * Zwei Quellen zählen:
 *   - Organe, die in der Leitung sitzen (`edge.data.fuseSize`/`fuseOffset`),
 *   - Organe, die als eigener Knoten unmittelbar vor der Leitung sitzen
 *     (Sicherungskasten) — sie sind der Leitungsabgangsschutz.
 *
 * Organe auf ANDEREN Leitungen (weiter oben im Strang) schützen jene Leitungen,
 * nicht diese: Ihre I₂-Zahl gegen die I_z dieser Leitung zu stellen, wäre eine
 * erfundene Zuordnung (jede Leitung hat ihren eigenen Schutz).
 */
function protectingPlacements(cable: CableModel, chain: UpstreamChain): OvercurrentPlacement[] {
  const own = protectionsOnCable(cable);
  const nodeDevices = chain.devices
    .filter((entry) => entry.placement.host === 'node')
    .map((entry) => entry.placement)
    .filter((placement): placement is OvercurrentPlacement => isOvercurrentProtection(placement.device));
  const seen = new Set<string>();
  const out: OvercurrentPlacement[] = [];
  for (const placement of [...own, ...nodeDevices]) {
    const key = `${placement.host}:${placement.hostId}:${placement.device.type}:${placement.device.ratedCurrentA}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(placement);
  }
  return out.sort((a, b) => {
    const byRating = a.device.ratedCurrentA - b.device.ratedCurrentA;
    if (byRating !== 0) return byRating;
    return `${a.host}:${a.hostId}`.localeCompare(`${b.host}:${b.hostId}`);
  });
}
import { SELECTIVITY_RATIO_HEURISTIC, selectivityByEnergy } from './physics';
import { buildPortGraph } from './topology';
import type { AuditEvent, CableModel, CheckResult, ProtectionPlacement } from './types';

/** Vergleichstoleranz der Ungleichungen (reine Fließkommagrenze, keine Toleranz auf die Norm). */
const EPSILON_A = 1e-9;

/** IEC 60364-4-43 §433.1 Bedingung (2) — der Faktor steht in der Norm selbst. */
export const I2_IZ_FACTOR = 1.45;

/** Leitungen dieses Trägers sind DC-/Solarleitungen (AC hat eigene Regeln). */
const isDcLike = (cable: CableModel): boolean => cable.carrier === 'dc' || cable.carrier === 'solar';

/** Kabelbezeichnung für Meldungen (Quelle → Ziel). */
function cableLabel(context: PassContext, cable: CableModel): string {
  return `${labelOfNode(context.graph, cable.from.nodeId)} → ${labelOfNode(context.graph, cable.to.nodeId)}`;
}

/** Nächster größerer Normquerschnitt (oder null, wenn es keinen gibt). */
function nextCrossSectionFor(currentMm2: number): number | null {
  for (const size of VDE_SIZES) {
    if (size > currentMm2) return size;
  }
  return null;
}

/**
 * Deutsche Zahlenschreibweise in Vorgabetexten („120,4 A").
 *
 * Der Report schreibt Ist/Soll über die eigenen Felder; in den Klartext-
 * vorgaben stand bisher `toFixed` mit Punkt — „I_z = 120.4 A" neben
 * „Ist: 158,73 A". Ein Dokument, das zwei Dezimaltrennzeichen mischt,
 * liest sich wie ein Zahlendreher.
 */
const formatA = (value: number): string => value.toFixed(1).replace('.', ',');

/** Verhältnis-Zahl mit deutschem Dezimaltrennzeichen („1,6:1", nicht „1.6:1"). */
const formatRatio = (value: number): string => value.toFixed(1).replace('.', ',');

/**
 * Auswege, wenn der Strom größer ist als das, was die Normreihe bis zum
 * größten Querschnitt unter den angesetzten Korrekturfaktoren tragen kann.
 *
 * Genau die drei Hebel, die AUDIT ELE-002 als EXPECTED BEHAVIOR für die
 * thermische Sättigung vorgibt (Parallelleitung / höhere Systemspannung /
 * Lastverlagerung). Vorher stand hier nur „Betriebsstrom senken oder Leitung
 * aufteilen" — ohne Zielwert und ohne einen der drei Wege zu benennen.
 *
 * Bewusst KEINE Parallelrechnung (n × A, Strom je Leiter) und kein
 * umgerechneter Zielwert: Das Modell führt parallel geführte Leiter nicht als
 * eine Leitung, eine ausgerechnete Zahl wäre eine Angabe ohne Gegenstand im
 * Plan (Regel M). Deshalb wird benannt, welcher Nachweis vor dem Umbau zu
 * führen ist — nicht sein Ergebnis. Die Bedingungen für Parallelleiter
 * (gleiche Länge, gleicher Querschnitt, gemeinsame Absicherung) sind wörtlich
 * die aus AUDIT ELE-002 (NORM/SOURCE), kein eigenes Normzitat.
 */
function structuralRemedy(): string {
  return (
    `dann muss die Last selbst kleiner werden: Systemspannung erhöhen (doppelte Spannung halbiert den Strom ` +
    `für dieselbe Leistung), große Verbraucher auf einen eigenen, höher gespannten Strang verlagern oder die ` +
    `Leitung in mehrere parallele Abgänge aufteilen — gleiche Länge, gleicher Querschnitt, gemeinsame ` +
    `Absicherung; dieser Prüflauf rechnet parallele Leiter nicht als eine Leitung, ihr Nachweis gehört vor ` +
    `dem Umbau geführt.`
  );
}

/**
 * Remediation, wenn I_b > I_z: Querschnitt erhöhen ODER Laststrom senken.
 *
 * Obergrenze für „Betriebsstrom senken" ist in BEIDEN Zweigen I_z (die
 * angesetzte Belastbarkeit) — nicht die Sicherungsstufe. Die alte Fassung
 * nannte `maxFuseForDisplay(nächster Querschnitt)`: Die Norm-Sicherung liegt
 * unter I_z (z. B. 35 mm² → I_z 77,7 A, aber Sicherungsstufe 63 A), also
 * wurde ein schärferer Zielwert ausgegeben als die Normungleichung verlangt.
 *
 * @param izA       angesetzte Belastbarkeit des GEPRÜFTEN Kabels.
 * @param izNextA   angesetzte Belastbarkeit des vorgeschlagenen Querschnitts
 *   (derselbe Rechenweg wie beim geprüften Kabel — `effectiveAmpacityA`),
 *   `null`, wenn der Vorschlag nicht in der Belastbarkeitstabelle steht.
 */
function remedyForAmpacity(
  currentA: number,
  currentMm2: number,
  izA: number,
  izNextA: number | null
): string {
  const needed = nextCrossSectionFor(currentMm2);
  if (needed === null || izNextA === null) {
    return (
      `Betriebsstrom auf ≤ ${formatA(izA)} A senken — mehr trägt ${currentMm2} mm² unter den angesetzten ` +
      `Korrekturfaktoren nicht, und ${currentMm2} mm² ist der größte Querschnitt der Auslegungstabelle ` +
      `(Sicherungsstufe höchstens ${maxFuseForDisplay(currentMm2)} A). Reicht das nicht, ` +
      `${structuralRemedy()}`
    );
  }
  return (
    `Querschnitt ${currentMm2} mm² → ${needed} mm² erhöhen (trägt dann I_z = ${formatA(izNextA)} A, ` +
    `Sicherungsstufe bis ${maxFuseForDisplay(needed)} A) oder Betriebsstrom auf ≤ ${formatA(izA)} A senken ` +
    `(I_z des verlegten ${currentMm2} mm²).`
  );
}

/**
 * Remediation, wenn I_n > I_z: kleinere Sicherung ODER größerer Querschnitt.
 *
 * Der Vorschlag braucht I_b. Ohne ihn empfahl die alte Fassung pauschal
 * „Sicherung auf ≤ FUSE_MAP[Querschnitt] A verringern" — bei I_b = 158,7 A auf
 * 70 mm² also „Sicherung auf ≤ 100 A". Damit wäre I_b > I_n gebrochen:
 * dieselbe Bedingung (1) des §433.1, die diese Karte gerade prüft, und im
 * Betrieb eine auslösende Anlage. Eine Abhilfe, die den Befund gegen einen
 * anderen tauscht, ist keine.
 */
function remedyForFuseLargerThanAmpacity(ibA: number, crossSectionMm2: number, izA: number): string {
  const maxFuse = maxFuseForDisplay(crossSectionMm2);
  if (ibA <= maxFuse + EPSILON_A) {
    return (
      `Sicherung auf ${selectFuseSize(ibA, crossSectionMm2)} A verringern — kleinste Normstufe, die ` +
      `I_b = ${formatA(ibA)} A trägt und mit I_n ≤ I_z = ${formatA(izA)} A vereinbar ist ` +
      `(zulässig bis ${maxFuse} A).`
    );
  }
  return (
    `Eine kleinere Sicherung löst diesen Fall nicht: I_b = ${formatA(ibA)} A liegt bereits über ` +
    `I_z = ${formatA(izA)} A, und I_n muss ≥ I_b und ≤ I_z sein — Bedingung (1) ist für diese Leitung ` +
    `nicht erfüllbar. Eine Sicherung ≤ ${maxFuse} A würde im Normalbetrieb auslösen und den Befund nur ` +
    `auf I_b > I_n verschieben; ${structuralRemedy()}`
  );
}

/** Vorgelagertes Organ, das wirklich gegen Überstrom schützt (RCD fällt heraus). */
type OvercurrentUpstream = { entry: UpstreamDevice; device: OvercurrentProtectionDevice };

/**
 * Typprädikat über das GESAMTE Kettenglied: `isOvercurrentProtection` verengt
 * `placement.device` nicht, wenn es als Callback über `entry` läuft — die
 * Verengung muss am zurückgegebenen Typ hängen, nicht an einem Argument.
 */
function isOvercurrentUpstream(entry: UpstreamDevice): entry is UpstreamDevice & {
  placement: OvercurrentPlacement;
} {
  return isOvercurrentProtection(entry.placement.device);
}

/**
 * Obergrenze für den Nennstrom eines VORGELAGERTEN Schutzorgans — `null`,
 * wenn sie nicht bestimmbar ist.
 *
 * Sitzt das Organ in einer Leitung (`fuseSize` auf einer Kante), begrenzt
 * deren angesetzte Belastbarkeit I_z den Nennstrom: AMP-001 verlangt
 * I_n ≤ I_z für genau diese Leitung. Sitzt es als eigener Knoten
 * (Sicherungskasten) in Reihe, gibt es keine Leitung, die diesem Organ
 * zugeordnet wäre — dann ist die Grenze unbekannt und wird nicht erfunden.
 */
function upstreamRatingCeilingA(context: PassContext, entry: UpstreamDevice): number | null {
  if (entry.placement.host !== 'edge-data') return null;
  const cable = context.graph.cableById.get(entry.hostId);
  if (!cable) return null;
  const ampacity = ampacityOf(context, cable);
  if (ampacity === null) return null;
  return maxFuseForDisplay(cable.crossSectionMm2 ?? 0);
}

/**
 * Vorgabe für die Selektivitäts-Abhilfe: Nennstrom, den das vorgelagerte Organ
 * für das Verhältnis ≥ 1,6:1 bräuchte — gekappt an dem, was seine eigene
 * Leitung zulässt.
 *
 * Der unkapierte Wert war eine selbstzerstörende Vorgabe: Bei 100 A/100 A auf
 * einer 70-mm²-Kaskade stand dort „Vorgelagertes Schutzorgan auf ≥ 160,0 A
 * vergrößern" — 160 A über I_z = 120,4 A derselben Leitung, also genau der
 * AMP-001-Befund (I_n > I_z), den der Nutzer im selben Report bereits hat.
 * Eine Abhilfe, die einen kritischen Befund erzeugt, um einen anderen zu
 * schließen, ist keine.
 */
type SelectivityTarget =
  | { kind: 'raise'; ratingA: number }
  | { kind: 'capped'; ratingA: number; ceilingA: number }
  | { kind: 'unknown-ceiling'; ratingA: number };

function selectivityTargetA(downstreamA: number, ceilingA: number | null): SelectivityTarget {
  const needed = downstreamA * SELECTIVITY_RATIO_HEURISTIC;
  if (ceilingA === null) return { kind: 'unknown-ceiling', ratingA: needed };
  if (needed <= ceilingA + EPSILON_A) return { kind: 'raise', ratingA: needed };
  return { kind: 'capped', ratingA: needed, ceilingA };
}

/** Abhilfe-Text zur Selektivitätsvorgabe (beide Richtungen der Kaskade). */
function selectivityRemedy(target: SelectivityTarget): string {
  const prove = 'oder Hersteller-Selektivitätstabelle für dieses Paar nachweisen';
  switch (target.kind) {
    case 'raise':
      return (
        `Vorgelagertes Schutzorgan auf I_n ≥ ${formatA(target.ratingA)} A vergrößern ` +
        `(Verhältnis ≥ ${formatRatio(SELECTIVITY_RATIO_HEURISTIC)}:1) ${prove}.`
      );
    case 'capped':
      return (
        `Über den Nennstrom ist diese Kaskade nicht selektiv zu bekommen: ≥ ${formatA(target.ratingA)} A ` +
        `wären für das Verhältnis ${formatRatio(SELECTIVITY_RATIO_HEURISTIC)}:1 nötig, die Leitung des ` +
        `vorgelagerten Organs lässt aber höchstens ${target.ceilingA} A zu (I_n ≤ I_z, AMP-001). ` +
        `Das nachgelagerte Organ auf ≤ ${formatA(target.ceilingA / SELECTIVITY_RATIO_HEURISTIC)} A ` +
        `verkleinern (I_b beachten), den Querschnitt der vorgelagerten Leitung erhöhen ${prove}.`
      );
    case 'unknown-ceiling':
      return (
        `Vorgelagertes Schutzorgan auf I_n ≥ ${formatA(target.ratingA)} A vergrößern ` +
        `(Verhältnis ≥ ${formatRatio(SELECTIVITY_RATIO_HEURISTIC)}:1) — die Leitung, auf der dieses Organ ` +
        `sitzt, ist hier nicht zugeordnet, ihre Belastbarkeitsgrenze wurde deshalb nicht mitgeprüft; ` +
        `I_n ≤ I_z dieser Zuleitung ist gesondert nachzuweisen — ${prove}.`
      );
    default: {
      const exhaustive: never = target;
      throw new RangeError(`selectivityRemedy: unbekannter Zieltyp ${String(exhaustive)}`);
    }
  }
}

/**
 * Herkunft des angesetzten Faktors — Reportpflicht.
 *
 * Die Engine setzt `min(DERATE_FACTOR, f₁·f₂)` (`physics.effectiveAmpacityA`).
 * Sind Umgebung und Häufung auf Referenz (f₁ = f₂ = 1,000), entscheidet die
 * Planer-Pauschale — im Report stand dann „Basis 172 A × 0.700; f₁ = 1.000,
 * f₂ = 1.000" ohne ein Wort dazu, woher die 0,700 kommen. 172 × 1 × 1 = 120,4
 * liest sich wie ein Rechenfehler, ist aber die dokumentierte Modellannahme
 * (AUDIT ELE-001: EINE Iz-Wahrheit für Dimensionierung und Sicherungsgrenze).
 */
function deratingExplanation(result: ReturnType<typeof effectiveAmpacityA>): string {
  const physics = result.ambientFactor * result.groupingFactor;
  if (Math.abs(result.combinedFactor - DERATE_FACTOR) <= 1e-12 && physics > DERATE_FACTOR + 1e-12) {
    return (
      ` — die ${DERATE_FACTOR.toFixed(3).replace('.', ',')} ist die pauschale Planer-Abminderung ` +
      `(DERATE_FACTOR, AUDIT ELE-001), nicht f₁/f₂: Umgebung und Häufung liegen auf Tabellenreferenz, ` +
      `die Pauschale ist hier der strengere der beiden Werte`
    );
  }
  return '';
}

/**
 * Zulässige Belastbarkeit I_z einer Leitung unter den Annahmen des Laufs.
 * `null`, wenn der Querschnitt fehlt oder nicht in der Tabelle steht.
 */
function ampacityAt(
  crossSectionMm2: number | null,
  conditions: Parameters<typeof effectiveAmpacityA>[1]
): ReturnType<typeof effectiveAmpacityA> | null {
  if (crossSectionMm2 === null) return null;
  try {
    return effectiveAmpacityA(crossSectionMm2, conditions);
  } catch {
    return null;
  }
}

function ampacityOf(context: PassContext, cable: CableModel): ReturnType<typeof effectiveAmpacityA> | null {
  return ampacityAt(cable.crossSectionMm2, {
    ambientC: context.options.ampacity.ambientC,
    insulation: context.options.ampacity.insulation,
    bundledCircuits: bundledCircuitsFor(context, cable.edgeId),
  });
}

/**
 * Strukturierte Details für AMP-001-Befunde (Auftrag §14): Ib/In/Iz,
 * die contributors des Strommodells und die volle Iz-Faktoren-Aufschlüsselung.
 * Basis ist `calculateCorrectedIz` — dieselbe Rechnung wie `ampacityOf`,
 * aber mit benannten Faktoren (keine Doppelberechnung, nur dieselben Inputs).
 */
function ibInIzDetails(
  context: PassContext,
  cable: CableModel,
  ampacity: ReturnType<typeof effectiveAmpacityA> | null,
  inA: number | null
): AuditEventDetails {
  const explanation = cable.currentExplanation;
  const details: AuditEventDetails = {
    ibA: cable.currentA,
    inA,
    izA: ampacity?.izA ?? null,
  };
  if (explanation) {
    details.calculationMethod = explanation.calculationMethod;
    if (explanation.contributingLoads.length > 0) {
      details.contributors = explanation.contributingLoads.map((entry) => ({
        componentId: entry.componentId,
        label: entry.label,
        role: entry.role,
        contribution: entry.contribution,
      }));
    }
    if (explanation.assumptions.length > 0) details.assumptions = [...explanation.assumptions];
  }
  if (ampacity && cable.crossSectionMm2 !== null) {
    try {
      const breakdown = calculateCorrectedIz(cable.crossSectionMm2, {
        ambientC: context.options.ampacity.ambientC,
        insulation: context.options.ampacity.insulation,
        bundledCircuits: bundledCircuitsFor(context, cable.edgeId),
      });
      details.izBreakdown = {
        baseIz: breakdown.baseIz,
        ambientFactor: breakdown.ambientFactor,
        groupingFactor: breakdown.groupingFactor,
        installationFactor: breakdown.installationFactor,
        plannerSafetyFactor: breakdown.plannerSafetyFactor,
        correctedIz: breakdown.correctedIz,
        explanation: breakdown.explanation,
      };
    } catch {
      // Querschnitt nicht in der Tabelle — izBreakdown bleibt weg (izA ist null).
    }
  }
  return details;
}

/**
 * Angesetzte Belastbarkeit des NÄCHSTEN größeren Normquerschnitts — unter
 * denselben Bedingungen wie das geprüfte Kabel (Umgebung, Isolierstoff,
 * Häufung). Ohne ihn kann die Abhilfe nur raten, was ein dickerer Leiter
 * hier tatsächlich tragen würde; `null`, wenn es keine größere Stufe gibt
 * oder der Vorschlag nicht in der Belastbarkeitstabelle steht.
 */
function ampacityOfNextCrossSection(context: PassContext, cable: CableModel): number | null {
  const next = cable.crossSectionMm2 === null ? null : nextCrossSectionFor(cable.crossSectionMm2);
  const result = ampacityAt(next, {
    ambientC: context.options.ampacity.ambientC,
    insulation: context.options.ampacity.insulation,
    bundledCircuits: bundledCircuitsFor(context, cable.edgeId),
  });
  return result?.izA ?? null;
}

// ============================================================================
// AMP-001 — I_b ≤ I_n ≤ I_z
// ============================================================================

export function checkIbInIz(context: PassContext): CheckResult {
  const ruleId = 'AMP-001-ib-in-iz' as const;
  const events: AuditEvent[] = [];
  let evaluated = 0;
  const portGraph = buildPortGraph(context.graph);

  for (const cable of sortedCables(context.graph)) {
    const entity = { kind: 'edge' as const, id: cable.edgeId };
    const label = cableLabel(context, cable);

    if (cable.crossSectionMm2 === null) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          kind: 'UNVERIFIABLE',
          message: `Kabel ${label}: Querschnitt fehlt — I_z ist nicht bestimmbar, die Leitung ist damit nicht bewertbar.`,
          autoFixRemedy:
            'Querschnitt in mm² im Kabel-Inspektor eintragen (Normreihe 1,5/2,5/4/6/10/16/25/35/50/70 mm²).',
        })
      );
      continue;
    }

    const ampacity = ampacityOf(context, cable);
    if (ampacity === null) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          kind: 'UNVERIFIABLE',
          message: `Kabel ${label}: Querschnitt ${cable.crossSectionMm2} mm² steht nicht in der Belastbarkeitstabelle — kein Tabellenwert, keine Aussage.`,
          autoFixRemedy:
            'Querschnitt auf einen Normquerschnitt der Auslegungstabelle ändern (kein geratener Zwischenwert).',
        })
      );
      continue;
    }

    const ib = cable.currentA;
    if (ib === null) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          kind: 'UNVERIFIABLE',
          message: `Kabel ${label}: Betriebsstrom I_b ist nicht bestimmbar (weder Leistung noch Strom am Ziel deklariert).`,
          autoFixRemedy: 'Leistung (W) oder Strom (A) des Verbrauchers am Kabelende eintragen.',
        })
      );
      continue;
    }

    evaluated += 1;

    // Die Koordination I_b ≤ I_n ≤ I_z wird GENAU EINMAL entschieden
    // (`evaluateCableProtection`, lib/electrical.ts — Auftrag Phase 7). Die
    // Meldungen unten bleiben unverändert; sie übersetzen nur noch das Urteil
    // in Remediation und Anzeigetext.
    const verdict = evaluateCableProtection({
      ib,
      in: null,
      iz: ampacity.izA,
    });

    if (verdict.violations.includes('ib-over-iz')) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          calculatedValue: ib,
          allowedLimit: ampacity.izA,
          unit: 'A',
          details: ibInIzDetails(context, cable, ampacity, null),
          message: `Kabel ${label}: I_b = ${ib.toFixed(1)} A überschreitet die korrigierte Belastbarkeit I_z = ${ampacity.izA.toFixed(1)} A (Basis ${ampacity.baseAmpacityA} A × ${ampacity.combinedFactor.toFixed(3)}; f₁ = ${ampacity.ambientFactor.toFixed(3)}, f₂ = ${ampacity.groupingFactor.toFixed(3)})${deratingExplanation(ampacity)}.`,
          autoFixRemedy: remedyForAmpacity(
            ib,
            cable.crossSectionMm2,
            ampacity.izA,
            ampacityOfNextCrossSection(context, cable)
          ),
        })
      );
    }

    const chain = upstreamChain(context.graph, portGraph, cable);
    const effective = effectiveOvercurrentDevice(cable, chain);
    if (!effective) {
      // Rückleiter (Minus/Masse) sind über das Schutzorgan ihres Stromkreises
      // geschützt; ihre I_n-Prüfung wäre eine Doppelforderung. Auf der
      // Plusseite ist das Fehlen eines Schutzorgans dagegen ein Datenloch.
      if (cable.from.polarity === 'positive' || cable.to.polarity === 'positive') {
        events.push(
          auditEvent({
            ruleId,
            entity,
            kind: 'UNVERIFIABLE',
            message: `Kabel ${label}: kein Überstrom-Schutzorgan gefunden — I_n ist nicht bestimmbar (I_b ≤ I_z wurde dennoch geprüft). Die fehlende Absicherung an der Quelle meldet AMP-003.`,
            autoFixRemedy:
              'Sicherung bzw. Schutzschalter in die Leitung setzen (In ≥ I_b, In ≤ I_z) oder die Leitung an ein vorhandenes, passend bemessenes Schutzorgan anschließen.',
          })
        );
      }
      continue;
    }

    const device = effective.device;
    if (!(device.ratedCurrentA > 0)) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          kind: 'UNVERIFIABLE',
          message: `Kabel ${label}: das Schutzorgan (${describeDevice(device)}) hat keinen Nennstrom — ohne I_n ist die Ungleichung nicht prüfbar.`,
          autoFixRemedy:
            'Bemessungsstrom des Schutzorgans eintragen (Sicherungskasten: Feld „rating“, Kabel: Feld „fuseSize“).',
        })
      );
      continue;
    }

    const protectionVerdict = evaluateCableProtection({
      ib,
      in: device.ratedCurrentA,
      iz: ampacity.izA,
    });

    if (protectionVerdict.violations.includes('ib-over-in')) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          calculatedValue: ib,
          allowedLimit: device.ratedCurrentA,
          unit: 'A',
          equation: 'I_b ≤ I_n ≤ I_z (hier: I_b > I_n)',
          details: ibInIzDetails(context, cable, ampacity, device.ratedCurrentA),
          message: `Kabel ${label}: Betriebsstrom I_b = ${ib.toFixed(1)} A liegt über dem Nennstrom I_n = ${device.ratedCurrentA} A des wirksamen Schutzorgans (${describeDevice(device)})${effective.host === 'node' ? ` im Bauteil „${labelOfNode(context.graph, effective.hostId)}“` : ` auf Leitung „${effective.hostId}“`}.`,
          autoFixRemedy: `Schutzorgan mit I_n ≥ ${ib.toFixed(1)} A einsetzen (Vorschlag ${selectFuseSize(ib, cable.crossSectionMm2)} A), sofern I_n ≤ I_z = ${ampacity.izA.toFixed(1)} A bleibt — sonst Querschnitt erhöhen.`,
        })
      );
    }

    if (protectionVerdict.violations.includes('in-over-iz')) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          calculatedValue: device.ratedCurrentA,
          allowedLimit: ampacity.izA,
          unit: 'A',
          equation: 'I_b ≤ I_n ≤ I_z (hier: I_n > I_z)',
          details: ibInIzDetails(context, cable, ampacity, device.ratedCurrentA),
          message: `Kabel ${label}: Nennstrom I_n = ${device.ratedCurrentA} A des Schutzorgans liegt über der Leitungsbelastbarkeit I_z = ${ampacity.izA.toFixed(1)} A.`,
          autoFixRemedy: remedyForFuseLargerThanAmpacity(ib, cable.crossSectionMm2, ampacity.izA),
        })
      );
    }
  }

  return checkOrNotApplicable(ruleId, events, evaluated);
}

// ============================================================================
// AMP-002 — I_2 ≤ 1,45 · I_z
// ============================================================================

export function checkI2VsIz(context: PassContext): CheckResult {
  const ruleId = 'AMP-002-i2-vs-iz' as const;
  const events: AuditEvent[] = [];
  let evaluated = 0;
  const portGraph = buildPortGraph(context.graph);

  for (const cable of sortedCables(context.graph)) {
    // Nur das WIRKSAME Organ dieses Leiterabschnitts wird gegen dessen
    // Belastbarkeit geprüft (eigene Leitung, sonst das nächstgelegene
    // vorgelagerte) — sonst würde ein zusätzliches Organ am Leitungsanfang die
    // nachgelagerte Leitung doppelt bewerten (Fehlalarm).
    const placement = effectiveOvercurrentDevice(cable, upstreamChain(context.graph, portGraph, cable));
    if (!placement) continue;
    const entity = { kind: 'edge' as const, id: cable.edgeId };
    const label = cableLabel(context, cable);

    {
      const device = placement.device;
      if (!(device.ratedCurrentA > 0)) continue;
      evaluated += 1;

      const ampacity = ampacityOf(context, cable);
      if (ampacity === null) {
        events.push(
          auditEvent({
            ruleId,
            entity,
            kind: 'UNVERIFIABLE',
            message: `Kabel ${label}: Schutzorgan ${describeDevice(device)} vorhanden, aber I_z nicht bestimmbar (Querschnitt fehlt oder unbekannt).`,
            autoFixRemedy:
              'Querschnitt der geschützten Leitung auf einen Normquerschnitt der Tabelle setzen.',
          })
        );
        continue;
      }

      const conventional = conventionalOperatingCurrentI2(device);
      if (conventional.i2A === null) {
        events.push(
          auditEvent({
            ruleId,
            entity,
            kind: 'UNVERIFIABLE',
            message: `Kabel ${label}: konventioneller Auslösestrom I_2 von ${describeDevice(device)} ist nicht belegt (${conventional.source}). Eine Annahme wäre eine erfundene Schutzwirkung.`,
            autoFixRemedy:
              'I_2 aus dem Produktdatenblatt im Feld `i2A` eintragen (oder Bauform/Fabrikat wählen, deren Produktnorm I_2 festlegt).',
          })
        );
        continue;
      }

      const limit = I2_IZ_FACTOR * ampacity.izA;
      if (conventional.i2A > limit + EPSILON_A) {
        events.push(
          auditEvent({
            ruleId,
            entity,
            calculatedValue: conventional.i2A,
            allowedLimit: limit,
            unit: 'A',
            message: `Kabel ${label}: I_2 = ${conventional.i2A.toFixed(1)} A (${conventional.source}) überschreitet 1,45 · I_z = ${limit.toFixed(1)} A.`,
            autoFixRemedy: `Schutzorgan mit kleinerem I_2 wählen (I_n ≤ ${(limit / (conventional.ratio ?? I2_IZ_FACTOR)).toFixed(1)} A) oder Querschnitt erhöhen.`,
          })
        );
      }
    }
  }

  return checkOrNotApplicable(ruleId, events, evaluated);
}

// ============================================================================
// AMP-003 — Leitungsabgangsschutz an der Energiequelle (0,2 m)
// ============================================================================

/** Position des ersten Schutzorgans ab der Quelle (0 = am Pol). */
function firstProtectionPosition(placements: readonly ProtectionPlacement[]): number | null | undefined {
  let best: number | null | undefined;
  for (const placement of dedupeByHost(placements)) {
    if (!(placement.device.ratedCurrentA > 0)) continue;
    const position = placement.assumedAtSource ? 0 : placement.positionFromSourceM;
    if (position === null) {
      if (best === undefined) best = null;
      continue;
    }
    if (best === undefined || best === null || position < best) best = position;
  }
  return best;
}

/**
 * Mehrfach gefundene Organe desselben Hosts (Kante/Knoten) nur einmal zählen —
 * und dabei auf Überstrom-Schutzorgane einschränken: Ein RCD hat keinen
 * Bemessungsstrom und darf in keiner §433.1-Ungleichung auftauchen.
 */
function dedupeByHost(placements: readonly ProtectionPlacement[]): OvercurrentPlacement[] {
  const seen = new Set<string>();
  const out: OvercurrentPlacement[] = [];
  for (const placement of placements) {
    if (!isOvercurrentProtection(placement.device)) continue;
    const key = `${placement.host}:${placement.hostId}:${placement.device.type}:${placement.device.ratedCurrentA}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(placement as OvercurrentPlacement);
  }
  return out;
}

export function checkSourceProtectionPosition(context: PassContext): CheckResult {
  const ruleId = 'AMP-003-source-protection-position' as const;
  const events: AuditEvent[] = [];
  let evaluated = 0;

  for (const cable of sortedCables(context.graph)) {
    if (!isDcLike(cable)) continue;
    // Nur der Plus-Abgang einer Quelle: Der Minus-/Masse-Rückweg wird über die
    // Masseanbindung (GND-001) und den Kurzschluss-Erkennungspfad geführt.
    if (cable.from.polarity !== 'positive') continue;
    if (behaviorOf(context.graph, cable.from.nodeId).kind !== 'SOURCE') continue;

    evaluated += 1;
    const entity = { kind: 'edge' as const, id: cable.edgeId };
    const label = cableLabel(context, cable);
    const sourceLabel = labelOfNode(context.graph, cable.from.nodeId);
    const position = firstProtectionPosition(cable.protections);
    const lengthNote = cable.lengthIsAssumption ? ' (Länge ist eine Planungsannahme)' : '';

    if (position === undefined) {
      // Kein Schutzorgan auf dieser Leitung — der ungeschützte Abschnitt ist
      // die ganze Leitung; ohne Länge ist er nicht bestimmbar.
      if (cable.lengthM === null) {
        events.push(
          auditEvent({
            ruleId,
            entity,
            kind: 'UNVERIFIABLE',
            message: `Leitung ${label} ab ${sourceLabel}: kein Schutzorgan und keine Länge — die ungeschützte Länge ist nicht bestimmbar.`,
            autoFixRemedy:
              'Sicherung innerhalb 0,2 m am Quellenpol setzen ODER Leitungslänge eintragen (dann ist die 0,2-m-Grenze prüfbar).',
          })
        );
        continue;
      }
      if (cable.lengthM > FUSE_MAX_UNPROTECTED_LENGTH_M + EPSILON_A) {
        events.push(
          auditEvent({
            ruleId,
            entity,
            calculatedValue: cable.lengthM,
            allowedLimit: FUSE_MAX_UNPROTECTED_LENGTH_M,
            unit: 'm',
            message: `Leitung ${label} ab ${sourceLabel}: ${cable.lengthM.toFixed(2)} m ohne Schutzorgan${lengthNote} — zulässig sind höchstens ${(FUSE_MAX_UNPROTECTED_LENGTH_M * 1000).toFixed(0)} mm.`,
            autoFixRemedy: `Sicherung mit I_n ≤ ${maxFuseForDisplay(cable.crossSectionMm2 ?? 2.5)} A unmittelbar am ${sourceLabel}-Pol anordnen (Feld „fuseSize“/„fuseOffset“) oder die Leitung auf ≤ 0,2 m kürzen.`,
          })
        );
      }
      continue;
    }

    if (position === null) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          kind: 'UNVERIFIABLE',
          message: `Leitung ${label} ab ${sourceLabel}: Schutzorgan vorhanden, aber ohne Einbauposition („fuseOffset“ fehlt und ist nicht als Polnähe markiert) — die 0,2-m-Regel ist nicht prüfbar.`,
          autoFixRemedy:
            'Einbauposition ab Quelle in Metern eintragen (Feld `fuseOffset`) — oder die Sicherung am Pol belassen, dann gilt der Vertrag „am Pol“ (≤ 0,2 m).',
        })
      );
      continue;
    }

    if (position > FUSE_MAX_UNPROTECTED_LENGTH_M + EPSILON_A) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          calculatedValue: position,
          allowedLimit: FUSE_MAX_UNPROTECTED_LENGTH_M,
          unit: 'm',
          message: `Leitung ${label} ab ${sourceLabel}: erstes Schutzorgan sitzt ${position.toFixed(2)} m von der Quelle entfernt${lengthNote} — zulässig sind höchstens ${(FUSE_MAX_UNPROTECTED_LENGTH_M * 1000).toFixed(0)} mm.`,
          autoFixRemedy: `Sicherung an den ${sourceLabel}-Pol versetzen („fuseOffset“ = 0) oder einen zweiten Schutz unmittelbar am Pol ergänzen.`,
        })
      );
    }
  }

  return checkOrNotApplicable(ruleId, events, evaluated);
}

// ============================================================================
// AMP-004 — Abschaltvermögen ≥ prospektiver Kurzschlussstrom
// ============================================================================

export function checkBreakingCapacity(context: PassContext): CheckResult {
  const ruleId = 'AMP-004-breaking-capacity' as const;
  const events: AuditEvent[] = [];
  let evaluated = 0;
  const batteries: Node[] = context.nodes.filter((node) => node.type === 'battery');
  const portGraph = buildPortGraph(context.graph);

  if (batteries.length === 0) {
    // Keine DC-Quelle im Plan ⇒ keine Abschaltvermögensprüfung (nicht anwendbar).
    return checkOrNotApplicable(ruleId, [], 0);
  }
  const bankIk = bankShortCircuitCurrentA(batteries, context.graph.systemVoltageV);
  if (bankIk === null) {
    // Quelle vorhanden, Innenwiderstand unbekannt: Das ist eine DATENLÜCKE,
    // kein Freispruch — sie wird als UNPROVABLE gemeldet.
    return checkOrNotApplicable(
      ruleId,
      [
        auditEvent({
          ruleId,
          entity: { kind: 'system', id: 'short-circuit-model' },
          kind: 'UNVERIFIABLE',
          message:
            'Abschaltvermögen: der Kurzschlussstrom der Batteriebank ist nicht bestimmbar (Innenwiderstand/Chemie fehlen) — kein Vergleich mit I_cn möglich.',
          autoFixRemedy:
            'Innenwiderstand (mΩ, Datenblatt) je Batterie eintragen oder Kapazität und Chemie angeben, damit I_k schätzbar wird.',
        }),
      ],
      0
    );
  }

  for (const cable of sortedCables(context.graph)) {
    if (!isDcLike(cable)) continue;
    const placements = protectingPlacements(cable, upstreamChain(context.graph, portGraph, cable));
    for (const placement of dedupeByHost(placements)) {
      const device = placement.device;
      if (!(device.ratedCurrentA > 0)) continue;
      evaluated += 1;
      const entity = { kind: 'edge' as const, id: cable.edgeId };
      const label = cableLabel(context, cable);

      const position = placement.assumedAtSource ? undefined : (placement.positionFromSourceM ?? undefined);
      const ikAtDevice = shortCircuitAtFuseA(
        batteries,
        position,
        cable.crossSectionMm2 ?? undefined,
        context.graph.systemVoltageV
      );
      if (ikAtDevice === null) {
        events.push(
          auditEvent({
            ruleId,
            entity,
            kind: 'UNVERIFIABLE',
            message: `Kabel ${label}: prospektiver Kurzschlussstrom am Einbauort von ${describeDevice(device)} ist nicht bestimmbar (Batterie-Innenwiderstand fehlt).`,
            autoFixRemedy:
              'Batterie-Innenwiderstand (mΩ, Datenblatt) oder Kapazität/Chemie der Batterie eintragen — damit ist I_k schätzbar.',
          })
        );
        continue;
      }

      const breaking = breakingCapacityOf(device, context.graph.systemVoltageV);
      if (breaking === null) {
        events.push(
          auditEvent({
            ruleId,
            entity,
            kind: 'UNVERIFIABLE',
            calculatedValue: ikAtDevice,
            allowedLimit: null,
            unit: 'A',
            message: `Kabel ${label}: Abschaltvermögen von ${describeDevice(device)} ist nicht belegt — Bauform („fuseType“) angeben oder Datenblattwert eintragen.`,
            autoFixRemedy:
              'Bauform der Sicherung wählen (z. B. Class T für hohe Kurzschlussströme) oder `fuseBreakingCapacity` aus dem Datenblatt eintragen.',
          })
        );
        continue;
      }

      if (breaking < ikAtDevice) {
        events.push(
          auditEvent({
            ruleId,
            entity,
            calculatedValue: breaking,
            allowedLimit: ikAtDevice,
            unit: 'A',
            message: `Kabel ${label}: Abschaltvermögen ${breaking} A liegt unter dem prospektiven Kurzschlussstrom ${ikAtDevice.toFixed(0)} A am Einbauort von ${describeDevice(device)}.`,
            autoFixRemedy: `Sicherung mit Abschaltvermögen ≥ ${Math.ceil(ikAtDevice)} A einsetzen (z. B. Class T) oder die ungeschützte Länge durch Polnähe verkürzen; ggf. Batterie-Innenwiderstand/Anzahl prüfen.`,
          })
        );
      }
    }
  }

  return checkOrNotApplicable(ruleId, events, evaluated);
}

// ============================================================================
// AMP-005 — Selektivität der Schutzkaskade
// ============================================================================

export function checkSelectivity(context: PassContext): CheckResult {
  const ruleId = 'AMP-005-selectivity' as const;
  const events: AuditEvent[] = [];
  let evaluated = 0;
  const portGraph = buildPortGraph(context.graph);

  for (const cable of sortedCables(context.graph)) {
    const chain = upstreamChain(context.graph, portGraph, cable);
    const own = dedupeByHost(cable.protections);
    if (own.length === 0) continue;
    const downstream = own[0];
    if (!downstream) continue;

    const upstream = chain.devices
      .filter(isOvercurrentUpstream)
      .map((entry): OvercurrentUpstream => ({ entry, device: entry.placement.device }))
      .sort((a, b) => b.device.ratedCurrentA - a.device.ratedCurrentA)[0];
    if (!upstream) continue;

    const downstreamA = downstream.device.ratedCurrentA;
    const upstreamA = upstream.device.ratedCurrentA;
    const selectivity = selectivityTargetA(downstreamA, upstreamRatingCeilingA(context, upstream.entry));
    if (!(downstreamA > 0) || !(upstreamA > 0)) continue;

    evaluated += 1;
    const entity = { kind: 'edge' as const, id: cable.edgeId };
    const label = cableLabel(context, cable);
    const pair = `${describeDevice(upstream.device)} (vorgelagert) / ${describeDevice(downstream.device)} (nachgelagert)`;

    const ratio = upstreamA / downstreamA;
    const energy = energySelectivity(upstream.device, downstream.device);

    if (upstreamA < downstreamA) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          calculatedValue: upstreamA,
          allowedLimit: downstreamA,
          unit: 'A',
          message: `Kabel ${label}: vorgelagertes Schutzorgan ist KLEINER als das nachgelagerte (${pair}) — im Fehlerfall spricht die vorgelagerte Einrichtung zuerst an, die nachgelagerte kann nicht selektiv sein.`,
          autoFixRemedy: selectivityRemedy(selectivity),
        })
      );
      continue;
    }

    if (energy !== null) {
      if (!energy) {
        events.push(
          auditEvent({
            ruleId,
            entity,
            message: `Kabel ${label}: Selektivität über Schmelzintegral widerlegt (${pair}) — I²t der vorgelagerten Einrichtung reicht nicht, um vor dem Löschen der nachgelagerten ansprechfrei zu bleiben.`,
            autoFixRemedy:
              'Vorgelagertes Schutzorgan mit größerem Schmelzintegral wählen (nächste Nennstromstufe, andere Kennlinie) oder Hersteller-Selektivitätstabellen verwenden.',
          })
        );
      }
      continue;
    }

    // Die Heuristik 1,6:1 ist nur für Schutzkaskaden ab 16 A belegt. Darunter
    // gilt sie NICHT — auch dann nicht, wenn das Verhältnis zufällig ≥ 1,6 ist.
    if (upstreamA < 16) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          kind: 'UNVERIFIABLE',
          calculatedValue: ratio,
          allowedLimit: SELECTIVITY_RATIO_HEURISTIC,
          message: `Kabel ${label}: Selektivität nicht entscheidbar (${pair}) — das Verhältnis 1,6:1 ist für gleichartige Sicherungen ab 16 A belegt; für kleinere Nennströme fehlen Herstellerdaten.`,
          autoFixRemedy:
            'Herstellerangaben bzw. I²t-Werte beider Geräte eintragen (`preArcingI2tA2s` / `clearingI2tA2s`) oder die Schutzkaskade so ändern, dass das vorgelagerte Organ ≥ 16 A hat.',
        })
      );
      continue;
    }

    if (ratio >= SELECTIVITY_RATIO_HEURISTIC) continue;

    events.push(
      auditEvent({
        ruleId,
        entity,
        calculatedValue: ratio,
        allowedLimit: SELECTIVITY_RATIO_HEURISTIC,
        message: `Kabel ${label}: Selektivität nicht belegt (${pair}) — Verhältnis ${ratio.toFixed(2).replace('.', ',')}:1 liegt unter ${formatRatio(SELECTIVITY_RATIO_HEURISTIC)}:1.`,
        autoFixRemedy: selectivityRemedy(selectivity),
      })
    );
  }

  return checkOrNotApplicable(ruleId, events, evaluated);
}

/** I²t-Vergleich, wenn beide Seiten Daten liefern — sonst null (nicht entscheidbar). */
function energySelectivity(
  upstream: { preArcingI2tA2s?: number | null },
  downstream: { clearingI2tA2s?: number | null }
): boolean | null {
  const pre = upstream.preArcingI2tA2s;
  const clearing = downstream.clearingI2tA2s;
  if (typeof pre !== 'number' || typeof clearing !== 'number') return null;
  if (!(pre > 0) || !(clearing > 0)) return null;
  return selectivityByEnergy({ upstreamPreArcingI2t: pre, downstreamClearingI2t: clearing });
}

// ============================================================================
// AMP-006 — Leerrohr-Füllgrad
// ============================================================================

/**
 * Ergebnis der Füllgrad-Rechnung EINES Leerrohrs.
 *
 * Drei Ausgänge statt einer Zahl: Ein unbekannter Rohrtyp oder ein fehlender
 * Kabelquerschnitt ergibt **keine** Zahl (und vor allem keine 0 %). Dieselbe
 * Funktion speist die Regel AMP-006 und die Anzeige auf der Leerrohr-Karte —
 * damit zeigen Plan und Prüfbericht nie zwei verschiedene Füllgrade.
 */
export type ConduitFillOutcome =
  | { kind: 'known'; percent: number; overfilled: boolean; recommendedType: string | null }
  | { kind: 'unknown-type' }
  | { kind: 'missing-cross-section'; index: number };

export function conduitFillOutcome(
  rawType: string | null,
  crossSections: readonly (number | null)[]
): ConduitFillOutcome {
  if (rawType === null || !Object.prototype.hasOwnProperty.call(VDE_CONDUIT_INNER_DIAMETERS, rawType)) {
    return { kind: 'unknown-type' };
  }
  const index = crossSections.findIndex((value) => value === null || !Number.isFinite(value));
  if (index >= 0) return { kind: 'missing-cross-section', index };
  const sections = crossSections.map((value) => mm2(value as number));
  const percent = calculateConduitFillPercent(rawType, sections);
  const overfilled = percent > VDE_MAX_CONDUIT_FILL_PERCENT;
  return {
    kind: 'known',
    percent,
    overfilled,
    recommendedType: overfilled ? recommendConduitType(sections) : null,
  };
}

export function checkConduitFill(context: PassContext): CheckResult {
  const ruleId = 'AMP-006-conduit-fill' as const;
  const events: AuditEvent[] = [];
  let evaluated = 0;

  const conduits = [...context.nodes]
    .filter((node) => node.type === 'conduit')
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const node of conduits) {
    evaluated += 1;
    const entity = { kind: 'node' as const, id: node.id };
    const label = labelOfNode(context.graph, node.id);
    const data = node.data as Record<string, unknown> | undefined;
    const rawType = typeof data?.conduitType === 'string' ? data.conduitType : null;
    const assigned = Array.isArray(data?.assignedEdges)
      ? (data.assignedEdges as unknown[]).filter((entry): entry is string => typeof entry === 'string')
      : null;

    if (assigned === null) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          kind: 'UNVERIFIABLE',
          message: `Leerrohr ${label}: keine Kabelzuordnung — welcher Füllgrad gilt, ist nicht bestimmbar.`,
          autoFixRemedy:
            'Der Leerrohr-Karte die durchgeführten Kabel zuordnen (`assignedEdges`), damit der Füllgrad gerechnet werden kann.',
        })
      );
      continue;
    }

    const assignedSorted = [...assigned].sort();
    const assignedCables = assignedSorted
      .map((edgeId) => ({ edgeId, cable: context.graph.cableById.get(edgeId) }))
      .filter((entry): entry is { edgeId: string; cable: CableModel } => entry.cable !== undefined);
    const crossSections = assignedCables.map((entry) => entry.cable.crossSectionMm2);
    const outcome = conduitFillOutcome(rawType, crossSections);

    if (outcome.kind === 'unknown-type') {
      events.push(
        auditEvent({
          ruleId,
          entity,
          kind: 'UNVERIFIABLE',
          message: `Leerrohr ${label}: Typ „${rawType ?? '(nicht angegeben)'}“ hat keinen Innendurchmesser in der Tabelle — der Füllgrad ist nicht bestimmbar.`,
          autoFixRemedy: `Leerrohrtyp aus der Tabelle wählen (${Object.keys(VDE_CONDUIT_INNER_DIAMETERS).join(', ')}).`,
        })
      );
      continue;
    }

    if (outcome.kind === 'missing-cross-section') {
      const missing = assignedCables[outcome.index]?.edgeId ?? '(unbekannt)';
      events.push(
        auditEvent({
          ruleId,
          entity,
          kind: 'UNVERIFIABLE',
          message: `Leerrohr ${label}: für Kabel ${missing} fehlt der Querschnitt — der Füllgrad wäre geraten.`,
          autoFixRemedy:
            'Querschnitt des zugeordneten Kabels eintragen oder das Kabel aus der Leerrohr-Zuordnung entfernen.',
        })
      );
      continue;
    }

    if (outcome.overfilled) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          calculatedValue: outcome.percent,
          allowedLimit: VDE_MAX_CONDUIT_FILL_PERCENT,
          unit: '%',
          message: `Leerrohr ${label} (${rawType}): Füllgrad ${outcome.percent.toFixed(0)} % überschreitet die zulässigen ${VDE_MAX_CONDUIT_FILL_PERCENT} %.`,
          autoFixRemedy: outcome.recommendedType
            ? `Größeres Leerrohr wählen (mindestens ${outcome.recommendedType}) oder Kabel auf ein zweites Rohr verteilen, bis der Füllgrad ≤ 40 % liegt.`
            : 'Kabel auf ein zweites Rohr verteilen oder die Leitung kürzen — auch das größte Rohr der Tabelle reicht bei diesem Bündel nicht.',
        })
      );
    }
  }

  return checkOrNotApplicable(ruleId, events, evaluated);
}

/** Alle Prüfungen des Passes 3 in Prüfreihenfolge. */
export function runPass3(context: PassContext): CheckResult[] {
  return [
    checkIbInIz(context),
    checkI2VsIz(context),
    checkSourceProtectionPosition(context),
    checkBreakingCapacity(context),
    checkSelectivity(context),
    checkConduitFill(context),
  ];
}
