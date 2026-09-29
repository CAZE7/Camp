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

import { FUSE_MAX_UNPROTECTED_LENGTH_M, VDE_SIZES, maxFuseForDisplay, selectFuseSize } from '../electrical';
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
} from './deviceClasses';
import { auditEvent, checkOrNotApplicable } from './events';
import { behaviorOf, labelOfNode } from './graph';
import { effectiveAmpacityA } from './physics';
import {
  effectiveOvercurrentDevice,
  protectionsOnCable,
  sortedCables,
  upstreamChain,
  type OvercurrentPlacement,
  type UpstreamChain,
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

/** Remediation, wenn I_b > I_z: Querschnitt erhöhen ODER Laststrom senken. */
function remedyForAmpacity(currentA: number, currentMm2: number): string {
  const needed = nextCrossSectionFor(currentMm2);
  const fuseForCurrent = selectFuseSize(currentA, currentMm2);
  if (needed !== null) {
    return `Querschnitt ${currentMm2} mm² → ${needed} mm² wählen oder Betriebsstrom auf ≤ ${maxFuseForDisplay(needed)} A senken; aktuell verträgt die Leitung nur die Sicherung bis ${maxFuseForDisplay(currentMm2)} A (Vorschlag: ${fuseForCurrent} A nur nach Querschnittserhöhung).`;
  }
  return `Betriebsstrom senken oder Leitung aufteilen: ${currentMm2} mm² ist der größte Normquerschnitt der Auslegung und deckt ${currentA.toFixed(1)} A unter den angesetzten Korrekturfaktoren nicht.`;
}

/** Remediation, wenn I_n > I_z: kleinere Sicherung ODER größerer Querschnitt. */
function remedyForFuseLargerThanAmpacity(crossSectionMm2: number, izA: number): string {
  return `Sicherung auf ≤ ${maxFuseForDisplay(crossSectionMm2)} A verringern (I_z = ${izA.toFixed(1)} A nach Korrekturfaktoren) oder Querschnitt erhöhen, bis I_n ≤ I_z gilt.`;
}

/**
 * Zulässige Belastbarkeit I_z einer Leitung unter den Annahmen des Laufs.
 * `null`, wenn der Querschnitt fehlt oder nicht in der Tabelle steht.
 */
function ampacityOf(context: PassContext, cable: CableModel): ReturnType<typeof effectiveAmpacityA> | null {
  if (cable.crossSectionMm2 === null) return null;
  try {
    return effectiveAmpacityA(cable.crossSectionMm2, {
      ambientC: context.options.ampacity.ambientC,
      insulation: context.options.ampacity.insulation,
      bundledCircuits: bundledCircuitsFor(context, cable.edgeId),
    });
  } catch {
    return null;
  }
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

    if (ib > ampacity.izA + EPSILON_A) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          calculatedValue: ib,
          allowedLimit: ampacity.izA,
          unit: 'A',
          message: `Kabel ${label}: I_b = ${ib.toFixed(1)} A überschreitet die korrigierte Belastbarkeit I_z = ${ampacity.izA.toFixed(1)} A (Basis ${ampacity.baseAmpacityA} A × ${ampacity.combinedFactor.toFixed(3)}; f₁ = ${ampacity.ambientFactor.toFixed(3)}, f₂ = ${ampacity.groupingFactor.toFixed(3)}).`,
          autoFixRemedy: remedyForAmpacity(ib, cable.crossSectionMm2),
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

    if (ib > device.ratedCurrentA + EPSILON_A) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          calculatedValue: ib,
          allowedLimit: device.ratedCurrentA,
          unit: 'A',
          equation: 'I_b ≤ I_n ≤ I_z (hier: I_b > I_n)',
          message: `Kabel ${label}: Betriebsstrom I_b = ${ib.toFixed(1)} A liegt über dem Nennstrom I_n = ${device.ratedCurrentA} A des wirksamen Schutzorgans (${describeDevice(device)})${effective.host === 'node' ? ` im Bauteil „${labelOfNode(context.graph, effective.hostId)}“` : ` auf Leitung „${effective.hostId}“`}.`,
          autoFixRemedy: `Schutzorgan mit I_n ≥ ${ib.toFixed(1)} A einsetzen (Vorschlag ${selectFuseSize(ib, cable.crossSectionMm2)} A), sofern I_n ≤ I_z = ${ampacity.izA.toFixed(1)} A bleibt — sonst Querschnitt erhöhen.`,
        })
      );
    }

    if (device.ratedCurrentA > ampacity.izA + EPSILON_A) {
      events.push(
        auditEvent({
          ruleId,
          entity,
          calculatedValue: device.ratedCurrentA,
          allowedLimit: ampacity.izA,
          unit: 'A',
          equation: 'I_b ≤ I_n ≤ I_z (hier: I_n > I_z)',
          message: `Kabel ${label}: Nennstrom I_n = ${device.ratedCurrentA} A des Schutzorgans liegt über der Leitungsbelastbarkeit I_z = ${ampacity.izA.toFixed(1)} A.`,
          autoFixRemedy: remedyForFuseLargerThanAmpacity(cable.crossSectionMm2, ampacity.izA),
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
      .map((entry) => entry.placement)
      .filter((placement): placement is OvercurrentPlacement => isOvercurrentProtection(placement.device))
      .sort((a, b) => b.device.ratedCurrentA - a.device.ratedCurrentA)[0];
    if (!upstream) continue;

    const downstreamA = downstream.device.ratedCurrentA;
    const upstreamA = upstream.device.ratedCurrentA;
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
          autoFixRemedy: `Vorgelagertes Schutzorgan auf I_n ≥ ${(downstreamA * SELECTIVITY_RATIO_HEURISTIC).toFixed(1)} A erhöhen (Verhältnis ≥ ${SELECTIVITY_RATIO_HEURISTIC}:1) oder das nachgelagerte Organ verkleinern.`,
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
        message: `Kabel ${label}: Selektivität nicht belegt (${pair}) — Verhältnis ${ratio.toFixed(2)}:1 liegt unter ${SELECTIVITY_RATIO_HEURISTIC}:1.`,
        autoFixRemedy: `Vorgelagertes Schutzorgan auf ≥ ${(downstreamA * SELECTIVITY_RATIO_HEURISTIC).toFixed(1)} A vergrößern oder Hersteller-Selektivitätstabelle für dieses Paar nachweisen.`,
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
