import { describe, expect, it } from 'vitest';

import { verificationOptions, type PassContext } from './context';
import { buildConductionGraph } from './graph';
import {
  I2_IZ_FACTOR,
  checkConduitFill,
  checkBreakingCapacity,
  checkIbInIz,
  checkI2VsIz,
  checkSelectivity,
  checkSourceProtectionPosition,
  conduitFillOutcome,
  runPass3,
} from './ampacity';
import {
  fixtureEdge,
  fixtureNode,
  healthyDcPlan,
  withEdge,
  withoutEdge,
  type FixturePlan,
} from './planFixtures';
import type { CheckResult } from './types';

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

const basePlan = (): FixturePlan => healthyDcPlan();

const withLoadWatts = (plan: FixturePlan, watts: number): FixturePlan => ({
  nodes: plan.nodes.map((node) =>
    node.id === 'load1' ? fixtureNode('load1', 'consumer', { label: 'Kühlbox', watts, hours: 4 }) : node
  ),
  edges: [...plan.edges],
});

describe('lib/verify/ampacity — der gesunde Plan besteht alle sechs Prüfungen', () => {
  it('meldet keine Befunde und zählt die betrachteten Entitäten', () => {
    const checks = runPass3(contextOf(basePlan()));
    expect(checks.map((check) => check.ruleId)).toEqual([
      'AMP-001-ib-in-iz',
      'AMP-002-i2-vs-iz',
      'AMP-003-source-protection-position',
      'AMP-004-breaking-capacity',
      'AMP-005-selectivity',
      'AMP-006-conduit-fill',
    ]);
    for (const check of checks) {
      if (check.ruleId === 'AMP-006-conduit-fill') continue; // kein Leerrohr im Plan
      expect(check.status, check.ruleId).toBe('PASS');
      expect(check.events, check.ruleId).toEqual([]);
      expect(check.evaluatedEntities, check.ruleId).toBeGreaterThan(0);
    }
    expect(byRule(checks, 'AMP-006-conduit-fill').evaluatedEntities).toBe(0);
  });
});

describe('lib/verify/ampacity — AMP-001 (I_b ≤ I_n ≤ I_z)', () => {
  it('meldet I_b > I_n, wenn die Last über dem wirksamen Schutzorgan liegt', () => {
    const check = checkIbInIz(contextOf(withLoadWatts(basePlan(), 500)));
    expect(check.status).toBe('FAIL');
    expect(check.events.length).toBeGreaterThan(0);
    for (const event of check.events) {
      expect(event.ruleId).toBe('AMP-001-ib-in-iz');
      expect(event.autoFixRemedy.length).toBeGreaterThan(10);
      expect(event.equation.length).toBeGreaterThan(3);
    }
    const event = check.events[0];
    // Der Betriebsstrom kommt aus `calculateEdgeCurrent` (der einen
    // Stromrechnung des Repos) — hier 500 W / 12 V Auslegungsspannung.
    expect(event?.calculatedValue).toBeCloseTo(500 / 12, 1);
    expect(event?.allowedLimit).toBe(20);
    expect(event?.unit).toBe('A');
  });

  it('meldet I_n > I_z, wenn das Schutzorgan die Leitung nicht mehr schützt', () => {
    const plan = withEdge(basePlan(), 'e-fuse-load', { crossSection: 1.5, fuseSize: 16 });
    const checks = runPass3(contextOf(plan));
    const amp1 = byRule(checks, 'AMP-001-ib-in-iz');
    expect(amp1.status).toBe('FAIL');
    expect(amp1.events.some((event) => event.equation.includes('I_n > I_z'))).toBe(true);
    const event = amp1.events.find((entry) => entry.equation.includes('I_n > I_z'));
    expect(event?.calculatedValue).toBe(16);
    // I_z = 16,5 A (Tabellenwert) × 0,7 (Planer-Pauschale) = 11,55 A
    expect(event?.allowedLimit).toBeCloseTo(11.55, 6);
  });

  it('meldet UNPROVABLE, wenn Querschnitt, Strom oder Schutzorgan fehlen', () => {
    const noSection = withEdge(basePlan(), 'e-fuse-load', { crossSection: undefined });
    expect(checkIbInIz(contextOf(noSection)).status).toBe('UNPROVABLE');

    const noCurrent = withLoadWatts({ nodes: basePlan().nodes, edges: basePlan().edges }, Number.NaN);
    expect(checkIbInIz(contextOf(noCurrent)).status).toBe('UNPROVABLE');

    // Ohne Sicherung auf der Leitung schützt das vorgelagerte Knoten-Organ —
    // erst ein Plan ganz OHNE Schutzorgan ist UNPROVABLE.
    expect(withEdge(basePlan(), 'e-fuse-load', { fuseSize: undefined }).edges.length).toBe(5);
    const unprotected: FixturePlan = {
      nodes: [
        fixtureNode('bat1', 'battery', {
          label: 'Batterie',
          role: 'house',
          capacity: 200,
          chemistry: 'LiFePO4',
        }),
        fixtureNode('load1', 'consumer', { label: 'Kühlbox', watts: 100, hours: 4 }),
      ],
      edges: [
        fixtureEdge('e-plus', 'bat1', 'plus', 'load1', 'plus', { crossSection: 4, length: 2 }),
        fixtureEdge('e-minus', 'load1', 'minus', 'bat1', 'minus', { crossSection: 4, length: 2 }),
      ],
    };
    const check = checkIbInIz(contextOf(unprotected));
    expect(check.status).toBe('UNPROVABLE');
    expect(check.events[0]?.kind).toBe('UNVERIFIABLE');
    expect(check.events[0]?.message).toContain('kein Überstrom-Schutzorgan');
  });
});

describe('lib/verify/ampacity — AMP-002 (I_2 ≤ 1,45 · I_z)', () => {
  it('belegt I_2 aus der Produktnorm und rechnet 1,45 · I_z', () => {
    const plan = withEdge(basePlan(), 'e-fuse-load', { crossSection: 1.5, fuseSize: 16 });
    const check = checkI2VsIz(contextOf(plan));
    expect(check.status).toBe('FAIL');
    const event = check.events.find((entry) => entry.message.includes('I_2'));
    expect(event?.calculatedValue).toBeCloseTo(1.35 * 16, 6);
    expect(event?.allowedLimit).toBeCloseTo(I2_IZ_FACTOR * 16.5 * 0.7, 6);
  });

  it('meldet UNPROVABLE, wenn die Bauform keinen I_2-Wert belegt (Bolzensicherung)', () => {
    const plan = withEdge(basePlan(), 'e-fuse-load', { fuseType: 'midi' });
    const check = checkI2VsIz(contextOf(plan));
    expect(check.status).toBe('UNPROVABLE');
    expect(check.events[0]?.kind).toBe('UNVERIFIABLE');
    expect(check.events[0]?.message).toContain('nicht belegt');
  });
});

describe('lib/verify/ampacity — AMP-003 (0,2 m ab Quelle)', () => {
  it('akzeptiert ein Schutzorgan am Pol und den Abstand 150 mm', () => {
    const check = checkSourceProtectionPosition(contextOf(basePlan()));
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(1);
  });

  it('meldet einen zu weit entfernten Einbauort und eine ganz fehlende Sicherung', () => {
    const far = checkSourceProtectionPosition(
      contextOf(withEdge(basePlan(), 'e-bat-fuse', { fuseOffset: 0.6 }))
    );
    expect(far.status).toBe('FAIL');
    expect(far.events[0]?.calculatedValue).toBeCloseTo(0.6, 6);
    expect(far.events[0]?.allowedLimit).toBeCloseTo(0.2, 6);

    const unprotected = checkSourceProtectionPosition(
      contextOf(withEdge(basePlan(), 'e-bat-fuse', { fuseSize: undefined, fuseType: undefined }))
    );
    expect(unprotected.status).toBe('FAIL');
    expect(unprotected.events[0]?.message).toContain('ohne Schutzorgan');
  });

  it('meldet UNPROVABLE, wenn die Länge fehlt (die Aussage hinge an einer Annahme)', () => {
    const plan = withEdge(basePlan(), 'e-bat-fuse', {
      fuseSize: undefined,
      fuseType: undefined,
      length: undefined,
    });
    const check = checkSourceProtectionPosition(contextOf(plan));
    expect(check.status).toBe('UNPROVABLE');
    expect(check.events[0]?.kind).toBe('UNVERIFIABLE');
  });
});

describe('lib/verify/ampacity — AMP-004 (Abschaltvermögen)', () => {
  it('rechnet den prospektiven Kurzschlussstrom am Einbauort gegen die Tabelle', () => {
    const check = checkBreakingCapacity(contextOf(basePlan()));
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBeGreaterThan(0);
  });

  it('meldet FAIL, wenn die Batterie mehr liefern kann als die Sicherung beherrscht', () => {
    const plan = basePlan();
    plan.nodes = plan.nodes.map((node) =>
      node.id === 'bat1' ? { ...node, data: { ...node.data, internalResistance: 5 } } : node
    );
    const check = checkBreakingCapacity(contextOf(plan));
    expect(check.status).toBe('FAIL');
    const event = check.events[0];
    expect(event?.calculatedValue).toBe(1000); // ATO-Tabelle
    expect(event?.allowedLimit).toBeGreaterThan(2000);
  });

  it('meldet UNPROVABLE ohne Quellenmodell (weder Innenwiderstand noch Kapazität/Chemie)', () => {
    const plan = basePlan();
    plan.nodes = plan.nodes.map((node) =>
      node.id === 'bat1' ? fixtureNode('bat1', 'battery', { label: 'Batterie', role: 'house' }) : node
    );
    const check = checkBreakingCapacity(contextOf(plan));
    expect(check.status).toBe('UNPROVABLE');
    expect(check.events[0]?.kind).toBe('UNVERIFIABLE');
  });
});

describe('lib/verify/ampacity — AMP-005 (Selektivität)', () => {
  it('akzeptiert das Verhältnis 2:1 (20 A vorgelagert, 10 A nachgelagert)', () => {
    const check = checkSelectivity(contextOf(basePlan()));
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(1);
  });

  it('meldet FAIL beim Verhältnis 1,25:1 und nennt beide Geräte', () => {
    const plan = withEdge(basePlan(), 'e-fuse-load', { fuseSize: 16 });
    const check = checkSelectivity(contextOf(plan));
    expect(check.status).toBe('FAIL');
    const event = check.events[0];
    expect(event?.calculatedValue).toBeCloseTo(1.25, 6);
    expect(event?.allowedLimit).toBeCloseTo(1.6, 6);
    expect(event?.message).toContain('20 A');
    expect(event?.message).toContain('16 A');
  });

  it('meldet UNPROVABLE, wenn das vorgelagerte Organ unter 16 A liegt (Heuristik nicht anwendbar)', () => {
    const plan: FixturePlan = {
      nodes: [
        fixtureNode('bat1', 'battery', {
          label: 'Batterie',
          role: 'house',
          capacity: 200,
          chemistry: 'LiFePO4',
          internalResistance: 15,
        }),
        fixtureNode('f1', 'fuse', { label: 'Hauptsicherung', rating: 10, fuseType: 'ato' }),
        fixtureNode('load1', 'consumer', { label: 'Kühlbox', watts: 10, hours: 4 }),
      ],
      edges: [
        fixtureEdge('e1', 'bat1', 'plus', 'f1', 'plus', { crossSection: 2.5, length: 0.15 }),
        fixtureEdge('e2', 'f1', 'plus', 'load1', 'plus', {
          crossSection: 1.5,
          length: 2,
          fuseSize: 6,
          fuseType: 'ato',
        }),
      ],
    };
    const check = checkSelectivity(contextOf(plan));
    expect(check.status).toBe('UNPROVABLE');
    expect(check.events[0]?.kind).toBe('UNVERIFIABLE');
    expect(check.events[0]?.message).toContain('1,6:1');
  });
});

describe('lib/verify/ampacity — AMP-006 (Leerrohr-Füllgrad)', () => {
  const withConduit = (type: string, assignedEdges: string[], crossSectionless = false): FixturePlan => {
    const plan = basePlan();
    plan.nodes = [
      ...plan.nodes,
      fixtureNode('k1', 'conduit', { label: 'Leerrohr', conduitType: type, assignedEdges }),
    ];
    if (crossSectionless) {
      plan.edges = plan.edges.map((edge) =>
        assignedEdges.includes(edge.id) ? { ...edge, data: { ...edge.data, crossSection: undefined } } : edge
      );
    }
    return plan;
  };

  it('meldet den überfüllten Kanal mit Füllgrad und Grenzwert', () => {
    const plan = withConduit('EN 20', ['e-bat-fuse', 'e-fuse-load', 'e-bat-shunt', 'e-shunt-load', 'e-bond']);
    const check = checkConduitFill(contextOf(plan));
    expect(check.status).toBe('FAIL');
    expect(check.events[0]?.calculatedValue).toBeGreaterThan(40);
    expect(check.events[0]?.allowedLimit).toBe(40);
    expect(check.events[0]?.unit).toBe('%');
  });

  it('lässt ein ausreichend dimensioniertes Rohr passieren', () => {
    const check = checkConduitFill(contextOf(withConduit('EN 40', ['e-fuse-load'])));
    expect(check.status).toBe('PASS');
    expect(check.events).toEqual([]);
  });

  it('meldet UNPROVABLE bei unbekanntem Rohrtyp und bei fehlendem Querschnitt', () => {
    const unknown = checkConduitFill(contextOf(withConduit('M20', ['e-fuse-load'])));
    expect(unknown.status).toBe('UNPROVABLE');
    expect(unknown.events[0]?.message).toContain('M20');

    const missing = checkConduitFill(contextOf(withConduit('EN 40', ['e-fuse-load'], true)));
    expect(missing.status).toBe('UNPROVABLE');
    expect(missing.events[0]?.message).toContain('Querschnitt');
  });

  it('ist ohne Leerrohr »nicht anwendbar« (nicht bestanden)', () => {
    const check = checkConduitFill(contextOf(basePlan()));
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(0);
  });
});

describe('lib/verify/ampacity — Robustheit', () => {
  it('läuft auch auf einem leeren Plan ohne Befund', () => {
    const checks = runPass3(contextOf({ nodes: [], edges: [] }));
    expect(checks).toHaveLength(6);
    for (const check of checks) {
      expect(check.events, check.ruleId).toEqual([]);
      expect(check.evaluatedEntities, check.ruleId).toBe(0);
    }
  });

  it('bleibt auf einem Plan ohne Quelle deterministisch', () => {
    const plan = withoutEdge(basePlan(), 'e-bat-fuse');
    const first = JSON.stringify(runPass3(contextOf(plan)));
    const second = JSON.stringify(runPass3(contextOf(plan)));
    expect(first).toBe(second);
  });
});

describe('lib/verify/ampacity — Datenlücken und Randfälle', () => {
  it('meldet einen Querschnitt ohne Tabellenwert als nicht bewertbar', () => {
    const checks = runPass3(contextOf(withEdge(basePlan(), 'e-fuse-load', { crossSection: 2.7 })));
    const amp1 = byRule(checks, 'AMP-001-ib-in-iz');
    expect(amp1.status).toBe('UNPROVABLE');
    expect(amp1.events.some((event) => event.message.includes('Belastbarkeitstabelle'))).toBe(true);

    const amp2 = byRule(checks, 'AMP-002-i2-vs-iz');
    expect(amp2.status).toBe('UNPROVABLE');
    expect(amp2.events.some((event) => event.message.includes('I_z nicht bestimmbar'))).toBe(true);
  });

  it('meldet einen Verbraucher ohne jede Leistungsangabe als UNPROVABLE, nicht als 0 A', () => {
    const plan: FixturePlan = {
      nodes: basePlan().nodes.map((node) => (node.id === 'load1' ? fixtureNode('load1', 'consumer') : node)),
      edges: basePlan().edges,
    };
    const amp1 = checkIbInIz(contextOf(plan));
    expect(amp1.status).toBe('UNPROVABLE');
    expect(
      amp1.events.some((event) => event.message.includes('Betriebsstrom I_b ist nicht bestimmbar'))
    ).toBe(true);
  });

  it('schlägt beim letzten Normquerschnitt keinen größeren mehr vor', () => {
    // 70 mm² ist der größte Eintrag BEIDER Tabellen: Die Abhilfe kann nur
    // noch den Strom senken — ein „nächster Normquerschnitt“ existiert nicht.
    const plan = withEdge(withLoadWatts(basePlan(), 2000), 'e-fuse-load', { crossSection: 70, length: 3 });
    const amp1 = checkIbInIz(contextOf(plan));
    const overload = amp1.events.find(
      (event) =>
        event.message.includes('überschreitet die korrigierte Belastbarkeit') &&
        typeof event.allowedLimit === 'number' &&
        Math.abs(event.allowedLimit - 172 * 0.7) < 1e-6
    );
    expect(overload).toBeDefined();
    expect(overload?.allowedLimit).toBeCloseTo(172 * 0.7, 6);
    expect(overload?.autoFixRemedy).not.toContain('mm² erhöhen');
  });

  it('unterscheidet fehlende Kabelzuordnung von einer Zuordnung ins Leere', () => {
    const withoutAssignment = basePlan();
    withoutAssignment.nodes = [
      ...withoutAssignment.nodes,
      fixtureNode('k1', 'conduit', { label: 'Leerrohr', conduitType: 'EN 40' }),
    ];
    const missing = checkConduitFill(contextOf(withoutAssignment));
    expect(missing.status).toBe('UNPROVABLE');
    expect(missing.events[0]?.message).toContain('keine Kabelzuordnung');

    const ghost = basePlan();
    ghost.nodes = [
      ...ghost.nodes,
      fixtureNode('k2', 'conduit', {
        label: 'Leerrohr',
        conduitType: 'EN 40',
        assignedEdges: ['gibt-es-nicht', 'e-fuse-load'],
      }),
    ];
    const ignored = checkConduitFill(contextOf(ghost));
    expect(ignored.status).toBe('PASS');
    expect(ignored.evaluatedEntities).toBe(1);
  });

  it('entscheidet Selektivität über die Schmelzintegrale, wenn beide Seiten Daten liefern', () => {
    // Der Konduktionsgraph liest I²t heute nicht aus Bauteildaten; der Regel-
    // zweig greift, sobald ein Organ die Werte mitbringt (Datenblattfelder).
    const context = contextOf(basePlan());
    // Alle Schutzorgane des Modells tragen die Datenblattwerte (Kabel UND
    // Knoten): Die vorgelagerte Seite ist das Organ der Zuleitung.
    const patchAll = (values: Record<string, number>): void => {
      for (const cable of context.graph.cables) {
        for (const placement of cable.protections) {
          Object.assign(placement.device as unknown as Record<string, number>, values);
        }
      }
      for (const component of context.graph.components.values()) {
        if (component.behavior.kind !== 'PROTECTION') continue;
        Object.assign(component.behavior.device as unknown as Record<string, number>, values);
      }
    };

    patchAll({ preArcingI2tA2s: 500, clearingI2tA2s: 50 });
    const selective = checkSelectivity(context);
    expect(selective.status).toBe('PASS');
    expect(selective.events).toEqual([]);

    patchAll({ clearingI2tA2s: 900 });
    const notSelective = checkSelectivity(context);
    expect(notSelective.status).toBe('FAIL');
    expect(notSelective.events[0]?.message).toContain('Schmelzintegral');
  });

  it('meldet ein kleineres vorgelagertes Organ als nicht selektiv', () => {
    const cascade: FixturePlan = {
      nodes: [
        fixtureNode('bat1', 'battery', {
          label: 'Batterie',
          role: 'house',
          capacity: 200,
          chemistry: 'LiFePO4',
        }),
        fixtureNode('b1', 'busbar', { label: 'Schiene' }),
        fixtureNode('load1', 'consumer', { label: 'Kühlbox', watts: 100, hours: 4 }),
      ],
      edges: [
        fixtureEdge('e1', 'bat1', 'plus', 'b1', 'plus', {
          crossSection: 4,
          length: 0.2,
          fuseSize: 10,
          fuseType: 'ato',
        }),
        fixtureEdge('e2', 'b1', 'plus', 'load1', 'plus', {
          crossSection: 4,
          length: 2,
          fuseSize: 20,
          fuseType: 'ato',
        }),
      ],
    };
    const check = checkSelectivity(contextOf(cascade));
    expect(check.status).toBe('FAIL');
    expect(check.events[0]?.message).toContain('KLEINER als das nachgelagerte');
    expect(check.events[0]?.calculatedValue).toBe(10);
    expect(check.events[0]?.allowedLimit).toBe(20);
  });

  /** 100 A / 100 A auf derselben Stufe — die Kaskade aus dem Prüfbericht. */
  const equalCascade = (upstreamCrossSection: number): FixturePlan => ({
    nodes: [
      fixtureNode('bat1', 'battery', {
        label: 'Batterie',
        role: 'house',
        capacity: 200,
        chemistry: 'LiFePO4',
      }),
      fixtureNode('b1', 'busbar', { label: 'Schiene' }),
      fixtureNode('load1', 'consumer', { label: 'Kühlbox', watts: 100, hours: 4 }),
    ],
    edges: [
      fixtureEdge('e1', 'bat1', 'plus', 'b1', 'plus', {
        crossSection: upstreamCrossSection,
        length: 0.3,
        fuseSize: 100,
        fuseType: 'ato',
      }),
      fixtureEdge('e2', 'b1', 'plus', 'load1', 'plus', {
        crossSection: 4,
        length: 2,
        fuseSize: 100,
        fuseType: 'ato',
      }),
    ],
  });

  it('kappt die Selektivitäts-Vorgabe an der Belastbarkeit der vorgelagerten Leitung', () => {
    // Vorgelagert: 100 A auf 70 mm² (I_z = 120,4 A ⇒ Sicherungsstufe max. 100 A).
    // Nötig für 1,6:1 wären 160 A — das ist derselbe AMP-001-Befund (I_n > I_z),
    // den der Nutzer für diese Leitung schon im Report hat. Die alte Fassung
    // schlug genau das vor: „auf ≥ 160,0 A vergrößern".
    const check = checkSelectivity(contextOf(equalCascade(70)));
    expect(check.status).toBe('FAIL');
    const remedy = check.events[0]?.autoFixRemedy ?? '';
    // 160 A dürfen GENANNT werden (so viel wäre nötig) — aber nicht als Vorgabe:
    // „auf ≥ 160 A vergrößern/erhöhen" war der selbstzerstörende Altvorschlag.
    expect(remedy).not.toMatch(/auf (I_n )?≥ 160,0 A (vergrößern|erhöhen)/);
    expect(remedy).toContain('≥ 160,0 A wären für das Verhältnis 1,6:1 nötig');
    expect(remedy).toContain('höchstens 100 A');
    expect(remedy).toContain('AMP-001');
    expect(remedy).toContain('nachgelagerte Organ auf ≤ 62,5 A');
    // Deutsches Dezimaltrennzeichen auch im Verhältnis (vorher „1.00:1 … 1.6:1").
    expect(check.events[0]?.message).toContain('1,00:1 liegt unter 1,6:1');
  });

  it('schlägt die Vergrößerung vor, wenn die vorgelagerte Leitung sie trägt', () => {
    // 100 A nachgelagert, vorgelagert auf 95 mm²: 95 mm² steht nicht in
    // VDE_AMPACITY ⇒ I_z nicht bestimmbar ⇒ die Grenze ist UNBEKANNT und wird
    // nicht erfunden; die Vorgabe bleibt die reine Verhältnisrechnung.
    const unknown = checkSelectivity(contextOf(equalCascade(95)));
    expect(unknown.events[0]?.autoFixRemedy).toContain('I_n ≥ 160,0 A');
    expect(unknown.events[0]?.autoFixRemedy).toContain('nicht zugeordnet');
  });

  it('prüft die Belastbarkeitsgrenze nicht mit, wenn das Organ ein Knoten ist', () => {
    // Ein Sicherungskasten als vorgelagerter KNOTEN hat keine Leitung, die ihm
    // zugeordnet wäre — keine erfundene Grenze, aber die Ansage, dass I_n ≤ I_z
    // der Zuleitung gesondert nachzuweisen ist.
    const cascade: FixturePlan = {
      nodes: [
        fixtureNode('bat1', 'battery', {
          label: 'Batterie',
          role: 'house',
          capacity: 200,
          chemistry: 'LiFePO4',
        }),
        fixtureNode('fuse1', 'fuse', { label: 'Sicherungskasten', rating: 20, fuseType: 'ato' }),
        fixtureNode('load1', 'consumer', { label: 'Kühlbox', watts: 100, hours: 4 }),
      ],
      edges: [
        fixtureEdge('e1', 'bat1', 'plus', 'fuse1', 'plus', { crossSection: 16, length: 0.3 }),
        fixtureEdge('e2', 'fuse1', 'plus', 'load1', 'plus', {
          crossSection: 4,
          length: 2,
          fuseSize: 20,
          fuseType: 'ato',
        }),
      ],
    };
    const check = checkSelectivity(contextOf(cascade));
    expect(check.status).toBe('FAIL');
    const remedy = check.events[0]?.autoFixRemedy ?? '';
    expect(remedy).toContain('I_n ≥ 32,0 A');
    expect(remedy).toContain('nicht zugeordnet');
    expect(remedy).toContain('gesondert nachzuweisen');
  });
});

/**
 * Abhilfe-Texte bei thermischer Sättigung (AUDIT ELE-002).
 *
 * Der Befund selbst ist korrekt — 1500–2000 W am 12-V-Strang sprengen die
 * Normreihe, die bei 70 mm² endet. Was vorher nicht stimmte, war die Vorgabe:
 * Sie nannte keinen Zielwert, keinen der drei Auswege (Parallelleitung /
 * höhere Systemspannung / Lastverlagerung) und empfahl bei I_n > I_z eine
 * Sicherung UNTER dem Betriebsstrom — also das Brechen derselben Bedingung (1)
 * des §433.1, die die Karte gerade prüft.
 */
describe('lib/verify/ampacity — Abhilfe bei thermischer Sättigung', () => {
  /** 70 mm², 2000 W am 12-V-Strang: I_b = 166,7 A > I_z = 120,4 A, Sicherung 160 A. */
  const saturatedPlan = (): FixturePlan =>
    withEdge(withLoadWatts(basePlan(), 2000), 'e-fuse-load', {
      crossSection: 70,
      length: 3,
      fuseSize: 160,
      fuseType: 'anl',
    });

  /**
   * Abhilfe-Text EINES Befunds. Ohne die Kanteneinschränkung griffe `find`
   * den ersten Treffer im Plan — bei `I_b ≤ I_n ≤ I_z` ist das die formale
   * Standardformel der Regel und damit oft eine andere Leitung.
   */
  const remedyOf = (plan: FixturePlan, equationPart: string, edgeId = 'e-fuse-load'): string => {
    const event = checkIbInIz(contextOf(plan)).events.find(
      (entry) => entry.entity.id === edgeId && entry.equation.includes(equationPart)
    );
    if (!event) throw new Error(`kein Befund für „${equationPart}“ auf ${edgeId}`);
    return event.autoFixRemedy;
  };

  it('nennt bei I_n > I_z keine Sicherung unter dem Betriebsstrom', () => {
    const remedy = remedyOf(saturatedPlan(), 'I_n > I_z');
    // Der Altbefund: „Sicherung auf ≤ 100 A verringern“ bei I_b = 166,7 A —
    // I_b > I_n, im Betrieb eine auslösende Anlage.
    expect(remedy).not.toContain('Sicherung auf ≤ 100 A verringern');
    expect(remedy).toContain('I_b = 166,7 A');
    expect(remedy).toContain('Bedingung (1)');
  });

  it('schlägt eine kleinere Sicherung nur vor, wenn sie den Betriebsstrom trägt', () => {
    // 100 W Kühlbox (I_b = 8,33 A) auf 1,5 mm² mit 16-A-Sicherung
    // (I_z = 11,55 A): Hier IST eine kleinere Sicherung die Lösung.
    const plan = withEdge(basePlan(), 'e-fuse-load', { crossSection: 1.5, fuseSize: 16 });
    const remedy = remedyOf(plan, 'I_n > I_z');
    expect(remedy).toContain('Sicherung auf 10 A verringern');
    expect(remedy).toContain('I_b = 8,3 A');
    expect(remedy).toContain('I_z = 11,5 A');
  });

  it('nennt im Sättigungsfall einen Zielwert und die drei Auswege', () => {
    const overload = remedyOf(saturatedPlan(), 'I_b ≤ I_n');
    expect(overload).toContain('≤ 120,4 A');
    for (const exit of ['Systemspannung erhöhen', 'höher gespannten Strang verlagern', 'parallele Abgänge']) {
      expect(overload, exit).toContain(exit);
    }
    // Parallelleiter sind im Modell keine Leitung — der Text verspricht keine
    // ausgerechnete Aufteilung, er benennt den ausstehenden Nachweis.
    expect(overload).toContain('rechnet parallele Leiter nicht als eine Leitung');

    const tooBigFuse = remedyOf(saturatedPlan(), 'I_n > I_z');
    expect(tooBigFuse).toContain('Systemspannung erhöhen');
  });

  it('erklärt die Planer-Pauschale, wenn f₁ und f₂ auf Referenz liegen', () => {
    // 172 A × 0,700 bei f₁ = f₂ = 1,000 las sich wie ein Rechenfehler.
    const message = checkIbInIz(contextOf(saturatedPlan())).events.find((entry) =>
      entry.message.includes('überschreitet die korrigierte Belastbarkeit')
    )?.message;
    expect(message).toContain('f₁ = 1.000');
    expect(message).toContain('pauschale Planer-Abminderung');

    // Ist die Physik strenger als die Pauschale (55 °C ⇒ f₁ = 0,612 < 0,7),
    // entscheidet f₁ — dann darf die Pauschale nicht als Grund genannt werden.
    const hot: PassContext = {
      ...contextOf(saturatedPlan()),
      options: verificationOptions({ ampacity: { ambientC: 55, insulation: 'PVC', bundledCircuits: 1 } }),
    };
    const hotMessage = checkIbInIz(hot).events.find((entry) =>
      entry.message.includes('überschreitet die korrigierte Belastbarkeit')
    )?.message;
    expect(hotMessage).toContain('× 0.612');
    expect(hotMessage).not.toContain('pauschale Planer-Abminderung');
  });
});

describe('lib/verify/ampacity — conduitFillOutcome (gemeinsame Quelle für Regel und Anzeige)', () => {
  it('rechnet einen bekannten Typ mit bekannten Querschnitten', () => {
    const outcome = conduitFillOutcome('EN 40', [4, 2.5]);
    expect(outcome.kind).toBe('known');
    if (outcome.kind !== 'known') throw new Error('erwartet: known');
    expect(outcome.percent).toBeGreaterThan(0);
    expect(outcome.percent).toBeLessThan(40);
    expect(outcome.overfilled).toBe(false);
    expect(outcome.recommendedType).toBeNull();
  });

  it('empfiehlt bei Überfüllung das kleinste ausreichende Rohr', () => {
    const outcome = conduitFillOutcome('EN 20', [50]);
    expect(outcome.kind).toBe('known');
    if (outcome.kind !== 'known') throw new Error('erwartet: known');
    expect(outcome.overfilled).toBe(true);
    expect(outcome.recommendedType).toBe('EN 25');
  });

  it('verweigert die Zahl bei unbekanntem Typ und fehlendem Querschnitt', () => {
    expect(conduitFillOutcome('M20', [4])).toEqual({ kind: 'unknown-type' });
    expect(conduitFillOutcome(null, [4])).toEqual({ kind: 'unknown-type' });
    expect(conduitFillOutcome('EN 20', [4, null, 2.5])).toEqual({ kind: 'missing-cross-section', index: 1 });
    expect(conduitFillOutcome('EN 20', [Number.NaN])).toEqual({ kind: 'missing-cross-section', index: 0 });
  });
});
