/**
 * Auftrag Phase 12 (10–15) — Koordination, Modellgrenze, AC-Schutzkette,
 * Prüfzustände und Wiederholbarkeit.
 *
 *  10. Ib/In/Iz-Koordination über `evaluateCableProtection`.
 *  11. 70-mm²-Modellgrenze: kein stiller Rückfall, sondern `outside-model`.
 *  12. Größerer externer/importierter Querschnitt (> 70 mm²).
 *  13. FI auf dem Versorgungspfad ⇒ geschützt.
 *  14. FI fehlt auf dem Pfad ⇒ Befund.
 *  15. FI existiert woanders, schützt diesen Verbraucher aber nicht.
 *  +   Prüfzustände: keine Verletzung erscheint als Critical.
 */
import { describe, expect, it } from 'vitest';

import {
  MAX_MODELED_AMPACITY_A,
  MAX_MODELED_CROSS_SECTION_MM2,
  DERATE_FACTOR,
  VDE_AMPACITY,
  assessCableSelection,
  calculateCableIz,
  evaluateCableProtection,
  thermalCrossSectionFor,
} from '../electrical';
import { validationSeverityOf, validationStatusOf } from './events';
import { analyseAcProtectionChains } from './protection';
import { verifyPlan } from './pipeline';
import { fixtureEdge, fixtureNode, healthyDcPlan, withEdge, type FixturePlan } from './planFixtures';
import { verificationOptions, type PassContext } from './context';
import { buildConductionGraph } from './graph';
import type { AuditEvent } from './types';

function contextOf(plan: FixturePlan): PassContext {
  return {
    nodes: plan.nodes,
    edges: plan.edges,
    graph: buildConductionGraph(plan.nodes, plan.edges),
    options: verificationOptions(),
  };
}

const eventsOf = (report: ReturnType<typeof verifyPlan>, ruleId: string): AuditEvent[] =>
  report.events.filter((event) => event.ruleId === ruleId);

describe('Phase 12 (10) — Koordination I_b ≤ I_n ≤ I_z', () => {
  it('nennt jedes verletzte Teilstück einzeln und getrennt von Datenlücken', () => {
    const both = evaluateCableProtection({ ib: 158.73, in: 100, iz: 120.4 });
    expect(both.status).toBe('violated');
    expect(both.severity).toBe('critical');
    expect(both.violations).toEqual(['ib-over-iz', 'ib-over-in']);
    expect(both.explanation).toContain('158.7 A');

    const fuseTooLarge = evaluateCableProtection({ ib: 20, in: 100, iz: 120.4 });
    expect(fuseTooLarge.violations).toEqual([]);
    expect(fuseTooLarge.status).toBe('satisfied');

    const coordinationOnly = evaluateCableProtection({ ib: 20, in: 130, iz: 120.4 });
    expect(coordinationOnly.violations).toEqual(['in-over-iz']);
    expect(coordinationOnly.severity, 'I_n über I_z ist ein Fehler, keine Gefahr').toBe('error');

    const gap = evaluateCableProtection({ ib: null, in: 20, iz: 120.4 });
    expect(gap.status).toBe('incomplete');
    expect(gap.severity).toBe('info');
    expect(gap.violations).toEqual([]);
  });

  it('druckt die Kette nicht als erfüllte Soll-Form, wenn ein Teilstück widerlegt ist', () => {
    const violated = evaluateCableProtection({ ib: 158.73, in: 100, iz: 120.4 });
    // Vorher stand hier `I_b = 158.7 A ≤ I_n = 100.0 A ≤ I_z = 120.4 A` — eine
    // falsche Aussage, direkt gefolgt von „verletzt". Jetzt je Teilstück die
    // Relation, die wirklich gilt, mit Verdict.
    expect(violated.explanation).not.toContain('I_b = 158.7 A ≤ I_n');
    expect(violated.explanation).toContain('I_b = 158.7 A > I_n = 100.0 A ✗');
    expect(violated.explanation).toContain('I_n = 100.0 A ≤ I_z = 120.4 A ✓');

    const satisfied = evaluateCableProtection({ ib: 20, in: 100, iz: 120.4 });
    expect(satisfied.explanation).toContain('I_b = 20.0 A ≤ I_n = 100.0 A ✓');

    const noOrgan = evaluateCableProtection({ ib: 20, in: null, iz: 120.4 });
    expect(noOrgan.explanation).toContain('kein Schutzorgan bekannt');
    expect(noOrgan.explanation).toContain('I_b = 20.0 A ≤ I_z = 120.4 A ✓');

    const noCurrent = evaluateCableProtection({ ib: null, in: 20, iz: 120.4 });
    expect(noCurrent.explanation).toContain('?');
    expect(noCurrent.explanation).not.toContain('✗');
  });

  it('die Engine entscheidet dieselbe Ungleichung (kein zweiter Rechenweg)', () => {
    const plan = withEdge(healthyDcPlan(), 'e-fuse-load', { crossSection: 1.5, fuseSize: 16 });
    const report = verifyPlan({ nodes: plan.nodes, edges: plan.edges, options: { profile: 'CAMP_MODEL' } });
    const amp1 = eventsOf(report, 'AMP-001-ib-in-iz');
    const inOverIz = amp1.find((event) => event.equation.includes('I_n > I_z'));
    expect(inOverIz?.calculatedValue).toBe(16);
    expect(inOverIz?.allowedLimit).toBeCloseTo(11.55, 6);
    // Die Regelmatrix führt AMP-001 als sicherheitsrelevant — jede widerlegte
    // Verletzung dieser Regel bleibt deshalb `critical` (die Normsprache der
    // Regel ist maßgeblich, nicht die lokale Abstufung der Koordinationshilfe).
    // Die Koordinationshilfe selbst unterscheidet die Abstufung
    // (Test 10: „I_n > I_z ohne Überlast" ⇒ `error`).
    expect(validationSeverityOf(inOverIz as AuditEvent)).toBe('critical');
    expect(validationStatusOf(inOverIz as AuditEvent)).toBe('violated');
  });
});

describe('Phase 12 (11/12) — Modellgrenze der Belastbarkeitstabelle', () => {
  it('meldet oberhalb der größten Tabellenstufe `outside-model` statt „70 mm² genügt“', () => {
    const boundary = thermalCrossSectionFor(174.6);
    expect(boundary.status).toBe('outside-model');
    if (boundary.status !== 'outside-model') throw new Error('unerwartet');
    expect(boundary.maximumModeledCurrentA).toBeCloseTo(MAX_MODELED_AMPACITY_A * DERATE_FACTOR, 10);
    expect(boundary.requiredCurrentA).toBeCloseTo(174.6, 10);
    expect(MAX_MODELED_CROSS_SECTION_MM2).toBe(70);
  });

  it('innerhalb der Tabelle bleibt die Aussage konkret', () => {
    // 40 A ⇒ 40 / 0,7 = 57,1 A gefordert ⇒ 16 mm² (69 A) ist die kleinste Stufe.
    expect(thermalCrossSectionFor(40)).toEqual({ status: 'within-model', crossSectionMm2: 16 });
    // 60 A ⇒ 85,7 A gefordert ⇒ 25 mm² (90 A).
    expect(thermalCrossSectionFor(60)).toEqual({ status: 'within-model', crossSectionMm2: 25 });
    // 100 A ⇒ 142,9 A gefordert: die Reihe endet bei 172 A (70 mm²) — die
    // Aussage bleibt innerhalb des Modells, aber am Rand.
    expect(thermalCrossSectionFor(100)).toEqual({ status: 'within-model', crossSectionMm2: 70 });
  });

  it('`assessCableSelection` weist die Modellgrenze aus, statt eine Empfehlung zu behaupten', () => {
    const selection = assessCableSelection(174.6, 3, undefined, 'DC_12V');
    expect(selection.beyondModeledRange).toBe(true);
    expect(selection.requiredTableCurrentA).toBeCloseTo(174.6, 10);
    expect(selection.maximumModeledCurrentA).toBeCloseTo(120.4, 10);

    const normal = assessCableSelection(30, 5, undefined, 'DC_12V');
    expect(normal.beyondModeledRange).toBe(false);
    expect(normal.requiredTableCurrentA).toBeNull();
  });

  it('12 — ein importierter Querschnitt über 70 mm² bleibt erhalten und wird nicht auf 70 mm² gekürzt', () => {
    const selection = assessCableSelection(200, 2, 95, 'DC_12V');
    expect(selection.installedCrossSection).toBe(95);
    expect(selection.crossSectionIsStored).toBe(true);
    expect(selection.undersized).toBe(false);
    // 95 mm² kennt die Tabelle nicht: Die Aussage bleibt ausdrücklich offen.
    expect(selection.recommendedCrossSection).toBe(70);
  });

  it('12b — die Anzeige nennt den fehlenden Tabellenwert als Datenlücke (Info, nicht Critical)', () => {
    const report = verifyPlan({
      nodes: [
        fixtureNode('bat1', 'battery', {
          label: 'Aufbaubatterie',
          role: 'house',
          capacity: 200,
          chemistry: 'LiFePO4',
        }),
        fixtureNode('load1', 'consumer', { label: 'Großverbraucher', watts: 2100 }), // ≈ 175 A
      ],
      edges: [
        fixtureEdge('e-bat-load', 'bat1', 'plus', 'load1', 'plus', {
          crossSection: 70,
          length: 1,
          fuseSize: 100,
          fuseType: 'mega',
        }),
      ],
      options: undefined,
    } as Parameters<typeof verifyPlan>[0]);
    // Kein Critical für die Datenlücke (Querschnitt fehlt bei der Rückleitung
    // usw.) — entscheidend: die Überlast selbst wird als Verletzung gemeldet.
    const over = eventsOf(report, 'AMP-001-ib-in-iz').find((event) => event.kind === 'VIOLATION');
    expect(over).toBeDefined();
    expect(validationSeverityOf(over as AuditEvent)).toBe('critical');
    expect(validationStatusOf(over as AuditEvent)).toBe('violated');
  });
});

describe('Phase 12 (13/14/15) — AC-Schutzkette je Verbraucher', () => {
  /** Quelle → Verteiler → [FI/LS-Zweig | Zweig ohne FI] → Verbraucher. */
  const twoBranchPlan = (): FixturePlan => ({
    nodes: [
      fixtureNode('shore1', 'shorePower', {
        label: 'Landstrom',
        rating: 16,
        systemForm: 'TN-S',
        prospectiveIkA: 1500,
      }),
      fixtureNode('dist', 'busbar', { label: 'AC-Verteilung' }),
      fixtureNode('rcbo', 'fuse', { label: 'FI/LS-Zweig', rating: 10 }),
      fixtureNode('mcb2', 'fuse', { label: 'Zweig ohne FI', rating: 16 }),
      fixtureNode('load-protected', 'consumer230v', { label: 'Kaffeemaschine', watts: 800 }),
      fixtureNode('load-unprotected', 'consumer230v', { label: 'Kühlschrank 230 V', watts: 120 }),
    ],
    edges: [
      fixtureEdge('e-shore-dist', 'shore1', 'plus', 'dist', 'plus', {
        crossSection: 4,
        length: 3,
        edgeDomain: 'AC_230V',
        fuseSize: 16,
      }),
      fixtureEdge('e-dist-rcbo', 'dist', 'plus', 'rcbo', 'plus', {
        crossSection: 2.5,
        length: 0.5,
        edgeDomain: 'AC_230V',
        acProtection: { kind: 'rcbo', characteristic: 'B', breakingCapacityKA: 6 },
      }),
      fixtureEdge('e-rcbo-load', 'rcbo', 'plus', 'load-protected', 'plus', {
        crossSection: 1.5,
        length: 4,
        edgeDomain: 'AC_230V',
      }),
      fixtureEdge('e-dist-mcb2', 'dist', 'plus', 'mcb2', 'plus', {
        crossSection: 2.5,
        length: 0.5,
        edgeDomain: 'AC_230V',
        acProtection: { kind: 'mcb', characteristic: 'B', breakingCapacityKA: 6 },
      }),
      fixtureEdge('e-mcb2-load', 'mcb2', 'plus', 'load-unprotected', 'plus', {
        crossSection: 1.5,
        length: 4,
        edgeDomain: 'AC_230V',
      }),
    ],
  });

  it('13 — FI auf dem Versorgungspfad: der Verbraucher gilt als geschützt (mit IΔn)', () => {
    const chains = analyseAcProtectionChains(contextOf(twoBranchPlan()));
    const protectedChain = chains.find((chain) => chain.consumerId === 'load-protected');
    expect(protectedChain?.status).toBe('satisfied');
    expect(protectedChain?.rcdPresent).toBe(true);
    expect(protectedChain?.rcdResidualCurrent).toBeCloseTo(0.03, 10);
    expect(protectedChain?.sourceId).toBe('shore1');
    expect(protectedChain?.protectionChain).toContain('rcbo');
  });

  it('14 — FI fehlt auf dem Pfad: Befund mit Quelle, Pfad und Status', () => {
    const chains = analyseAcProtectionChains(contextOf(twoBranchPlan()));
    const unprotectedChain = chains.find((chain) => chain.consumerId === 'load-unprotected');
    expect(unprotectedChain?.status).toBe('violated');
    expect(unprotectedChain?.rcdPresent).toBe(false);
    expect(unprotectedChain?.rcdResidualCurrent).toBeNull();
    expect(unprotectedChain?.exampleUnprotectedPath).toEqual(['load-unprotected', 'mcb2', 'dist', 'shore1']);

    const report = verifyPlan({ nodes: twoBranchPlan().nodes, edges: twoBranchPlan().edges });
    const finding = eventsOf(report, 'RCD-001-rcd-deviation').find(
      (event) => event.entity.id === 'load-unprotected'
    );
    expect(finding?.kind).toBe('VIOLATION');
    expect(finding?.details?.sourceId).toBe('shore1');
    expect(finding?.details?.rcdPresent).toBe(false);
  });

  it('15 — ein FI existiert woanders, schützt diesen Verbraucher aber nicht', () => {
    const chains = analyseAcProtectionChains(contextOf(twoBranchPlan()));
    const unprotectedChain = chains.find((chain) => chain.consumerId === 'load-unprotected');
    expect(unprotectedChain?.rcdsElsewhere).toContain('e-dist-rcbo');
    // Der geschützte Kreis hat keinen „fremden“ FI.
    const protectedChain = chains.find((chain) => chain.consumerId === 'load-protected');
    expect(protectedChain?.rcdsElsewhere).toEqual([]);

    // RCD-003 meldet genau diesen Abzweig vor dem FI.
    const report = verifyPlan({ nodes: twoBranchPlan().nodes, edges: twoBranchPlan().edges });
    const positionFinding = eventsOf(report, 'RCD-003-rcd-position');
    expect(positionFinding.map((event) => event.entity.id)).toEqual(['load-unprotected']);
    expect(validationSeverityOf(positionFinding[0] as AuditEvent)).toBe('critical');
  });

  it('13b — ein FI am Einspeisepunkt (hasRcd) deckt jeden Kreis, wenn er auf dem Pfad liegt', () => {
    const plan = twoBranchPlan();
    plan.nodes = plan.nodes.map((node) =>
      node.id === 'shore1' ? { ...node, data: { ...node.data, hasRcd: true } } : node
    );
    const chains = analyseAcProtectionChains(contextOf(plan));
    expect(chains.every((chain) => chain.rcdPresent)).toBe(true);
    const report = verifyPlan({ nodes: plan.nodes, edges: plan.edges });
    expect(eventsOf(report, 'RCD-001-rcd-deviation')).toEqual([]);
  });
});

describe('Phase 12 — Prüfzustände (keine Datenlücke als Critical)', () => {
  it('UNVERIFIABLE ist info + incomplete, VIOLATION bleibt critical + violated', () => {
    const gapPlan: FixturePlan = withEdge(healthyDcPlan(), 'e-fuse-load', { crossSection: undefined });
    const report = verifyPlan({ nodes: gapPlan.nodes, edges: gapPlan.edges });
    const gap = eventsOf(report, 'AMP-001-ib-in-iz').find((event) => event.kind === 'UNVERIFIABLE');
    expect(gap).toBeDefined();
    expect(validationSeverityOf(gap as AuditEvent)).toBe('info');
    expect(validationStatusOf(gap as AuditEvent)).toBe('incomplete');

    expect(report.stateCounts.incomplete).toBeGreaterThan(0);
    expect(report.stateCounts.violated).toBe(0);
  });

  it('der Bericht zählt Zustände und Ursachen strukturiert (Phase 9/10)', () => {
    const plan = withEdge(healthyDcPlan(), 'e-fuse-load', { crossSection: 1.5, fuseSize: 16 });
    const report = verifyPlan({ nodes: plan.nodes, edges: plan.edges, options: { profile: 'CAMP_MODEL' } });
    expect(report.stateCounts.violated).toBeGreaterThan(0);
    expect(report.rootCauses.length).toBeGreaterThan(0);
    const cause = report.rootCauses.find((entry) => entry.affectedEdges.includes('e-fuse-load'));
    expect(cause).toBeDefined();
    // Einander gleichartige Befunde derselben Leitung teilen EINE Ursache.
    expect(cause?.rootCauseId).toMatch(
      /^(INVERTER-LOAD|BRANCH-LOAD|PROTECTION-COORDINATION|DATA-MISSING)-\d{3}$/
    );
    expect(
      report.events
        .filter((event) => event.entity.id === 'e-fuse-load')
        .some((event) => event.details?.rootCauseId === cause?.rootCauseId)
    ).toBe(true);
  });

  it('derselbe Plan ergibt bei jeder Prüfung exakt denselben Bericht (Hash + Zahlen)', () => {
    const plan = healthyDcPlan();
    const first = verifyPlan({ nodes: plan.nodes, edges: plan.edges });
    const second = verifyPlan({ nodes: plan.nodes, edges: plan.edges });
    expect(second.certificate.certificateHash).toBe(first.certificate.certificateHash);
    expect(second.certificate.planFingerprintHash).toBe(first.certificate.planFingerprintHash);
    expect(second.stateCounts).toEqual(first.stateCounts);
    expect(second.rootCauses.map((cause) => cause.rootCauseId)).toEqual(
      first.rootCauses.map((cause) => cause.rootCauseId)
    );
  });

  it('VDE_AMPACITY bleibt die Basis jeder Iz-Aussage (keine erfundenen neuen Größen)', () => {
    expect(calculateCableIz({ crossSectionMm2: 70 }).baseIz).toBe(VDE_AMPACITY[70]);
  });
});
