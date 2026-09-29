import { describe, expect, it } from 'vitest';

import { healthyDcPlan, islandPlan, shorePlan, type FixturePlan } from '../../../lib/verify/planFixtures';
import {
  isCoverageEvent,
  verifyPlan,
  type AuditEvent,
  type VerificationReport,
  type VerificationVerdict,
} from '../../../lib/verify';
import {
  PLANNER_VERIFICATION_OPTIONS,
  verificationReportFor,
  verificationSummary,
  verificationWarning,
  verificationWarnings,
} from './verificationWarnings';

/**
 * ÜBERSETZUNG ENGINE → ANZEIGE.
 *
 * Diese Datei prüft die Naht zwischen `lib/verify` und der Warn-Zentrale:
 *
 *   1. Felder: Aus einem Audit-Ereignis wird genau dann ein kritischer Befund,
 *      wenn die Engine eine Verletzung mit Sicherheitsfolge meldet — eine
 *      DATENLÜCKE (UNVERIFIABLE) wird als Hinweis geführt, nie als Verletzung.
 *   2. Abdeckung: Ereignisse, die nur sagen „diese Regel hatte keine Eingabe“,
 *      erscheinen NICHT als Prüfhinweis (sie zählen im Prüfsiegel).
 *   3. Plan: Ein leerer Plan erzeugt keine Hinweise, ein unvollständiger Plan
 *      erzeugt einen als unvollständig ausgewiesenen Bericht (INCOMPLETE), und
 *      ein fertiger Plan liefert einen bestandenen — jeweils mit den Zahlen der
 *      Engine, nicht mit einer zweiten Rechnung.
 */
const plan = (fixture: FixturePlan) => verificationReportFor(fixture.nodes as never, fixture.edges as never);

const event = (over: Partial<AuditEvent> = {}): AuditEvent => ({
  ruleId: 'AMP-001-ib-in-iz',
  severity: 'CODE_VIOLATION',
  kind: 'VIOLATION',
  standard: 'IEC 60364-4-43 (DIN VDE 0100-430)',
  clause: '§433.1 Bedingung (1)',
  provenance: 'VERIFIED_NORM',
  entity: { kind: 'edge', id: 'e1' },
  equation: 'I_b ≤ I_n ≤ I_z',
  calculatedValue: 32,
  allowedLimit: 20,
  unit: 'A',
  message: 'Kabel A → B: 32 A über dem Grenzwert 20 A.',
  autoFixRemedy: 'Sicherung auf 20 A setzen oder Querschnitt erhöhen.',
  ...over,
});

describe('verificationWarning — ein Ereignis, ein Befund', () => {
  it('überträgt Schwere, Werte, Einheit, Herkunft und Abhilfe', () => {
    const warning = verificationWarning(event(), 0);

    expect(warning).toEqual(
      expect.objectContaining({
        id: 'verify-AMP-001-ib-in-iz-edge-e1-0',
        category: 'safety',
        type: 'warning',
        focusId: 'e1',
        focusType: 'edge',
        ruleId: 'AMP-001-ib-in-iz',
        measuredValue: '32',
        expectedValue: '20',
        unit: 'A',
        remedy: 'Sicherung auf 20 A setzen oder Querschnitt erhöhen.',
      })
    );
    expect(warning.source).toContain('DIN VDE 0100-430');
    expect(warning.source).toContain('Norm');
    expect(warning.unverified).toBeUndefined();
  });

  it('stuft CRITICAL_SAFETY als kritisch ein', () => {
    const warning = verificationWarning(event({ severity: 'CRITICAL_SAFETY' }), 1);
    expect(warning.type).toBe('critical');
    expect(warning.message).toContain('Kritisch');
  });

  it('stuft eine DATENLÜCKE als Hinweis ein — nicht als Verletzung', () => {
    const gap = verificationWarning(
      event({
        kind: 'UNVERIFIABLE',
        severity: 'CRITICAL_SAFETY',
        entity: { kind: 'node', id: 'conduit1' },
        calculatedValue: null,
        allowedLimit: null,
        unit: '',
        message: 'Leerrohr: für Kabel e-1 fehlt der Querschnitt — der Füllgrad wäre geraten.',
        autoFixRemedy: 'Querschnitt des zugeordneten Kabels eintragen.',
      }),
      2
    );

    expect(gap.type).toBe('info');
    expect(gap.category).toBe('estimation');
    expect(gap.unverified).toBe(true);
    expect(gap.focusId).toBe('conduit1');
    expect(gap.focusType).toBe('node');
    expect(gap.measuredValue).toBeUndefined();
    expect(gap.expectedValue).toBeUndefined();
    expect(gap.message).toContain('Hinweis');
  });

  it('lässt planweite Ereignisse ohne anklickbares Ziel ohne Fokus', () => {
    const warning = verificationWarning(event({ entity: { kind: 'system', id: 'plan' } }), 3);
    expect(warning.focusId).toBeUndefined();
    expect(warning.focusType).toBeUndefined();
  });

  it('formatiert Zahlen deutsch und hängt die Einheit nicht doppelt an', () => {
    const warning = verificationWarning(
      event({ calculatedValue: 117.1875, allowedLimit: 90, unit: 'Ah' }),
      4
    );
    expect(warning.measuredValue).toBe('117,19');
    expect(warning.expectedValue).toBe('90');
    expect(warning.unit).toBe('Ah');
  });

  it('nennt die Klausel nicht zweimal, wenn sie schon im Normtext steht', () => {
    const warning = verificationWarning(
      event({ standard: 'ISO 10133:2000 §8.1 (200 mm); CAMP-Planungsvorgabe', clause: '§8.1' }),
      5
    );
    expect(warning.source?.match(/§8\.1/g)).toHaveLength(1);
  });
});

describe('verificationWarnings — Abdeckungs-Ereignisse sind keine Prüfhinweise', () => {
  it('liefert für einen leeren Plan keine Hinweise', () => {
    const report = verificationReportFor([], []);
    expect(report.events.some(isCoverageEvent)).toBe(true); // die Engine weist die Lücken aus …
    expect(verificationWarnings(report)).toEqual([]); // … aber nicht als Prüfhinweis
  });

  it('behält Befunde mit Eingabe und wirft nur die Abdeckungs-Auskunft weg', () => {
    const report: VerificationReport = {
      ...verificationReportFor([], []),
      events: [
        event(),
        event({ ruleId: 'SYN-001-dangling-endpoint', kind: 'UNVERIFIABLE', coverageOnly: true }),
      ],
    };
    const warnings = verificationWarnings(report);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.ruleId).toBe('AMP-001-ib-in-iz');
  });
});

describe('verificationReportFor — der Plan wird geprüft, nicht geglättet', () => {
  it('prüft gegen das Praxisprofil im Kontext Fahrzeug', () => {
    expect(PLANNER_VERIFICATION_OPTIONS).toEqual({ profile: 'PRACTICE', context: 'VEHICLE' });
    const report = plan(healthyDcPlan());
    expect(report.certificate.profile).toBe('PRACTICE');
    expect(report.certificate.context).toBe('VEHICLE');
    // Das Praxisprofil deckt die gesamte Matrix ab: Es darf keine Regel wegen
    // Profil oder Kontext ausfallen, sonst prüfte die Anzeige weniger als der
    // Bericht behauptet (Regeln ohne Gegenstand sind etwas anderes und werden
    // als Lücke ausgewiesen).
    expect(report.limitations.some((line) => line.startsWith('Nicht angewandt (Profil/Kontext)'))).toBe(
      false
    );
    expect(report.coverage.rulesApplied).toBe(29);
  });

  it('ist deterministisch (gleicher Plan ⇒ gleiches Zertifikat)', () => {
    const first = plan(healthyDcPlan());
    const second = plan(healthyDcPlan());
    expect(first.certificate.certificateHash).toBe(second.certificate.certificateHash);
    expect(first.certificate.planFingerprintHash).toBe(second.certificate.planFingerprintHash);
  });

  it('meldet einen fehlerfreien Plan als bestanden — und weist die Modellgrenzen mit aus', () => {
    const summary = verificationSummary(plan(healthyDcPlan()));
    expect(summary.verdict).toBe('COMPLIANT');
    expect(summary.tone).toBe('ok');
    expect(summary.failed).toBe(0);
    expect(summary.unprovable).toBe(0);
    expect(summary.limitations.length).toBeGreaterThan(0);
    expect(summary.passes).toHaveLength(5);
  });

  it('meldet einen unvollständigen Plan als »unvollständig belegt«, nicht als bestanden', () => {
    const report = verifyPlan({
      nodes: [{ id: 'b', type: 'battery', data: { label: 'Batterie' } }] as never,
      edges: [] as never,
      options: { ...PLANNER_VERIFICATION_OPTIONS },
    });
    const summary = verificationSummary(report);
    expect(summary.verdict).toBe('INCOMPLETE');
    expect(summary.tone).toBe('warn');
    expect(summary.label).toBe('Unvollständig belegt');
    expect(summary.headline).toContain('nicht entscheidbar');
  });

  it('stuft ein unbekanntes Verdikt nie als bestanden ein', () => {
    // Absicherung gegen eine stille Aufwertung: Nur das ausdrückliche
    // COMPLIANT heißt »Bestanden« — jede andere (auch eine künftige) Stufe
    // wird als nicht bestanden gezeigt.
    const bogus = { ...plan(healthyDcPlan()), verdict: 'SOMETHING' as VerificationVerdict };
    const summary = verificationSummary(bogus);
    expect(summary.label).toBe('Nicht bestanden');
    expect(summary.tone).toBe('bad');
  });

  it('meldet eine Verletzung als »nicht bestanden« und führt sie zuerst', () => {
    const report = verifyPlan({
      nodes: [
        { id: 'inv', type: 'inverter', data: { label: 'Wechselrichter', hasRcd: false } },
        { id: 'c1', type: 'consumer230v', data: { label: 'Verbraucher' } },
      ] as never,
      edges: [
        {
          id: 'e1',
          source: 'inv',
          target: 'c1',
          sourceHandle: 'acOut',
          targetHandle: 'acIn',
          data: { edgeDomain: 'AC_230V' },
        },
      ] as never,
      options: { ...PLANNER_VERIFICATION_OPTIONS },
    });
    const summary = verificationSummary(report);
    expect(summary.verdict).toBe('NON_COMPLIANT');
    expect(summary.tone).toBe('bad');
    expect(summary.label).toBe('Nicht bestanden');
    expect(summary.findings.length).toBeGreaterThan(0);
    expect(summary.findings[0]?.type).toBe('critical');
    // Jeder Befund nennt eine Handlung — sonst wäre er eine Sackgasse.
    for (const finding of summary.findings) expect(finding.remedy?.length ?? 0).toBeGreaterThan(10);
  });

  it('meldet die Energiebilanz-Lücke eines reinen 230-V-Plans als Hinweis ohne Fokus', () => {
    // Der Landstrom-Plan hat keine Aufbaubatterie: Die Engine sagt das als
    // »nicht entscheidbar« — sie erfindet keine Kapazität und meldet auch
    // keinen Pass. Anklickbar ist der Hinweis nicht (er betrifft den Plan).
    const warnings = verificationWarnings(plan(shorePlan()));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.ruleId).toBe('PWR-001-energy-balance');
    expect(warnings[0]?.type).toBe('info');
    expect(warnings[0]?.unverified).toBe(true);
    expect(warnings[0]?.focusId).toBeUndefined();
  });

  it('verlinkt die kritischen Befunde des Inselplans auf die betroffenen Leitungen', () => {
    const report = plan(islandPlan());
    const summary = verificationSummary(report);
    expect(summary.verdict).toBe('NON_COMPLIANT');
    expect(summary.tone).toBe('bad');
    const critical = summary.findings.filter((finding) => finding.type === 'critical');
    expect(critical.length).toBeGreaterThan(0);
    // Die gefährlichste Aussage steht oben und zeigt auf ein Bauteil, damit
    // »Beheben« den Nutzer dorthin führt.
    expect(critical[0]?.ruleId).toBe('AMP-001-ib-in-iz');
    expect(critical[0]?.focusType).toBe('edge');
    expect(critical.some((finding) => finding.ruleId === 'RCD-001-rcd-deviation')).toBe(true);
    expect(summary.findings.some((finding) => finding.unverified === true)).toBe(true);
  });
});
