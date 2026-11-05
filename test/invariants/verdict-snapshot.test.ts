/**
 * test/invariants/verdict-snapshot.test.ts — G5: VERDIKT-SNAPSHOT der sechs
 * Referenzpläne.
 *
 * Warum es dieses Gate gibt
 * =========================
 * Die bestehenden Golden-Master-Tests frieren **AutoWire-Ausgaben** ein
 * (`knownPlans/*.json`). Sie sagen nichts darüber, wie die Verifikations-Engine
 * dieselben Pläne heute bewertet. Genau dort liegt die sicherheitsrelevante
 * Aussage — und genau dort ist bisher unbemerkt möglich, dass ein Befund
 * verschwindet.
 *
 * Dieses Gate friert ein:
 *   - das Verdikt (COMPLIANT / INCOMPLETE / NON_COMPLIANT),
 *   - den Zertifikat-Hash (deckt Regelfolge, Status, Abdeckung ab),
 *   - die Zählung der Ereignisse je (Regel, Art).
 *
 * Was es NICHT tut
 * ================
 * Es friert **keine Textmeldungen** ein. Eine bessere Formulierung darf das
 * Gate nicht brechen; eine verschwundene Verletzung muss es brechen.
 *
 * Der Snapshot ist kein Qualitätsurteil. Er hält fest, dass **kein**
 * Referenzplan COMPLIANT ist — das ist der dokumentierte Ist-Zustand
 * (Strategie-Dokument §2.2) und muss bei jeder Änderung neu begründet werden.
 *
 * Bei einer beabsichtigten Änderung: Werte unten anpassen **und** im PR
 * begründen, welche Regel sich warum anders verhält. Ein Recapture ohne
 * Begründung ist laut `AGENTS.md` §6 unzulässig.
 */
import { describe, expect, it } from 'vitest';

import { GOLDEN_PLANS } from '../../scripts/goldenmaster/plans';
import { captureGoldenMaster } from '../../scripts/goldenmaster/pipeline';
import { verifyPlan } from '../../lib/verify/pipeline';
import type { VerificationVerdict } from '../../lib/verify/types';

/** Die Laufannahmen des Planers — dieselben, die die Warnzentrale nutzt. */
const SNAPSHOT_OPTIONS = { profile: 'PRACTICE', context: 'VEHICLE' } as const;

interface PlanSnapshot {
  verdict: VerificationVerdict;
  certificateHash: string;
  decisionRatio: number;
  coverage: { passed: number; failed: number; unprovable: number; notApplicable: number };
  /** `"<Regel-ID>|<Art>" → Anzahl`. Multimenge, keine Reihenfolge. */
  eventCounts: Readonly<Record<string, number>>;
}

const SNAPSHOT: Readonly<Record<string, PlanSnapshot>> = {
  simple: {
    verdict: 'INCOMPLETE',
    certificateHash: '274ae1aa0f8e5b99',
    decisionRatio: 0.7777777777777778,
    coverage: { passed: 14, failed: 0, unprovable: 4, notApplicable: 12 },
    eventCounts: {
      'AMP-002-i2-vs-iz|UNVERIFIABLE': 4,
      'AMP-004-breaking-capacity|UNVERIFIABLE': 2,
      'AMP-005-selectivity|UNVERIFIABLE': 3,
      'PWR-001-energy-balance|UNVERIFIABLE': 2,
    },
  },
  camper: {
    verdict: 'INCOMPLETE',
    certificateHash: '24fbdb948af24653',
    decisionRatio: 0.95,
    coverage: { passed: 19, failed: 0, unprovable: 1, notApplicable: 10 },
    eventCounts: {
      'AMP-005-selectivity|UNVERIFIABLE': 1,
    },
  },
  solar: {
    verdict: 'NON_COMPLIANT',
    certificateHash: '85afb8ee9c79587f',
    decisionRatio: 0.7777777777777778,
    coverage: { passed: 13, failed: 1, unprovable: 4, notApplicable: 12 },
    eventCounts: {
      'AMP-002-i2-vs-iz|UNVERIFIABLE': 5,
      'AMP-004-breaking-capacity|UNVERIFIABLE': 1,
      'AMP-005-selectivity|UNVERIFIABLE': 1,
      'PWR-001-energy-balance|UNVERIFIABLE': 1,
      'VDR-002-voltage-drop-path|VIOLATION': 1,
    },
  },
  inverter: {
    verdict: 'NON_COMPLIANT',
    certificateHash: 'c55c742e951a5237',
    decisionRatio: 0.7619047619047619,
    coverage: { passed: 14, failed: 2, unprovable: 5, notApplicable: 9 },
    eventCounts: {
      'AMP-002-i2-vs-iz|UNVERIFIABLE': 4,
      'AMP-004-breaking-capacity|UNVERIFIABLE': 1,
      'AMP-005-selectivity|UNVERIFIABLE': 1,
      'AMP-005-selectivity|VIOLATION': 1,
      'NET-003-ac-model-scope|UNVERIFIABLE': 3,
      'PWR-001-energy-balance|UNVERIFIABLE': 2,
      'RCD-001-rcd-deviation|VIOLATION': 1,
      'RCD-005-loop-impedance|UNVERIFIABLE': 1,
    },
  },
  acdc: {
    verdict: 'NON_COMPLIANT',
    certificateHash: '221922fd925cde3c',
    decisionRatio: 0.6666666666666666,
    coverage: { passed: 12, failed: 4, unprovable: 8, notApplicable: 6 },
    eventCounts: {
      'AMP-001-ib-in-iz|VIOLATION': 7,
      'AMP-002-i2-vs-iz|UNVERIFIABLE': 5,
      'AMP-004-breaking-capacity|UNVERIFIABLE': 1,
      'AMP-005-selectivity|UNVERIFIABLE': 1,
      'AMP-005-selectivity|VIOLATION': 1,
      'NET-001-pen-forbidden|UNVERIFIABLE': 1,
      'NET-002-island-fault-loop|UNVERIFIABLE': 1,
      'NET-003-ac-model-scope|UNVERIFIABLE': 3,
      'PWR-001-energy-balance|UNVERIFIABLE': 2,
      'RCD-001-rcd-deviation|VIOLATION': 2,
      'RCD-004-two-pole-switching|UNVERIFIABLE': 2,
      'RCD-005-loop-impedance|UNVERIFIABLE': 1,
      'VDR-002-voltage-drop-path|VIOLATION': 1,
    },
  },
  complex: {
    verdict: 'INCOMPLETE',
    certificateHash: '207995c6a9c07de5',
    decisionRatio: 0.92,
    coverage: { passed: 23, failed: 0, unprovable: 2, notApplicable: 5 },
    eventCounts: {
      'NET-003-ac-model-scope|UNVERIFIABLE': 3,
      'RCD-005-loop-impedance|UNVERIFIABLE': 1,
    },
  },
};

/** Bewertet einen Referenzplan mit den Planer-Laufannahmen. */
function evaluate(name: string): PlanSnapshot {
  const plan = GOLDEN_PLANS[name as keyof typeof GOLDEN_PLANS];
  if (!plan) throw new Error(`Unbekannter Referenzplan: ${name}`);
  const goldenMaster = captureGoldenMaster(plan);
  const report = verifyPlan({
    nodes: goldenMaster.autoWire.nodes,
    edges: goldenMaster.autoWire.edges,
    options: { ...SNAPSHOT_OPTIONS },
  });
  const eventCounts: Record<string, number> = {};
  for (const event of report.events) {
    const key = `${event.ruleId}|${event.kind}`;
    eventCounts[key] = (eventCounts[key] ?? 0) + 1;
  }
  return {
    verdict: report.verdict,
    certificateHash: report.certificate.certificateHash,
    decisionRatio: report.coverage.decisionRatio,
    coverage: {
      passed: report.coverage.passed,
      failed: report.coverage.failed,
      unprovable: report.coverage.unprovable,
      notApplicable: report.coverage.notApplicable,
    },
    eventCounts,
  };
}

describe('G5 — Verdikt-Snapshot der sechs Referenzpläne', () => {
  for (const name of Object.keys(SNAPSHOT)) {
    it(`${name}: Verdikt, Zertifikat und Befund-Multimenge unverändert`, () => {
      expect(evaluate(name)).toEqual(SNAPSHOT[name]);
    });
  }

  it('kein Referenzplan ist heute COMPLIANT — der Ist-Zustand ist Teil des Snapshots', () => {
    const verdicts = Object.entries(SNAPSHOT).map(([name, snapshot]) => `${name}:${snapshot.verdict}`);
    expect(verdicts.filter((entry) => entry.endsWith(':COMPLIANT'))).toEqual([]);
    expect(verdicts).toHaveLength(6);
  });

  it('die Bewertung ist deterministisch (zweiter Lauf, identisches Zertifikat)', () => {
    for (const name of Object.keys(SNAPSHOT)) {
      expect(evaluate(name).certificateHash, name).toBe(SNAPSHOT[name]!.certificateHash);
    }
  });

  it('die Bewertung ist repräsentationsinvariant (Ableitung aus den Rohplänen)', () => {
    // Der Golden Master ist bereits eine Ableitung mit stabiler Sortierung.
    // Dieser Test prüft die zweite Ableitungsebene: derselbe Plan, zweimal
    // aufbereitet, muss dasselbe Verdikt ergeben.
    const name = 'acdc';
    const plan = GOLDEN_PLANS[name];
    if (!plan) throw new Error(`Unbekannter Referenzplan: ${name}`);
    const first = captureGoldenMaster(plan);
    const second = captureGoldenMaster(plan);
    expect(second.autoWire.edges.map((edge) => edge.id)).toEqual(first.autoWire.edges.map((edge) => edge.id));
    expect(evaluate(name).certificateHash).toBe(evaluate(name).certificateHash);
  });

  it('jedes Verdikt ist INCOMPLETE oder NON_COMPLIANT — beide sind Befunde, kein Freibrief', () => {
    for (const [name, snapshot] of Object.entries(SNAPSHOT)) {
      expect(['INCOMPLETE', 'NON_COMPLIANT'], name).toContain(snapshot.verdict);
      expect(snapshot.decisionRatio, name).toBeLessThan(1);
    }
  });
});
