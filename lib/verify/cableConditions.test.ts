/**
 * P0-3: Der Prüfbericht muss DIESELBEN Verlegebedingungen ansetzen wie
 * AutoWire — sonst wäre ein für 60 °C dicker dimensioniertes Kabel im
 * Bericht weiterhin mit dem 0,7-Referenzwert „grün".
 */
import { describe, expect, it } from 'vitest';
import { verificationOptions, cableConditionsFor, type PassContext } from './context';
import { buildConductionGraph } from './graph';
import { checkI2VsIz, checkIbInIz } from './ampacity';
import { fixtureNode, healthyDcPlan, withEdge, type FixturePlan } from './planFixtures';

const contextOf = (plan: FixturePlan): PassContext => ({
  nodes: plan.nodes,
  edges: plan.edges,
  graph: buildConductionGraph(plan.nodes, plan.edges),
  options: verificationOptions(),
});

const planWith = (condition?: Record<string, unknown>): FixturePlan => {
  let plan: FixturePlan = {
    nodes: healthyDcPlan().nodes.map((node) =>
      node.id === 'load1'
        ? fixtureNode('load1', 'consumer', { label: 'Kühlbox', watts: 360, hours: 4 })
        : node
    ),
    edges: [...healthyDcPlan().edges],
  };
  plan = withEdge(plan, 'e-fuse-load', { crossSection: 10, fuseSize: 50, ...condition });
  return withEdge(plan, 'e-bat-fuse', { crossSection: 35, fuseSize: 50 });
};

describe('AMP-001 mit kantenspezifischen Verlegebedingungen', () => {
  it('Referenz: I_z(10 mm²) = 36,4 A; f₁ = 1', () => {
    const check = checkIbInIz(contextOf(planWith()));
    const event = check.events.find((entry) => entry.entity.id === 'e-fuse-load');
    expect(event?.details?.izBreakdown?.correctedIz).toBeCloseTo(36.4, 6);
    expect(event?.details?.izBreakdown?.ambientFactor).toBe(1);
  });

  it('Motorraum: I_z(10 mm²) = 26 A; I_b > I_z wird gemeldet', () => {
    const check = checkIbInIz(contextOf(planWith({ installationCondition: 'engine-bay' })));
    const overloaded = check.events.find(
      (entry) => entry.entity.id === 'e-fuse-load' && (entry.calculatedValue ?? 0) === 30
    );
    expect(overloaded?.allowedLimit).toBeCloseTo(26, 6);
    expect(overloaded?.details?.izBreakdown?.ambientFactor).toBeCloseTo(0.5, 6);
    expect(overloaded?.details?.izBreakdown?.explanation).toContain('f₁ 0.50');
  });

  it('Datenblatt-I_z übersteuert die Tabellenrechnung im Bericht', () => {
    const check = checkIbInIz(
      contextOf(planWith({ installationCondition: 'datasheet', manufacturerIzA: 25 }))
    );
    const event = check.events.find((entry) => entry.entity.id === 'e-fuse-load');
    expect(event?.details?.izBreakdown?.correctedIz).toBe(25);
    expect(event?.details?.izBreakdown?.explanation).toContain('Herstellerangabe');
  });

  it('explizit gewähltes Referenzmodell überschreibt eine strengere Laufannahme', () => {
    // Ohne diesen Fall würde der Bericht bei einem 60-°C-Lauf weiterhin mit
    // 60 °C rechnen, obwohl im Inspektor ausdrücklich „Referenz" gewählt ist.
    const plan = planWith({ installationCondition: 'reference' });
    const context: PassContext = {
      ...contextOf(plan),
      options: verificationOptions({
        ampacity: { ambientC: 60, insulation: 'PVC', bundledCircuits: 1 },
      }),
    };
    const event = checkIbInIz(context).events.find(
      (entry) => entry.entity.id === 'e-fuse-load' && (entry.calculatedValue ?? 0) === 50
    );
    expect(event?.allowedLimit).toBeCloseTo(36.4, 6);
  });

  it('ungültige Bedingungen ⇒ UNVERIFIABLE statt stillem 30-°C-Rückfall', () => {
    const plan = planWith({ installationCondition: 'custom', ambientC: 95 });
    const context = contextOf(plan);
    expect(cableConditionsFor(context, 'e-fuse-load').kind).toBe('invalid');
    const check = checkIbInIz(context);
    const event = check.events.find((entry) => entry.entity.id === 'e-fuse-load');
    expect(event?.kind).toBe('UNVERIFIABLE');
    expect(event?.message).toContain('Verlegebedingungen sind ungültig');
  });

  it('AMP-002 nennt bei ungültiger Bedingung den richtigen Grund (nicht „Querschnitt fehlt")', () => {
    const context = contextOf(planWith({ installationCondition: 'custom', ambientC: 95 }));
    const event = checkI2VsIz(context).events.find(
      (entry) => entry.kind === 'UNVERIFIABLE' && entry.message.includes('Verlegebedingungen sind ungültig')
    );
    expect(event).toBeDefined();
    expect(event?.message).not.toMatch(/Querschnitt fehlt/);
  });

  it('ein Herstellerwert wird im Bericht auch als Herstellerangabe ausgewiesen', () => {
    const check = checkIbInIz(
      contextOf(planWith({ installationCondition: 'datasheet', manufacturerIzA: 25 }))
    );
    const event = check.events.find((entry) => entry.entity.id === 'e-fuse-load');
    expect(event?.details?.izBreakdown?.explanation).toContain('Herstellerangabe');
  });
});
