import { describe, it, expect } from 'vitest';
import { buildPrintReportHtml, escapeHtml } from './printReport';
import { assessRelease } from './releaseStatus';
import type { BomData } from './bom';
import type { VerificationSummary } from './verificationWarnings';
import type { ValidationWarning } from '../hooks/useLiveValidation';

const bom: BomData = {
  counts: { battery: 1, consumer: 1 },
  cableLengths: { '4': 2.5 },
  pipeLengths: {},
  lengthAssumptions: [],
};

function summary(overrides: Partial<VerificationSummary> = {}): VerificationSummary {
  return {
    verdict: 'COMPLIANT',
    label: 'Bestanden',
    tone: 'ok',
    headline: 'Gegen die angewandten Regeln bestehen die geprüften Punkte.',
    exercised: 4,
    notApplicable: 1,
    passed: 4,
    failed: 0,
    unprovable: 0,
    decisionRatio: 1,
    certificateHash: 'cert-abc',
    planFingerprintHash: 'plan-xyz',
    engineVersion: 'engine-test',
    profile: 'p',
    context: 'c',
    passes: [],
    notAppliedRules: [],
    limitations: ['Modellgrenze: Kabeltemperatur nicht gemessen.'],
    findings: [],
    ...overrides,
  };
}

function criticalFinding(message: string): ValidationWarning {
  return { id: 'x', category: 'safety', type: 'critical', status: 'violated', message };
}

function input(overrides: { summary?: VerificationSummary; bom?: BomData } = {}) {
  const sum = overrides.summary ?? summary();
  return {
    bom: overrides.bom ?? bom,
    summary: sum,
    assessment: assessRelease(sum, 2),
    generatedAt: '2026-10-12T10:00:00.000Z',
    projectName: 'Mein Camper',
  };
}

describe('escapeHtml', () => {
  it('escapt alle relevanten Zeichen', () => {
    expect(escapeHtml(`<script>alert("x")&'</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&amp;&#39;&lt;/script&gt;'
    );
  });
});

describe('buildPrintReportHtml', () => {
  it('nennt Status, Planstand, Engine und Modellgrenzen', () => {
    const html = buildPrintReportHtml(input());
    expect(html).toContain('Softwareprüfung bestanden (keine Freigabe)');
    expect(html).toContain('plan-xyz');
    expect(html).toContain('engine-test');
    expect(html).toContain('Modellgrenze: Kabeltemperatur nicht gemessen.');
    expect(html).toContain('2,5'); // Längen mit deutschem Komma
  });

  it('enthält immer den Hinweis, dass dies keine Abnahme ist', () => {
    const html = buildPrintReportHtml(input());
    expect(html).toMatch(/ersetzt keine Prüfung durch eine qualifizierte Elektrofachkraft/);
    expect(html).not.toMatch(/normgerecht|zertifiziert|freigegeben/i);
  });

  it('gesperrter Plan: keine Stückliste, nur die kritischen Befunde', () => {
    const blocked = summary({
      verdict: 'NON_COMPLIANT',
      tone: 'bad',
      failed: 1,
      findings: [criticalFinding('Kritisch: Kabel ohne Schutzorgan')],
    });
    const html = buildPrintReportHtml(input({ summary: blocked }));
    expect(html).toContain('Gesperrt – kritische Befunde');
    expect(html).toContain('Kritisch: Kabel ohne Schutzorgan');
    expect(html).toContain('werden nicht ausgegeben');
    expect(html).not.toContain('<h2>Stückliste</h2>');
    expect(html).not.toContain('Leitung 4 mm²');
  });

  it('escapt Nutzerbezeichnungen (kein Skript im Bericht)', () => {
    const evil: BomData = { ...bom, counts: { '<img src=x onerror=alert(1)>': 1 } };
    const html = buildPrintReportHtml(input({ bom: evil }));
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('erzeugt ohne Prüfung einen ehrlichen Hinweis statt eines Prüfergebnisses', () => {
    const html = buildPrintReportHtml({
      bom: { counts: {}, cableLengths: {}, pipeLengths: {}, lengthAssumptions: [] },
      summary: null,
      assessment: assessRelease(null, 0),
      generatedAt: '2026-10-12T10:00:00.000Z',
      projectName: 'Leer',
    });
    expect(html).toContain('Keine Prüfung vorhanden.');
    expect(html).toContain('Entwurf');
  });
});
