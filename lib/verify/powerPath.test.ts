import { describe, expect, it } from 'vitest';

import { verificationOptions, type PassContext } from './context';
import { buildConductionGraph } from './graph';
import {
  VOLTAGE_DROP_CRITICAL_PERCENT,
  checkEnergyBalance,
  checkVoltageDropEdge,
  checkVoltageDropPath,
  runPass4,
} from './powerPath';
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

const withLoad = (plan: FixturePlan, data: Record<string, unknown>): FixturePlan => ({
  nodes: plan.nodes.map((node) =>
    node.id === 'load1' ? fixtureNode('load1', 'consumer', { label: 'Kühlbox', ...data }) : node
  ),
  edges: [...plan.edges],
});

describe('lib/verify/powerPath — Pass 4 auf dem gesunden Plan', () => {
  it('prüft alle drei Regeln und meldet keine Befunde', () => {
    const checks = runPass4(contextOf(healthyDcPlan()));
    expect(checks.map((check) => check.ruleId)).toEqual([
      'VDR-001-voltage-drop-edge',
      'VDR-002-voltage-drop-path',
      'PWR-001-energy-balance',
    ]);
    for (const check of checks) {
      expect(check.status, check.ruleId).toBe('PASS');
      expect(check.events, check.ruleId).toEqual([]);
    }
    expect(byRule(checks, 'VDR-001-voltage-drop-edge').evaluatedEntities).toBe(2);
    expect(byRule(checks, 'VDR-002-voltage-drop-path').evaluatedEntities).toBe(1);
    expect(byRule(checks, 'PWR-001-energy-balance').evaluatedEntities).toBe(1);
  });
});

describe('lib/verify/powerPath — VDR-001 (ΔU je Leitung)', () => {
  it('meldet FAIL mit Prozentwert, Volt-Wert und Budget', () => {
    const check = checkVoltageDropEdge(
      contextOf(withEdge(healthyDcPlan(), 'e-fuse-load', { crossSection: 1.5, length: 8 }))
    );
    expect(check.status).toBe('FAIL');
    const event = check.events[0];
    expect(event?.calculatedValue).toBeCloseTo(14.54, 1);
    expect(event?.allowedLimit).toBe(3);
    expect(event?.unit).toBe('%');
    // 14,5 % liegt über der Alarmgrenze der Planungsansicht ⇒ sicherheitskritisch.
    expect(event?.severity).toBe('CRITICAL_SAFETY');
    expect(event?.message).toContain('ΔU');
    expect(event?.message).toContain('Budget');
    expect(event?.autoFixRemedy.length).toBeGreaterThan(20);
  });

  it('stuft einen Fall weit jenseits der Alarmgrenze als CRITICAL_SAFETY ein', () => {
    const check = checkVoltageDropEdge(
      contextOf(withEdge(healthyDcPlan(), 'e-fuse-load', { crossSection: 1.5, length: 40 }))
    );
    expect(check.status).toBe('FAIL');
    expect(check.events[0]?.calculatedValue).toBeGreaterThan(VOLTAGE_DROP_CRITICAL_PERCENT);
    expect(check.events[0]?.severity).toBe('CRITICAL_SAFETY');
  });

  it('bleibt beim Grenzfall 4 mm² / 5 m knapp über dem Budget — und benennt beide Zahlen', () => {
    const check = checkVoltageDropEdge(
      contextOf(withEdge(healthyDcPlan(), 'e-fuse-load', { crossSection: 4, length: 5 }))
    );
    expect(check.status).toBe('FAIL');
    expect(check.events[0]?.calculatedValue).toBeCloseTo(3.41, 1);
    expect(check.events[0]?.allowedLimit).toBe(3);
    expect(check.events[0]?.severity).toBe('CODE_VIOLATION'); // Budget verletzt, unter der Alarmgrenze
  });

  it('meldet UNPROVABLE statt eines geratenen ΔU, wenn Angaben fehlen', () => {
    for (const missing of [
      withEdge(healthyDcPlan(), 'e-fuse-load', { crossSection: undefined }),
      withEdge(healthyDcPlan(), 'e-fuse-load', { length: undefined }),
    ]) {
      const check = checkVoltageDropEdge(contextOf(missing));
      expect(check.status).toBe('UNPROVABLE');
      expect(check.events.some((event) => event.kind === 'UNVERIFIABLE')).toBe(true);
    }
  });
});

describe('lib/verify/powerPath — VDR-002 (kumulierter Pfad)', () => {
  it('summiert alle Segmente des günstigsten Versorgungspfades', () => {
    // Die eine geänderte Leitung liegt nicht am Anfang: 1,5 mm² über 8 m auf
    // dem letzten Segment, davor die 16-mm²-Leitung. Der Pfadwert muss HÖHER
    // liegen als der Einzelwert, und er zählt beide Leitungen.
    const check = checkVoltageDropPath(
      contextOf(withEdge(healthyDcPlan(), 'e-fuse-load', { crossSection: 1.5, length: 8 }))
    );
    expect(check.status).toBe('FAIL');
    const event = check.events[0];
    expect(event?.calculatedValue).toBeCloseTo(14.71, 1);
    expect(event?.calculatedValue).toBeGreaterThan(14.54);
    expect(event?.message).toContain('2 Leitung(en)');
    expect(event?.allowedLimit).toBe(3);
  });

  it('ist auf einem Plan ohne Verbraucher nicht anwendbar', () => {
    const plan = healthyDcPlan();
    const check = checkVoltageDropPath(
      contextOf({
        nodes: plan.nodes.filter((node) => node.id !== 'load1'),
        edges: plan.edges.filter((edge) => edge.id !== 'e-fuse-load' && edge.id !== 'e-shunt-load'),
      })
    );
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(0);
  });
});

describe('lib/verify/powerPath — PWR-001 (Energiebilanz)', () => {
  it('meldet UNPROVABLE, wenn die Batteriekapazität fehlt (kein stiller Freispruch)', () => {
    const plan = healthyDcPlan();
    const check = checkEnergyBalance(
      contextOf({
        nodes: plan.nodes.map((node) =>
          node.id === 'bat1'
            ? fixtureNode('bat1', 'battery', { label: 'Aufbaubatterie', role: 'house' })
            : node
        ),
        edges: plan.edges,
      })
    );
    expect(check.status).toBe('UNPROVABLE');
    expect(check.evaluatedEntities).toBe(0);
    expect(check.events[0]?.message).toContain('Kapazität');
  });

  it('meldet UNPROVABLE, wenn einem Verbraucher Leistung oder Dauer fehlt', () => {
    const withoutHours = checkEnergyBalance(contextOf(withLoad(healthyDcPlan(), { watts: 100 })));
    expect(withoutHours.status).toBe('UNPROVABLE');
    expect(withoutHours.evaluatedEntities).toBe(1);
    expect(withoutHours.events[0]?.message).toContain('Nutzungsdauer');

    const withoutWatts = checkEnergyBalance(contextOf(withLoad(healthyDcPlan(), { hours: 4 })));
    expect(withoutWatts.status).toBe('UNPROVABLE');

    // 0 W ist für die Bilanz »nicht angegeben«, nicht »kein Bedarf«: die
    // Engine rät keine Null.
    const zeroWatts = checkEnergyBalance(contextOf(withLoad(healthyDcPlan(), { watts: 0, hours: 4 })));
    expect(zeroWatts.status).toBe('UNPROVABLE');
  });

  it('rechnet die nutzbare Kapazität mit Peukert gegen den Tagesbedarf', () => {
    const check = checkEnergyBalance(contextOf(healthyDcPlan()));
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(1);
    expect(check.events).toEqual([]);
  });

  it('bleibt ohne Last nicht anwendbar', () => {
    const plan = healthyDcPlan();
    const check = checkEnergyBalance(
      contextOf({ nodes: plan.nodes.filter((node) => node.id !== 'load1'), edges: plan.edges })
    );
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(1); // die Batterie wird weiter bewertet
  });

  it('meldet FAIL, wenn der Tagesbedarf die nutzbare Kapazität übersteigt', () => {
    const plan = healthyDcPlan();
    const check = checkEnergyBalance(
      contextOf(withLoad({ nodes: plan.nodes, edges: plan.edges }, { watts: 1500, hours: 24 }))
    );
    expect(check.status).toBe('FAIL');
    const event = check.events[0];
    expect(event?.severity).toBe('EFFICIENCY_WARNING');
    expect(event?.calculatedValue).toBeGreaterThan(Number(event?.allowedLimit));
  });
});

describe('lib/verify/powerPath — Datenlücken und Randfälle', () => {
  it('meldet einen fehlenden Betriebsstrom als Datenlücke (nicht als 0 A)', () => {
    const check = checkVoltageDropEdge(contextOf(withLoad(healthyDcPlan(), { hours: 4 })));
    expect(check.status).toBe('UNPROVABLE');
    expect(check.events[0]?.message).toContain('Betriebsstrom fehlt');
  });

  it('meldet einen Verbraucher ohne vollständigen Pfad als UNPROVABLE', () => {
    const check = checkVoltageDropPath(contextOf(withoutEdge(healthyDcPlan(), 'e-bat-fuse')));
    expect(check.status).toBe('UNPROVABLE');
    expect(check.evaluatedEntities).toBe(0);
    expect(check.events[0]?.message).toContain('kein vollständig bekannter Versorgungspfad');
  });

  it('bewertet einen Verbraucher ohne Plusanschluss nicht als »unversorgt«', () => {
    // Nur der Minus-Rückweg ist verdrahtet: Für die Pluspfad-Rechnung gibt es
    // keine Zielports — die Regel sagt nichts, statt einen Pfad zu erfinden.
    const plan: FixturePlan = {
      nodes: [
        fixtureNode('bat1', 'battery', {
          label: 'Batterie',
          role: 'house',
          capacity: 200,
          chemistry: 'LiFePO4',
        }),
        fixtureNode('load1', 'consumer', { label: 'Kühlbox', watts: 100, hours: 4 }),
      ],
      edges: [fixtureEdge('e-minus', 'load1', 'minus', 'bat1', 'minus', { crossSection: 4, length: 2 })],
    };
    const check = checkVoltageDropPath(contextOf(plan));
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(0);
    expect(check.events).toEqual([]);
  });

  it('zählt mehrere Verbraucher deterministisch auf (Sortierung nach Knoten-ID)', () => {
    const plan = healthyDcPlan();
    plan.nodes = [...plan.nodes, fixtureNode('a-load', 'consumer', { label: 'Lampe', watts: 20, hours: 2 })];
    plan.edges = [
      ...plan.edges,
      fixtureEdge('e-lamp', 'fuse1', 'plus', 'a-load', 'plus', {
        crossSection: 4,
        length: 1,
        fuseSize: 10,
        fuseType: 'ato',
      }),
    ];
    const base = runPass4(contextOf(plan));
    const again = runPass4(contextOf(plan));
    expect(JSON.stringify(again)).toBe(JSON.stringify(base));
    expect(byRule(base, 'VDR-002-voltage-drop-path').evaluatedEntities).toBe(2);
    expect(byRule(base, 'PWR-001-energy-balance').status).toBe('PASS');
  });

  it('meldet den kumulierten Pfad auch bei zwei Parallelleitungen (günstigster Weg)', () => {
    const plan = healthyDcPlan();
    plan.edges = [
      ...plan.edges,
      fixtureEdge('e-fuse-load-b', 'fuse1', 'plus', 'load1', 'plus', {
        crossSection: 16,
        length: 2,
        fuseSize: 10,
        fuseType: 'ato',
      }),
    ];
    const check = checkVoltageDropPath(contextOf(plan));
    expect(check.status).toBe('PASS');
    expect(check.evaluatedEntities).toBe(1);
  });
});
