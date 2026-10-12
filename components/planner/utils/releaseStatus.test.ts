import { describe, it, expect } from 'vitest';
import { assessRelease, isBlockingFinding, DOCUMENT_STATUS_LABEL } from './releaseStatus';
import type { VerificationSummary } from './verificationWarnings';
import type { ValidationWarning } from '../hooks/useLiveValidation';

function finding(overrides: Partial<ValidationWarning>): ValidationWarning {
  return {
    id: 'f',
    category: 'safety',
    type: 'warning',
    message: 'Warnung: test',
    ...overrides,
  };
}

function summary(overrides: Partial<VerificationSummary>): VerificationSummary {
  return {
    verdict: 'COMPLIANT',
    label: 'Bestanden',
    tone: 'ok',
    headline: '',
    exercised: 5,
    notApplicable: 0,
    passed: 5,
    failed: 0,
    unprovable: 0,
    decisionRatio: 1,
    certificateHash: 'cert-1',
    planFingerprintHash: 'plan-1',
    engineVersion: 'test',
    profile: 'test',
    context: 'test',
    passes: [],
    notAppliedRules: [],
    limitations: [],
    findings: [],
    ...overrides,
  };
}

describe('assessRelease — ein zentraler Freigabestatus', () => {
  it('leerer Plan ist Entwurf und darf kein Dokument erzeugen', () => {
    const result = assessRelease(null, 0);
    expect(result.status).toBe('entwurf');
    expect(result.canExportDocument).toBe(false);
    expect(result.planFingerprintHash).toBeNull();
  });

  it('bestandene Software-Prüfung ist „Softwareprüfung bestanden“, nie „freigegeben“', () => {
    const result = assessRelease(summary({}), 3);
    expect(result.status).toBe('softwaregeprueft');
    expect(result.label).toBe(DOCUMENT_STATUS_LABEL.softwaregeprueft);
    expect(result.label).not.toMatch(/freigegeben|zertifiziert|normgerecht/i);
    expect(result.explanation).toMatch(/keine Verletzung/);
    expect(result.explanation).toMatch(/ersetzt weder/);
    expect(result.canExportDocument).toBe(true);
    expect(result.planFingerprintHash).toBe('plan-1');
  });

  it('kritische, verletzte Befunde sperren Dokumente', () => {
    const result = assessRelease(
      summary({
        verdict: 'NON_COMPLIANT',
        tone: 'bad',
        failed: 1,
        findings: [finding({ type: 'critical', status: 'violated', message: 'Kritisch: Kabel zu lang' })],
      }),
      3
    );
    expect(result.status).toBe('gesperrt');
    expect(result.canExportDocument).toBe(false);
    expect(result.blockers).toEqual(['Kritisch: Kabel zu lang']);
  });

  it('nicht entscheidbare Regeln ergeben Entwurf, aber kein Sperren', () => {
    const result = assessRelease(summary({ verdict: 'INCOMPLETE', tone: 'warn', unprovable: 2 }), 3);
    expect(result.status).toBe('entwurf');
    expect(result.canExportDocument).toBe(true);
    expect(result.explanation).toMatch(/nicht entscheidbar/);
  });

  it('nicht verletzte Warnungen sperren nicht', () => {
    const result = assessRelease(
      summary({ verdict: 'NON_COMPLIANT', tone: 'bad', findings: [finding({ type: 'warning' })] }),
      3
    );
    expect(result.status).toBe('entwurf');
    expect(result.blockers).toEqual([]);
    expect(result.openPoints).toBe(1);
  });
});

describe('isBlockingFinding', () => {
  it('sperrt nur kritische Befunde im Zustand „verletzt“', () => {
    expect(isBlockingFinding(finding({ type: 'critical', status: 'violated' }))).toBe(true);
    expect(isBlockingFinding(finding({ type: 'critical' }))).toBe(true);
    expect(isBlockingFinding(finding({ type: 'critical', status: 'incomplete' }))).toBe(false);
    expect(isBlockingFinding(finding({ type: 'warning', status: 'violated' }))).toBe(false);
    expect(isBlockingFinding(finding({ type: 'info' }))).toBe(false);
  });
});
