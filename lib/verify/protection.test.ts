import { describe, expect, it } from 'vitest';

import { verificationOptions, type PassContext } from './context';
import { buildConductionGraph } from './graph';
import {
  CHASSIS_BOND_MIN_MM2,
  MAX_RCD_RESIDUAL_CURRENT_A,
  checkChassisBond,
  checkIslandFaultLoop,
  checkLoopImpedance,
  checkPenForbidden,
  checkRcdCoverage,
  checkRcdPosition,
  checkRcdSelectivity,
  checkRcdType,
  checkTwoPoleSwitching,
  runPass5,
} from './protection';
import {
  fixtureEdge,
  fixtureNode,
  healthyDcPlan,
  islandPlan,
  shorePlan,
  withEdge,
  withoutEdge,
  type FixturePlan,
} from './planFixtures';
import type { CheckResult, ProtectionDevice } from './types';

function contextOf(plan: FixturePlan): PassContext {
  return {
    nodes: plan.nodes,
    edges: plan.edges,
    graph: buildConductionGraph(plan.nodes, plan.edges),
    options: verificationOptions(),
  };
}

const byRule = (checks: readonly CheckResult[], ruleId: string): CheckResult => {
  const check = checks.find((entry) => entry.ruleId === ruleId);
  if (!check) throw new Error(`Regel ${ruleId} nicht gelaufen`);
  return check;
};

/** Insel-Plan mit deklariertem N-PE-Bezug und/oder integriertem FI. */
function islandWith(data: Record<string, unknown>): FixturePlan {
  return {
    nodes: islandPlan().nodes.map((node) =>
      node.id === 'inv1'
        ? fixtureNode('inv1', 'inverter', { label: 'Wechselrichter', continuousPower: 1000, ...data })
        : node
    ),
    edges: islandPlan().edges,
  };
}

/** Landstrom-Plan mit veränderter Einspeisung und/oder Leitung. */
function shoreWith(node: Record<string, unknown>, edge: Record<string, unknown> = {}): FixturePlan {
  return {
    nodes: shorePlan().nodes.map((entry) =>
      entry.id === 'shore1' ? fixtureNode('shore1', 'shorePower', { label: 'Landstrom', ...node }) : entry
    ),
    edges: shorePlan().edges.map((entry) => ({ ...entry, data: { ...entry.data, ...edge } })),
  };
}

/**
 * Landstrom-Plan GANZ OHNE Fehlerstrom-Schutzeinrichtung: weder das
 * Quellenflag `hasRcd` noch ein FI-Organ auf der Leitung.
 */
function shoreWithoutAnyRcd(): FixturePlan {
  return {
    nodes: shorePlan().nodes.map((entry) =>
      entry.id === 'shore1'
        ? fixtureNode('shore1', 'shorePower', { label: 'Landstrom', rating: 16, systemForm: 'TN-S' })
        : entry
    ),
    edges: shorePlan().edges.map((entry) => ({ ...entry, data: { crossSection: 4, length: 3 } })),
  };
}

/**
 * Ergänzt ein FI-Organ auf einer AC-Leitung (Modelltest).
 *
 * Der Konduktionsgraph erzeugt FI/LS-Organe heute nur mit 30 mA Typ A aus dem
 * `acProtection`-Deskriptor. Andere Datenblattwerte (gröberer IΔn, Typ AC)
 * müssen die Regeln trotzdem bewerten — dieser Helfer stellt genau diese
 * Datenlage her, ohne einen zweiten Planer-Bauteiltyp zu erfinden.
 */
function addRcd(
  context: PassContext,
  edgeId: string,
  ratedResidualCurrentA: number,
  residualType: 'A' | 'AC' | 'B' = 'A'
): void {
  const cable = context.graph.cableById.get(edgeId);
  if (!cable) throw new Error(`Kabel ${edgeId} fehlt`);
  const device: ProtectionDevice = {
    type: 'rcd',
    ratedResidualCurrentA,
    residualType,
    poles: 2,
    selective: false,
  };
  Object.assign(cable, {
    protections: [
      ...cable.protections,
      { device, host: 'edge-data', hostId: edgeId, positionFromSourceM: null, assumedAtSource: true },
    ],
  });
}

describe('lib/verify/protection — Pass 5 auf dem gesunden 12-V-Plan', () => {
  it('führt alle neun Regeln und lässt nur GND-001 mit einer Entität laufen', () => {
    const checks = runPass5(contextOf(healthyDcPlan()));
    expect(checks.map((check) => check.ruleId)).toEqual([
      'GND-001-chassis-bond-cross-section',
      'RCD-001-rcd-deviation',
      'RCD-002-rcd-type',
      'RCD-003-rcd-position',
      'RCD-004-two-pole-switching',
      'RCD-005-loop-impedance',
      'RCD-006-rcd-selectivity',
      'NET-001-pen-forbidden',
      'NET-002-island-fault-loop',
    ]);
    for (const check of checks) {
      expect(check.status, check.ruleId).toBe('PASS');
      expect(check.events, check.ruleId).toEqual([]);
    }
    expect(byRule(checks, 'GND-001-chassis-bond-cross-section').evaluatedEntities).toBe(1);
    expect(byRule(checks, 'GND-001-chassis-bond-cross-section').status).toBe('PASS');
    // Ein reiner 12-V-Plan hat keinen 230-V-Stromkreis: die AC-Regeln sind
    // »nicht anwendbar« (n = 0), nicht »bestanden«.
    for (const ruleId of ['RCD-001-rcd-deviation', 'RCD-004-two-pole-switching', 'RCD-005-loop-impedance']) {
      expect(byRule(checks, ruleId).evaluatedEntities, ruleId).toBe(0);
    }
  });

  it('prüft die dokumentierten Grenzwerte', () => {
    expect(CHASSIS_BOND_MIN_MM2).toBe(16);
    expect(MAX_RCD_RESIDUAL_CURRENT_A).toBe(0.03);
  });
});

describe('lib/verify/protection — GND-001 (Masseanbindung)', () => {
  it('meldet FAIL bei 6 mm² und UNPROVABLE ohne Querschnitt', () => {
    const thin = checkChassisBond(contextOf(withEdge(healthyDcPlan(), 'e-bond', { crossSection: 6 })));
    expect(thin.status).toBe('FAIL');
    expect(thin.events[0]?.calculatedValue).toBe(6);
    expect(thin.events[0]?.allowedLimit).toBe(16);
    // Die 16 mm² sind Planungsvorgabe des Camp-Modells (Profil CAMP_MODEL),
    // keine Normklausel ⇒ CODE_VIOLATION, nicht CRITICAL_SAFETY.
    expect(thin.events[0]?.severity).toBe('CODE_VIOLATION');

    const unknown = checkChassisBond(
      contextOf(withEdge(healthyDcPlan(), 'e-bond', { crossSection: undefined }))
    );
    expect(unknown.status).toBe('UNPROVABLE');
    expect(unknown.events[0]?.kind).toBe('UNVERIFIABLE');
  });

  it('meldet keinen Befund, wenn gar keine Masseanbindung geplant ist (nicht anwendbar)', () => {
    const check = checkChassisBond(contextOf(withoutEdge(healthyDcPlan(), 'e-bond')));
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(0);
  });
});

describe('lib/verify/protection — RCD-001 (Fehlerstromschutz je 230-V-Stromkreis)', () => {
  it('besteht mit FI am Einspeisepunkt und mit FI auf der Leitung', () => {
    expect(checkRcdCoverage(contextOf(shorePlan())).status).toBe('PASS');
    // Auch der FI/LS AUF der Leitung deckt den Stromkreis: das Quellenflag
    // `hasRcd` ist nicht der einzige Nachweisweg.
    expect(checkRcdCoverage(contextOf(shoreWith({ hasRcd: false }))).status).toBe('PASS');
  });

  it('meldet jeden ungeschützten 230-V-Stromkreis als FAIL', () => {
    const withoutRcd = checkRcdCoverage(contextOf(shoreWithoutAnyRcd()));
    expect(withoutRcd.status).toBe('FAIL');
    expect(withoutRcd.evaluatedEntities).toBe(1);
    expect(withoutRcd.events[0]?.severity).toBe('CRITICAL_SAFETY');
    expect(withoutRcd.events[0]?.message).toContain('kein FI ≤ 30 mA');
    expect(withoutRcd.events[0]?.counterexample?.length).toBeGreaterThan(0);
  });

  it('meldet auf der Insel zwei ungeschützte Stromkreise, mit FI keinen', () => {
    const without = checkRcdCoverage(contextOf(islandPlan()));
    expect(without.status).toBe('FAIL');
    expect(without.evaluatedEntities).toBe(2);

    const withRcd = checkRcdCoverage(contextOf(islandWith({ hasRcd: true, neutralEarthBond: 'dynamic' })));
    expect(withRcd.status).toBe('PASS');
    expect(withRcd.evaluatedEntities).toBe(2);
  });
});

describe('lib/verify/protection — RCD-002 (FI-Typ)', () => {
  it('lässt den Plan ohne integrierten FI in Ruhe', () => {
    expect(checkRcdType(contextOf(islandPlan())).evaluatedEntities).toBe(0);
    expect(checkRcdType(contextOf(islandPlan())).status).toBe('PASS');
  });

  it('fordert beim integrierten Wechselrichter-FI den Typnachweis (UNPROVABLE, nicht PASS)', () => {
    const check = checkRcdType(contextOf(islandWith({ hasRcd: true, neutralEarthBond: 'dynamic' })));
    expect(check.status).toBe('UNPROVABLE');
    expect(check.evaluatedEntities).toBe(1);
    expect(check.events[0]?.kind).toBe('UNVERIFIABLE');
    expect(check.events[0]?.message).toContain('glatte Gleichfehlerströme');
  });
});

describe('lib/verify/protection — RCD-003 (kein Abzweig vor dem FI)', () => {
  it('zählt die geschützten Stromkreise, wenn der FI vorhanden ist', () => {
    const check = checkRcdPosition(contextOf(shorePlan()));
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBeGreaterThan(0);
  });

  it('ist ohne jeden FI nicht anwendbar — der Grundbefund kommt aus RCD-001', () => {
    const check = checkRcdPosition(contextOf(shoreWithoutAnyRcd()));
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(0);
  });
});

describe('lib/verify/protection — RCD-004 (zweipolige Abschaltung)', () => {
  it('bestätigt den zweipoligen FI/LS der Landstromleitung', () => {
    const check = checkTwoPoleSwitching(contextOf(shorePlan()));
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(2); // LS und FI des RCBO
  });

  it('meldet UNPROVABLE, wenn die Polzahl nicht deklariert ist', () => {
    const check = checkTwoPoleSwitching(
      contextOf(shoreWith({}, { acProtection: { kind: 'mcb', characteristic: 'B', breakingCapacityKA: 6 } }))
    );
    expect(check.status).toBe('UNPROVABLE');
    expect(check.events[0]?.kind).toBe('UNVERIFIABLE');
    expect(check.events[0]?.message).toContain('Polzahl');
  });

  it('meldet UNPROVABLE, wenn die Einspeiseleitung gar kein Schutzorgan führt', () => {
    const check = checkTwoPoleSwitching(
      contextOf(shoreWith({}, { fuseSize: undefined, acProtection: undefined }))
    );
    expect(check.status).toBe('UNPROVABLE');
    expect(check.events[0]?.message).toContain('kein Schutzorgan an der Einspeiseleitung');
  });
});

describe('lib/verify/protection — RCD-005 (Abschaltbedingung)', () => {
  it('ist auf der Insel nicht entscheidbar (strombegrenzter Wechselrichter-Ausgang)', () => {
    const check = checkLoopImpedance(contextOf(islandPlan()));
    expect(check.status).toBe('UNPROVABLE');
    expect(check.evaluatedEntities).toBe(2);
    expect(check.events.every((event) => event.message.includes('inverter-limited'))).toBe(true);
  });

  it('widerlegt eine zu lange dünne Leitung ohne FI', () => {
    const plan = shoreWith(
      { hasRcd: false, prospectiveIkA: 2000 },
      {
        crossSection: 1.5,
        length: 200,
        acProtection: { kind: 'mcb', characteristic: 'B', breakingCapacityKA: 6 },
      }
    );
    const check = checkLoopImpedance(contextOf(plan));
    expect(check.status).toBe('FAIL');
    expect(check.events[0]?.severity).toBe('CRITICAL_SAFETY');
    expect(check.events[0]?.message).toContain('Schleifenimpedanz');
  });

  it('meldet UNPROVABLE, wenn kein Schutzorgan deklariert ist', () => {
    const check = checkLoopImpedance(
      contextOf(shoreWith({}, { fuseSize: undefined, acProtection: undefined }))
    );
    expect(check.status).toBe('UNPROVABLE');
    expect(check.events[0]?.message).toContain('nicht prüfbar');
  });
});

describe('lib/verify/protection — RCD-006 (FI-Selektivität)', () => {
  it('ist auf der Landstromleitung ohne zweite FI-Stufe nicht anwendbar', () => {
    const check = checkRcdSelectivity(contextOf(shorePlan()));
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(0);
  });
});

describe('lib/verify/protection — NET-001 (PEN im Fahrzeug verboten)', () => {
  it('meldet TN-C als Befund und akzeptiert TN-S', () => {
    expect(checkPenForbidden(contextOf(shorePlan())).status).toBe('PASS');
    const tnc = checkPenForbidden(contextOf(shoreWith({ hasRcd: true, systemForm: 'TN-C' })));
    expect(tnc.status).toBe('FAIL');
    expect(tnc.events[0]?.severity).toBe('CRITICAL_SAFETY');
    expect(tnc.events[0]?.message).toContain('PEN');
  });
});

describe('lib/verify/protection — NET-002 (Fehlerstromkreis der Insel)', () => {
  it('meldet UNPROVABLE ohne N-PE-Angabe (kein stiller Freispruch)', () => {
    const check = checkIslandFaultLoop(contextOf(islandPlan()));
    expect(check.status).toBe('UNPROVABLE');
    expect(check.events[0]?.kind).toBe('UNVERIFIABLE');
    expect(check.events[0]?.message).toContain('N-PE');
  });

  it('meldet FAIL bei ausdrücklichem „never“ und PASS bei belegtem Bezug', () => {
    const never = checkIslandFaultLoop(contextOf(islandWith({ hasRcd: true, neutralEarthBond: 'never' })));
    expect(never.status).toBe('FAIL');
    expect(never.events[0]?.message).toContain('never');

    const always = checkIslandFaultLoop(contextOf(islandWith({ hasRcd: true, neutralEarthBond: 'always' })));
    expect(always.status).toBe('PASS');
    expect(always.evaluatedEntities).toBe(1);
  });

  it('bleibt ohne 230-V-Verbraucher nicht anwendbar', () => {
    const plan = islandPlan();
    const check = checkIslandFaultLoop(
      contextOf({
        nodes: plan.nodes.filter((node) => !node.id.startsWith('load230')),
        edges: plan.edges.filter((edge) => !edge.id.startsWith('e-inv-load')),
      })
    );
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(0);
  });

  it('bleibt UNPROVABLE, wenn der Wechselrichter nicht am Plan hängt', () => {
    const check = checkIslandFaultLoop(contextOf(withoutEdge(islandPlan(), 'e-bat-inv')));
    expect(check.status).toBe('UNPROVABLE');
    expect(check.evaluatedEntities).toBe(1);
  });
});

describe('lib/verify/protection — Datenlücken und Randfälle', () => {
  it('meldet einen 230-V-Stromkreis ohne Versorgungspfad als nicht entscheidbar', () => {
    // Ein 230-V-Verbraucher, der nur an einem anderen Verbraucher hängt:
    // Er hat AC-Ports, aber keinen Weg zur Einspeisung.
    const plan = shorePlan();
    plan.nodes = [
      ...plan.nodes,
      fixtureNode('verloren', 'consumer230v', { label: 'Verlorene Last', watts: 300, hours: 1 }),
    ];
    plan.edges = [
      ...plan.edges,
      fixtureEdge('e-verloren', 'load230', 'plus', 'verloren', 'plus', { crossSection: 2.5, length: 1 }),
    ];
    const check = checkRcdCoverage(contextOf(plan));
    expect(check.status).toBe('UNPROVABLE');
    expect(check.events[0]?.kind).toBe('UNVERIFIABLE');
    expect(check.events[0]?.message).toContain('kein Versorgungspfad');
  });

  it('meldet einen FI über 30 mA als CRITICAL_SAFETY', () => {
    // Der Konduktionsgraph modelliert FI/LS mit 30 mA; ein gröberer FI kommt
    // aus dem Datenblatt des konkreten Geräts (Modelltest des Regelzweigs).
    const context = contextOf(shorePlan());
    addRcd(context, 'e-shore-load', 0.3);
    const check = checkRcdCoverage(context);
    expect(check.status).toBe('FAIL');
    const overLimit = check.events.find((event) => event.unit === 'mA');
    expect(overLimit?.calculatedValue).toBe(300);
    expect(overLimit?.allowedLimit).toBe(30);
    expect(overLimit?.severity).toBe('CRITICAL_SAFETY');
  });

  it('ist ohne Verbraucher im Inselnetz nicht anwendbar', () => {
    const plan = islandPlan();
    const islandOnly = {
      nodes: plan.nodes.filter((node) => !node.id.startsWith('load230')),
      edges: plan.edges.filter((edge) => !edge.id.startsWith('e-inv-load')),
    };
    const check = checkRcdType(contextOf(islandOnly));
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(0);
  });

  it('meldet einen FI vom Typ AC im Inselnetz als unzureichend', () => {
    const context = contextOf(islandWith({ neutralEarthBond: 'dynamic' }));
    addRcd(context, 'e-inv-load-a', 0.03, 'AC');
    const check = checkRcdType(context);
    expect(check.status).toBe('FAIL');
    expect(check.events[0]?.severity).toBe('CRITICAL_SAFETY');
    expect(check.events[0]?.message).toContain('Typ AC');
  });

  it('meldet ein einpoliges Einspeise-Schutzorgan als Befund', () => {
    const context = contextOf(shorePlan());
    for (const placement of context.graph.cableById.get('e-shore-load')?.protections ?? []) {
      if (placement.device.type === 'mcb') Object.assign(placement.device, { poles: 1 });
    }
    const check = checkTwoPoleSwitching(context);
    expect(check.status).toBe('FAIL');
    expect(check.events[0]?.calculatedValue).toBe(1);
    expect(check.events[0]?.allowedLimit).toBe(2);
  });

  it('verlangt eine deklarierte Netzform (TT ⇒ UNPROVABLE, TN-C ⇒ FAIL)', () => {
    const tt = checkPenForbidden(contextOf(shoreWith({ hasRcd: true, systemForm: 'TT' })));
    expect(tt.status).toBe('UNPROVABLE');
    expect(tt.events[0]?.kind).toBe('UNVERIFIABLE');
    expect(tt.events[0]?.message).toContain('TT');

    const unknown = checkPenForbidden(contextOf(shoreWith({ hasRcd: true, systemForm: undefined })));
    expect(unknown.status).toBe('UNPROVABLE');
    expect(unknown.events[0]?.message).toContain('nicht deklariert');
  });

  it('meldet einen vorhandenen N-PE-Bezug ohne FI im Inselnetz', () => {
    const check = checkIslandFaultLoop(contextOf(islandWith({ hasRcd: false, neutralEarthBond: 'always' })));
    expect(check.status).toBe('FAIL');
    expect(check.events[0]?.severity).toBe('CRITICAL_SAFETY');
    expect(check.events[0]?.message).toContain('kein FI ≤ 30 mA');
  });

  it('meldet einen FI ohne Selektivitätsnachweis in der Kaskade nicht doppelt', () => {
    // Ein einzelner FI hat keine zweite Stufe über sich — RCD-006 bleibt ohne
    // Eingabe, und der Befund der Landstromleitung kommt aus RCD-004.
    const context = contextOf(shorePlan());
    const check = checkRcdSelectivity(context);
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(0);
  });
});
