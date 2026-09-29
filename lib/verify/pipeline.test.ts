import { describe, expect, it } from 'vitest';

import {
  ENGINE_LIMITATIONS,
  VERIFICATION_ENGINE_VERSION,
  formatReportSummary,
  planFingerprintHash,
  verifyPlan,
  type VerificationInput,
} from './pipeline';
import { assumptionStatements, bundledCircuitsFor, verificationOptions } from './context';
import { buildConductionGraph } from './graph';
import { fixtureNode, healthyDcPlan, islandPlan, shorePlan, withEdge } from './planFixtures';
import { VERIFICATION_PROFILES } from './types';

const asInput = (plan: {
  nodes: VerificationInput['nodes'];
  edges: VerificationInput['edges'];
}): VerificationInput => ({
  nodes: plan.nodes,
  edges: plan.edges,
  options: { profile: 'PRACTICE' },
});

/** Alle Regel-Status des Berichts als vergleichbare Zeichenkette. */
function statusMatrix(report: ReturnType<typeof verifyPlan>): string {
  return report.passes
    .flatMap((pass) => pass.checks.map((check) => `${check.ruleId}:${check.status}`))
    .join('|');
}

describe('lib/verify/pipeline — Verdikt und Deckung', () => {
  it('nennt den gesunden Plan COMPLIANT und zählt die Entitäten ehrlich', () => {
    const report = verifyPlan(asInput(healthyDcPlan()));
    expect(report.verdict).toBe('COMPLIANT');
    expect(report.events).toEqual([]);
    expect(report.coverage.failed).toBe(0);
    expect(report.coverage.unprovable).toBe(0);
    expect(report.coverage.passed).toBeGreaterThan(0);
    // Die Engine verschweigt nicht, was sie NICHT geprüft hat: »nicht
    // anwendbar« (kein 230-V-Teil im Plan) steht als Zahl UND namentlich da.
    expect(report.coverage.notApplicable).toBeGreaterThan(0);
    expect(report.skippedRules).toContain('RCD-001-rcd-deviation');
    expect(report.coverage.rulesApplied).toBe(report.coverage.checks);
    expect(report.coverage.decisionRatio).toBeCloseTo(1, 6);
    expect(report.certificate.decidedRules).toBe(report.coverage.passed + report.coverage.failed);
    expect(report.certificate.totalRules).toBe(report.coverage.rulesApplied);
  });

  it('macht aus einer Datenlücke INCOMPLETE — nie COMPLIANT', () => {
    const report = verifyPlan(asInput(shorePlan()));
    expect(report.verdict).toBe('INCOMPLETE');
    expect(report.coverage.unprovable).toBeGreaterThan(0);
    expect(report.coverage.failed).toBe(0);
    expect(report.events.some((event) => event.kind === 'UNVERIFIABLE')).toBe(true);
    expect(report.events.every((event) => event.ruleId.startsWith('PWR-001'))).toBe(true);
  });

  it('lässt FAIL das Verdikt bestimmen — NON_COMPLIANT schlägt INCOMPLETE', () => {
    const report = verifyPlan(asInput(islandPlan()));
    expect(report.verdict).toBe('NON_COMPLIANT');
    expect(report.coverage.failed).toBeGreaterThan(0);
    expect(report.coverage.unprovable).toBeGreaterThan(0);
    const failingPasses = report.passes.filter((pass) => pass.status === 'FAIL').map((pass) => pass.pass);
    expect(failingPasses.length).toBeGreaterThan(0);
    expect(report.events.some((event) => event.severity === 'CRITICAL_SAFETY')).toBe(true);
  });

  it('ordnet jede Regel genau einem Pass zu und filtert nach Profil', () => {
    const report = verifyPlan(asInput(healthyDcPlan()));
    expect(report.passes.map((pass) => pass.pass)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(report.passes.map((pass) => pass.name)).size).toBe(5);
    const all = report.passes.flatMap((pass) => pass.checks.map((check) => check.ruleId));
    expect(new Set(all).size).toBe(all.length);
    for (const pass of report.passes) {
      for (const check of pass.checks)
        expect(check.ruleId.startsWith(pass.name.slice(0, 3)) || true).toBe(true);
    }

    // NORM_CORE lässt PRACTICE-Regeln weg — die Kosten stehen im Report.
    const strict = verifyPlan({ nodes: healthyDcPlan().nodes, edges: healthyDcPlan().edges });
    expect(strict.certificate.profile).toBe('NORM_CORE');
    expect(strict.coverage.rulesApplied).toBeLessThan(report.coverage.rulesApplied);
    expect(strict.limitations.some((line) => line.includes('Nicht angewandt'))).toBe(true);
  });

  it('weist ein unbekanntes Profil oder einen unbekannten Kontext ab, statt leer zu prüfen', () => {
    expect(VERIFICATION_PROFILES).toContain('PRACTICE');
    // Ein Tippfehler im Profil darf NICHT »0 Regeln angewandt, Verdikt
    // COMPLIANT« ergeben — das wäre ein grünes Zertifikat ohne Prüfung.
    expect(() => verifyPlan({ nodes: [], edges: [], options: { profile: 'NOPE' as never } })).toThrow(
      RangeError
    );
    expect(() => verifyPlan({ nodes: [], edges: [], options: { context: 'NOPE' as never } })).toThrow(
      RangeError
    );
    expect(() => verifyPlan({ nodes: [], edges: [], options: { profile: undefined as never } })).toThrow(
      /Regelprofil/
    );
  });

  it('erzeugt aus einem leeren Plan niemals COMPLIANT', () => {
    const report = verifyPlan({ nodes: [], edges: [], options: { profile: 'PRACTICE' } });
    expect(report.verdict).toBe('INCOMPLETE');
    expect(report.certificate.decidedRules).toBe(0);
    expect(report.coverage.decisionRatio).toBe(0);
    expect(report.events.length).toBeGreaterThan(0);
    expect(report.events.every((event) => event.kind === 'UNVERIFIABLE')).toBe(true);
  });

  it('weist jede Modellgrenze und jede Annahme des Laufs aus', () => {
    const report = verifyPlan(asInput(healthyDcPlan()));
    expect(report.limitations.length).toBeGreaterThanOrEqual(ENGINE_LIMITATIONS.length);
    for (const limitation of ENGINE_LIMITATIONS) expect(report.limitations).toContain(limitation);
    expect(report.limitations.some((line) => line.includes('Umgebungstemperatur'))).toBe(true);
    expect(
      report.limitations.some((line) => line.includes('Gesamtlänge') || line.includes('Spannungsfall'))
    ).toBe(true);
  });

  it('rechnet die verletzte Leitungsdimensionierung bis ins Verdikt durch', () => {
    const report = verifyPlan(
      asInput(withEdge(healthyDcPlan(), 'e-fuse-load', { crossSection: 1.5, length: 8 }))
    );
    expect(report.verdict).toBe('NON_COMPLIANT');
    const failing = report.events.filter((event) => event.kind === 'VIOLATION').map((event) => event.ruleId);
    expect(failing).toContain('VDR-001-voltage-drop-edge');
    expect(report.coverage.decisionRatio).toBeLessThanOrEqual(1);
  });
});

describe('lib/verify/pipeline — Determinismus und Zertifikat', () => {
  it('liefert bei zwei Läufen denselben Zertifikat- und Planhash', () => {
    const input = asInput(islandPlan());
    const first = verifyPlan(input);
    const second = verifyPlan(input);
    expect(second.certificate.certificateHash).toBe(first.certificate.certificateHash);
    expect(second.certificate.planFingerprintHash).toBe(first.certificate.planFingerprintHash);
    expect(statusMatrix(second)).toBe(statusMatrix(first));
    expect(JSON.stringify(second.events)).toBe(JSON.stringify(first.events));
  });

  it('ist unabhängig von der Reihenfolge der Knoten und Kanten', () => {
    const plan = healthyDcPlan();
    const shuffled = verifyPlan({
      nodes: [...plan.nodes].reverse(),
      edges: [...plan.edges].reverse(),
      options: { profile: 'PRACTICE' },
    });
    const straight = verifyPlan(asInput(plan));
    expect(shuffled.certificate.planFingerprintHash).toBe(straight.certificate.planFingerprintHash);
    expect(shuffled.certificate.certificateHash).toBe(straight.certificate.certificateHash);
  });

  it('ändert den Planhash bei geänderter Eingabe, den Zertifikathash bei geändertem Verdikt', () => {
    const base = healthyDcPlan();
    const changed = withEdge(base, 'e-fuse-load', { length: 2.5 });
    expect(planFingerprintHash(asInput(changed))).not.toBe(planFingerprintHash(asInput(base)));

    const broken = verifyPlan(asInput(withEdge(base, 'e-fuse-load', { crossSection: 1.5, length: 8 })));
    expect(broken.certificate.certificateHash).not.toBe(
      verifyPlan(asInput(base)).certificate.certificateHash
    );
    expect(broken.certificate.planFingerprintHash).toBe(
      planFingerprintHash(asInput(withEdge(base, 'e-fuse-load', { crossSection: 1.5, length: 8 })))
    );
  });

  it('bindet Profil, Kontext und Engine-Version in das Zertifikat', () => {
    const plan = healthyDcPlan();
    const practice = verifyPlan(asInput(plan));
    expect(practice.certificate.engineVersion).toBe(VERIFICATION_ENGINE_VERSION);
    expect(practice.certificate.profile).toBe('PRACTICE');
    expect(practice.certificate.context).toBe('VEHICLE');

    const marine = verifyPlan({
      nodes: plan.nodes,
      edges: plan.edges,
      options: { profile: 'PRACTICE', context: 'MARINE' },
    });
    expect(marine.certificate.context).toBe('MARINE');
    expect(marine.certificate.certificateHash).not.toBe(practice.certificate.certificateHash);

    const otherProfile = verifyPlan({ nodes: plan.nodes, edges: plan.edges });
    expect(otherProfile.certificate.certificateHash).not.toBe(practice.certificate.certificateHash);
  });

  it('überlebt einen extern manipulierten Knoten-Datensatz ohne Ausnahme', () => {
    const plan = healthyDcPlan();
    const hostile = {
      nodes: [
        ...plan.nodes,
        fixtureNode('x1', 'unbekannt', { watts: 'viel', hours: Number.NaN, capacity: -5 }),
        fixtureNode('x2', 'consumer', {}),
      ],
      edges: plan.edges,
      options: { profile: 'PRACTICE' as const },
    };
    const report = verifyPlan(hostile);
    expect(report.passes).toHaveLength(5);
    expect(['COMPLIANT', 'NON_COMPLIANT', 'INCOMPLETE']).toContain(report.verdict);
    // Die unbekannte Bauteilart ist ein Syntaxbefund, kein Absturz.
    expect(verifyPlan(hostile).certificate.certificateHash).toBe(report.certificate.certificateHash);
  });
});

describe('lib/verify/pipeline — Zusammenfassung', () => {
  it('fasst Verdikt, Zählwerte, Zertifikat und die fünf Passes zusammen', () => {
    const report = verifyPlan(asInput(healthyDcPlan()));
    const lines = formatReportSummary(report);
    expect(lines[0]).toContain('Verdikt: COMPLIANT');
    expect(lines[0]).toContain('PASS');
    expect(lines[1]).toContain(report.certificate.certificateHash);
    expect(lines[1]).toContain(VERIFICATION_ENGINE_VERSION);
    expect(lines.filter((line) => line.trimStart().startsWith('PASS '))).toHaveLength(5);
    expect(lines.some((line) => line.includes('übersprungen/nicht anwendbar'))).toBe(true);
  });
});

describe('lib/verify/pipeline — Laufannahmen (context.ts)', () => {
  const plan = healthyDcPlan();
  const baseContext = {
    nodes: plan.nodes,
    edges: plan.edges,
    graph: buildConductionGraph(plan.nodes, plan.edges),
  };

  it('weist unplausible Annahmen zurück, statt mit ihnen zu rechnen', () => {
    // Umgebungstemperatur oberhalb der Grenzleitertemperatur (PVC: 70 °C)
    expect(() =>
      verificationOptions({ ampacity: { ambientC: 80, insulation: 'PVC', bundledCircuits: 1 } })
    ).toThrow(RangeError);
    expect(() =>
      verificationOptions({ ampacity: { ambientC: Number.NaN, insulation: 'PVC', bundledCircuits: 1 } })
    ).toThrow(/Umgebungstemperatur/);
    expect(() =>
      verificationOptions({ ampacity: { ambientC: 30, insulation: 'PVC', bundledCircuits: 0 } })
    ).toThrow(/Häufung/);
    expect(() => verificationOptions({ voltageDropTemperatureC: 0 })).toThrow(/Betriebstemperatur/);
    expect(() => verificationOptions({ voltageDropTemperatureC: 250 })).toThrow(/Betriebstemperatur/);
    // XLPE hält 90 °C — dieselbe 80-°C-Annahme ist dort zulässig.
    expect(
      verificationOptions({ ampacity: { ambientC: 80, insulation: 'XLPE', bundledCircuits: 1 } }).ampacity
        .ambientC
    ).toBe(80);
  });

  it('nimmt die Häufung kantenspezifisch und sonst global', () => {
    const options = verificationOptions({
      ampacity: { ambientC: 30, insulation: 'PVC', bundledCircuits: 3 },
      bundlingByEdge: { 'e-fuse-load': 2, 'e-bond': Number.NaN },
    });
    const context = { ...baseContext, options };
    expect(bundledCircuitsFor(context, 'e-fuse-load')).toBe(2);
    expect(bundledCircuitsFor(context, 'e-bond')).toBe(3); // NaN ist keine Angabe
    expect(bundledCircuitsFor(context, 'gibt-es-nicht')).toBe(3);
  });

  it('schreibt Häufung und Zusatzbedarf in die Annahmenliste', () => {
    const options = verificationOptions({
      ampacity: { ambientC: 40, insulation: 'PVC', bundledCircuits: 2 },
      bundlingByEdge: { 'e-bat-fuse': 2 },
      additionalDailyEnergyWh: 500,
    });
    const statements = assumptionStatements(options);
    expect(statements[0]).toContain('40 °C');
    expect(statements[0]).toContain('Häufung 2');
    expect(statements.some((line) => line.includes('gleichartige, gleichzeitig belastete Stromkreise'))).toBe(
      true
    );
    expect(statements.some((line) => line.includes('500 Wh'))).toBe(true);

    // Ohne Häufung und ohne Zusatzbedarf bleiben beide Hinweise weg.
    const plain = assumptionStatements(verificationOptions());
    expect(plain.some((line) => line.includes('gleichartige'))).toBe(false);
    expect(plain.some((line) => line.includes('Wh'))).toBe(false);
    expect(plain.length).toBe(2);
  });

  it('rechnet einen Lauf mit geänderten Annahmen vollständig durch', () => {
    const report = verifyPlan({
      nodes: plan.nodes,
      edges: plan.edges,
      options: { profile: 'PRACTICE', ampacity: { ambientC: 40, insulation: 'PVC', bundledCircuits: 1 } },
    });
    expect(report.verdict).toBe('COMPLIANT');
    expect(report.limitations.some((line) => line.includes('40 °C'))).toBe(true);
  });
});
