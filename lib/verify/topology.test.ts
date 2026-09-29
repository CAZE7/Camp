import { describe, expect, it } from 'vitest';

import { buildConductionGraph } from './graph';
import {
  fixtureEdge,
  fixtureNode,
  healthyDcPlan,
  houseBattery,
  plusEdge,
  withEdge,
  type FixturePlan,
} from './planFixtures';
import { runPass1, runPass2 } from './topology';
import type { CheckResult, RuleId } from './types';

function runPlan(plan: FixturePlan): { pass1: CheckResult[]; pass2: CheckResult[]; all: CheckResult[] } {
  const graph = buildConductionGraph(plan.nodes, plan.edges);
  const pass1 = runPass1(graph);
  const pass2 = runPass2(graph);
  return { pass1, pass2, all: [...pass1, ...pass2] };
}

function checkFor(checks: readonly CheckResult[], ruleId: RuleId): CheckResult {
  const check = checks.find((entry) => entry.ruleId === ruleId);
  if (!check) throw new Error(`Regel ${ruleId} wurde nicht ausgeführt`);
  return check;
}

describe('lib/verify/topology — der gesunde Plan ist in Pass 1 und 2 grün', () => {
  it('meldet keinen einzigen Befund', () => {
    const { all } = runPlan(healthyDcPlan());
    const findings = all.flatMap((check) => check.events);
    expect(findings).toEqual([]);
    for (const check of all) expect(check.status, check.ruleId).toBe('PASS');
  });

  it('ist deterministisch: gleicher Plan ⇒ identische Befunde', () => {
    const first = runPlan(healthyDcPlan()).all;
    const second = runPlan(healthyDcPlan()).all;
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe('lib/verify/topology — PASS 1 Syntax & Konnektivität', () => {
  it('SYN-001: Leitung ohne Endknoten ist ein harter Befund (nicht bewertbar)', () => {
    const plan = healthyDcPlan();
    plan.edges.push(fixtureEdge('e-ghost', 'bat1', 'plus', 'gibtsnicht', 'plus'));
    const check = checkFor(runPlan(plan).pass1, 'SYN-001-dangling-endpoint');
    expect(check.status).toBe('FAIL');
    expect(check.events[0]?.entity.id).toBe('e-ghost');
  });

  it('SYN-002: unbekanntes Bauteil wird UNPROVABLE — nie stillschweigend Last oder Quelle', () => {
    const plan = healthyDcPlan();
    plan.nodes.push(fixtureNode('x1', 'mystery'));
    plan.edges.push(fixtureEdge('e-x', 'fuse1', 'plus', 'x1', 'plus'));
    const check = checkFor(runPlan(plan).pass1, 'SYN-002-unmodeled-component');
    expect(check.status).toBe('UNPROVABLE');
    expect(check.events[0]?.kind).toBe('UNVERIFIABLE');
    expect(check.events[0]?.message).toContain('mystery');
  });

  it('SYN-003: unbekanntes Handle macht die Kante UNPROVABLE (nie stilles PASS)', () => {
    const plan = healthyDcPlan();
    plan.edges.push(fixtureEdge('e-handle', 'fuse1', 'plus', 'load1', 'querschnitt'));
    const check = checkFor(runPlan(plan).pass1, 'SYN-003-unknown-port');
    expect(check.status).toBe('UNPROVABLE');
    const event = check.events[0];
    expect(event?.kind).toBe('UNVERIFIABLE');
    expect(event?.counterexample?.[0]).toContain('e-handle');
    expect(event?.message).toContain('querschnitt');
  });

  it('SYN-004: Leitung über die Domänengrenze (230 V → 12 V) wird gemeldet', () => {
    const plan: FixturePlan = {
      nodes: [
        fixtureNode('shore1', 'shorePower', { label: 'Landstrom' }),
        fixtureNode('load1', 'consumer', { label: '12-V-Gerät', watts: 10 }),
      ],
      edges: [fixtureEdge('e-cross', 'shore1', 'plus', 'load1', 'plus', { crossSection: 2.5, length: 1 })],
    };
    const check = checkFor(runPlan(plan).pass1, 'SYN-004-domain-crossing');
    expect(check.status).toBe('FAIL');
    expect(check.events[0]?.entity.id).toBe('e-cross');
  });
});

describe('lib/verify/topology — PASS 2 Domäne & Polarität', () => {
  it('DOM-001: Plus↔Minus ohne Verbraucher ist ein Kurzschluss', () => {
    const plan = plusEdge(
      healthyDcPlan(),
      fixtureEdge('e-cross', 'bat1', 'plus', 'load1', 'minus', { crossSection: 2.5, length: 1 })
    );
    const check = checkFor(runPlan(plan).pass2, 'DOM-001-polarity-cross');
    expect(check.status).toBe('FAIL');
    expect(check.events.map((event) => event.entity.id)).toContain('e-cross');
  });

  it('DOM-001: die Solar-Reihenschaltung ist die einzige Ausnahme', () => {
    const plan: FixturePlan = {
      nodes: [
        fixtureNode('p1', 'solar', { label: 'Panel 1' }),
        fixtureNode('p2', 'solar', { label: 'Panel 2' }),
      ],
      edges: [fixtureEdge('e-series', 'p1', 'plus', 'p2', 'minus', { crossSection: 4, length: 2 })],
    };
    const check = checkFor(runPlan(plan).pass2, 'DOM-001-polarity-cross');
    expect(check.events).toEqual([]);
    expect(check.status).toBe('PASS');
  });

  it('DOM-002: Plus auf Masse/PE ist ein Kurzschluss gegen das Bezugssystem', () => {
    const plan = plusEdge(
      healthyDcPlan(),
      fixtureEdge('e-plus-ground', 'bat1', 'plus', 'gnd1', 'minus', { crossSection: 6, length: 1 })
    );
    const check = checkFor(runPlan(plan).pass2, 'DOM-002-positive-to-reference');
    expect(check.status).toBe('FAIL');
    expect(check.events[0]?.entity.id).toBe('e-plus-ground');
  });
});

describe('lib/verify/topology — Kurzschlussfreiheit (TOPO-001)', () => {
  it('bewertet die Quellen des Plans (kein stiller Leerlauf-Test)', () => {
    const { all } = runPlan(healthyDcPlan());
    const check = checkFor(all, 'TOPO-001-short-path');
    expect(check.status).toBe('PASS');
    expect(check.events).toEqual([]);
    expect(check.evaluatedEntities).toBeGreaterThan(0);
  });

  it('erkennt einen unbelasteten Plus-Pfad über PASSIVE Bauteile (Gegenbeispiel im Befund)', () => {
    // Zwei Plusleitungen an einer Plus-Sammelschiene: die Schiene führt die
    // Polarität durch (PASSIVE), der zweite Zweig endet am Bezugspunkt — das
    // ist der Kurzschluss, den nur die Netzprüfung findet (die Einzelkabel
    // sind weder DOM-001 noch DOM-002).
    const plan: FixturePlan = {
      nodes: [
        houseBattery(),
        fixtureNode('bus1', 'busbar', { label: 'Plus-Schiene', role: 'positive' }),
        fixtureNode('gnd1', 'ground', { label: 'Massepunkt' }),
      ],
      edges: [
        fixtureEdge('e-plus-bus', 'bat1', 'plus', 'bus1', 'plus', { crossSection: 16, length: 0.5 }),
        fixtureEdge('e-bus-gnd', 'bus1', 'plus', 'gnd1', 'minus', { crossSection: 4, length: 0.4 }),
      ],
    };
    const { all } = runPlan(plan);
    const topo = checkFor(all, 'TOPO-001-short-path');
    expect(topo.status).toBe('FAIL');
    const event = topo.events[0];
    expect(event?.counterexample?.length).toBeGreaterThan(1);
    expect(event?.counterexample?.join(' ')).toContain('Plus-Schiene');
    // Der Plus→Minus-Einzelsprung wird zusätzlich von DOM-002 erfasst.
    expect(checkFor(all, 'DOM-002-positive-to-reference').status).toBe('FAIL');
  });

  it('hält einen Pfad ÜBER einen Verbraucher für gesund (kein Fehlalarm)', () => {
    const plan = plusEdge(
      healthyDcPlan(),
      fixtureEdge('e-load-ground', 'load1', 'minus', 'gnd1', 'minus', { crossSection: 4, length: 0.5 })
    );
    // Der Verbraucher liegt im Pfad: Masse am Verbraucher-Minus ist der
    // NORMALFALL (Rückleiter), kein Kurzschluss.
    expect(checkFor(runPlan(plan).pass2, 'TOPO-001-short-path').events).toEqual([]);
  });

  it('lässt eine Leitung mit Schutzorgan NICHT als Kurzschluss gelten (deklariertes Prädikat)', () => {
    // Geschützter Zweig: Über die Sammelschiene führt der Pluspfad weiter,
    // aber BEIDE Leitungen tragen ein Schutzorgan ⇒ kein TOPO-001-Befund.
    const plan: FixturePlan = {
      nodes: [
        houseBattery(),
        fixtureNode('bus1', 'busbar', { label: 'Plus-Schiene', role: 'positive' }),
        fixtureNode('gnd1', 'ground', { label: 'Massepunkt' }),
      ],
      edges: [
        fixtureEdge('e-plus-bus', 'bat1', 'plus', 'bus1', 'plus', {
          crossSection: 16,
          length: 0.5,
          fuseSize: 40,
          fuseType: 'ato',
        }),
        fixtureEdge('e-bus-gnd', 'bus1', 'plus', 'gnd1', 'minus', {
          crossSection: 4,
          length: 0.4,
          fuseSize: 10,
          fuseType: 'ato',
        }),
      ],
    };
    // Der Zweig ist ein Kurzschluss hinter Schutzorganen: das ist der Fall
    // »Schutz hat ausgelöst« — DOM-002 meldet ihn als Kurzschluss, TOPO-001
    // (»kein Schutzorgan auf dem Pfad«) bewusst nicht.
    const { all } = runPlan(plan);
    expect(checkFor(all, 'DOM-002-positive-to-reference').status).toBe('FAIL');
    expect(checkFor(all, 'TOPO-001-short-path').events).toEqual([]);
  });
});

describe('lib/verify/topology — Shunt-Invariante (TOPO-002/003)', () => {
  it('TOPO-002: Verbraucher direkt an Batterie-Minus ist eine harte Verletzung', () => {
    const plan = plusEdge(
      healthyDcPlan(),
      fixtureEdge('e-bypass', 'bat1', 'minus', 'load1', 'minus', { crossSection: 4, length: 1 })
    );
    const check = checkFor(runPlan(plan).pass2, 'TOPO-002-shunt-direct-bypass');
    expect(check.status).toBe('FAIL');
    expect(check.events[0]?.entity.id).toBe('e-bypass');
  });

  it('TOPO-002: die Startbatterie (Booster-Starterseite) ist ausgenommen', () => {
    // Anlass (Prüfbericht am eigenen Template): AutoWire verdrahtet die
    // Startbatterie-Minusseite direkt zum Ladebooster. Das ist fachgerecht —
    // dieser Strom gehört nicht auf die Aufbau-Messseite. Ohne die
    // Rollen-Ausnahme meldete die Regel den eigenen, korrekten Plan als
    // kritische Verletzung.
    const plan = healthyDcPlan();
    plan.nodes.push(
      fixtureNode('start1', 'battery', { label: 'Startbatterie' }),
      fixtureNode('dcdc1', 'dcdcCharger', { label: 'Ladebooster', amps: 30 })
    );
    plan.edges.push(
      fixtureEdge('e-start-dcdc', 'start1', 'minus', 'dcdc1', 'minus', { crossSection: 4, length: 1 }),
      fixtureEdge('e-start-dcdc-plus', 'start1', 'plus', 'dcdc1', 'plus', {
        crossSection: 4,
        length: 1,
        fuseSize: 30,
      })
    );
    const check = checkFor(runPlan(plan).pass2, 'TOPO-002-shunt-direct-bypass');
    expect(check.events).toEqual([]);
    expect(check.status).toBe('PASS');
  });

  it('TOPO-002: eine Aufbaubatterie bleibt auch ohne Label erfasst', () => {
    // Gegenprobe zur Ausnahme: Die Ausnahme hängt an der ROLLE, nicht am
    // Freitext. Eine Aufbaubatterie (role: house) mit Verbraucher am Minus
    // bleibt eine Verletzung.
    const plan = plusEdge(
      healthyDcPlan(),
      fixtureEdge('e-bypass', 'bat1', 'minus', 'load1', 'minus', { crossSection: 4, length: 1 })
    );
    const check = checkFor(runPlan(plan).pass2, 'TOPO-002-shunt-direct-bypass');
    expect(check.status).toBe('FAIL');
    expect(check.events[0]?.entity.id).toBe('e-bypass');
  });

  it('TOPO-003: Umweg über eine Sammelschiene wird als Schnittverletzung erkannt', () => {
    const plan = healthyDcPlan();
    plan.nodes.push(fixtureNode('bus1', 'busbar', { label: 'Minusschiene', role: 'negative' }));
    plan.edges.push(
      fixtureEdge('e-bat-bus', 'bat1', 'minus', 'bus1', 'minus', { crossSection: 16, length: 0.6 }),
      fixtureEdge('e-bus-load', 'bus1', 'minus', 'load1', 'minus', { crossSection: 4, length: 1.2 })
    );
    const pass2 = runPlan(plan).pass2;
    const direct = checkFor(pass2, 'TOPO-002-shunt-direct-bypass');
    const cut = checkFor(pass2, 'TOPO-003-shunt-cut');
    expect(direct.events).toEqual([]); // keine DIREKTE Kante Batterie↔Verbraucher
    expect(cut.status).toBe('FAIL');
    expect(cut.events[0]?.counterexample?.length).toBeGreaterThan(1);
  });

  it('TOPO-003: korrekt geführter Minuspfad bleibt grün', () => {
    const check = checkFor(runPlan(healthyDcPlan()).pass2, 'TOPO-003-shunt-cut');
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(1);
  });

  it('meldet ohne Shunt »nicht anwendbar« statt eines stillen Passes', () => {
    const plan = healthyDcPlan();
    plan.nodes = plan.nodes.filter((node) => node.id !== 'shunt1');
    plan.edges = plan.edges.filter((edge) => edge.id !== 'e-bat-shunt' && edge.id !== 'e-shunt-load');
    const pass2 = runPlan(plan).pass2;
    for (const id of ['TOPO-002-shunt-direct-bypass', 'TOPO-003-shunt-cut'] as const) {
      const check = checkFor(pass2, id);
      expect(check.status).toBe('PASS');
      expect(check.evaluatedEntities).toBe(0);
    }
  });
});

describe('lib/verify/topology — Masseschleifen (TOPO-004)', () => {
  it('erkennt zwei Wege zwischen zwei Massepunkten als Schleife', () => {
    const plan: FixturePlan = {
      nodes: [
        houseBattery(),
        fixtureNode('bus1', 'busbar', { label: 'Minusschiene', role: 'negative' }),
        fixtureNode('gnd1', 'ground', { label: 'Masse 1' }),
        fixtureNode('gnd2', 'ground', { label: 'Masse 2' }),
        fixtureNode('load1', 'consumer', { label: 'Verbraucher', watts: 50, hours: 1 }),
      ],
      edges: [
        fixtureEdge('e-plus', 'bat1', 'plus', 'load1', 'plus', {
          crossSection: 6,
          length: 1,
          fuseSize: 20,
          fuseType: 'ato',
          fuseOffset: 0.1,
        }),
        fixtureEdge('e-bus', 'bat1', 'minus', 'bus1', 'minus', { crossSection: 16, length: 0.5 }),
        fixtureEdge('e-bond-a', 'bus1', 'minus', 'gnd1', 'minus', { crossSection: 16, length: 1 }),
        fixtureEdge('e-bond-b', 'bus1', 'minus', 'gnd2', 'minus', { crossSection: 16, length: 1.5 }),
        fixtureEdge('e-link', 'gnd1', 'minus', 'gnd2', 'minus', { crossSection: 16, length: 0.8 }),
      ],
    };
    const check = checkFor(runPlan(plan).pass2, 'TOPO-004-ground-loop');
    expect(check.status).toBe('FAIL');
    const cycle = check.events[0]?.counterexample ?? [];
    expect(cycle.length).toBeGreaterThanOrEqual(3);
    expect(new Set(cycle).size).toBe(cycle.length); // einfacher Zyklus, keine Wiederholung
  });

  it('lässt einen Sternpunkt mit genau einer Anbindung je Massepunkt in Ruhe', () => {
    const plan = plusEdge(
      healthyDcPlan(),
      fixtureEdge('e-extra-load', 'fuse1', 'plus', 'gnd1', 'minus', { crossSection: 4, length: 1 })
    );
    // Plus auf Masse ist ein Kurzschluss (DOM-002/TOPO-001), aber KEINE
    // geschlossene Masseschleife: die Regel muss das unterscheiden.
    const check = checkFor(runPlan(plan).pass2, 'TOPO-004-ground-loop');
    expect(check.events).toEqual([]);
  });
});

describe('lib/verify/topology — Fluidik-Brücke (TOPO-005)', () => {
  it('meldet eine Leitung zwischen Wasser- und Elektrodomäne', () => {
    const plan = healthyDcPlan();
    plan.nodes.push(fixtureNode('tank1', 'freshWaterTank', { label: 'Frischwasser' }));
    plan.edges.push(fixtureEdge('e-bridge', 'tank1', 'out', 'load1', 'plus'));
    const check = checkFor(runPlan(plan).pass2, 'TOPO-005-fluid-electrical-bridge');
    expect(check.status).toBe('FAIL');
    expect(check.events[0]?.entity.id).toBe('e-bridge');
  });
});

describe('lib/verify/topology — Port-Graph-Invarianten', () => {
  it('führt gleiche Polaritäten innerhalb eines passiven Bauteils zusammen', () => {
    const plan = healthyDcPlan();
    plan.nodes.push(fixtureNode('bus1', 'busbar', { label: 'Plus-Sammelschiene', role: 'positive' }));
    plan.nodes.push(fixtureNode('load2', 'consumer', { label: 'Zweite Last', watts: 40, hours: 1 }));
    plan.edges.push(
      fixtureEdge('e-plus-bus', 'bat1', 'plus', 'bus1', 'plus', { crossSection: 16, length: 0.4 }),
      fixtureEdge('e-bus-load2', 'bus1', 'plus', 'load2', 'plus', { crossSection: 4, length: 1 })
    );
    const graph = buildConductionGraph(plan.nodes, plan.edges);
    const bus = graph.components.get('bus1');
    const plusPorts = bus?.ports.filter((port) => port.polarity === 'positive') ?? [];
    // Ein Port je Kabelende (Quelle/Ziel) — die Schiene führt beide zusammen.
    expect(plusPorts).toHaveLength(2);
    expect(new Set(plusPorts.map((port) => port.role))).toEqual(new Set(['source', 'target']));
    // Und der gesunde Restplan bleibt in Pass 2 ohne Befund.
    const { pass2 } = runPlan(plan);
    for (const check of pass2) {
      expect(check.events, check.ruleId).toEqual([]);
    }
  });

  it('hält fehlende Querschnitte als Datenlücke fest', () => {
    const plan = withEdge(healthyDcPlan(), 'e-fuse-load', { crossSection: undefined });
    const graph = buildConductionGraph(plan.nodes, plan.edges);
    expect(graph.cableById.get('e-fuse-load')?.crossSectionMm2).toBeNull();
  });
});
