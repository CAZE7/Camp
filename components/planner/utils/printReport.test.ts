import { describe, it, expect, vi } from 'vitest';
import { buildPrintReportHtml, escapeHtml, openPrintReport } from './printReport';
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

/**
 * QA B-08: Der Reiter trägt den Berichtstitel schon vor dem Schreiben, und der
 * Druck startet nach dem Laden — genau einmal.
 */
describe('openPrintReport · Reiter und Druckstart (B-08)', () => {
  it('setzt den Titel vor dem Schreiben und druckt nach load genau einmal', () => {
    const order: string[] = [];
    let onLoad: (() => void) | undefined;
    let timer: (() => void) | undefined;
    const print = vi.fn(() => order.push('print'));
    const fakeWin = {
      opener: 'x' as unknown,
      document: {
        title: '',
        open: () => order.push('open'),
        write: () => order.push('write'),
        close: () => order.push('close'),
      },
      print,
      setTimeout: (fn: () => void) => {
        timer = fn;
        return 1;
      },
      addEventListener: (event: string, fn: () => void) => {
        if (event === 'load') onLoad = fn;
      },
    };
    const titleSet = vi.fn(() => order.push('title'));
    Object.defineProperty(fakeWin.document, 'title', {
      set: titleSet,
      get: () => '',
    });
    vi.stubGlobal('window', { ...globalThis.window, open: vi.fn(() => fakeWin) });

    const ok = openPrintReport(
      '<html><head><title>Projekt &amp; Co – Planungsbericht</title></head><body></body></html>'
    );

    expect(ok).toBe(true);
    expect(titleSet).toHaveBeenCalledWith('Projekt & Co – Planungsbericht');
    expect(order.indexOf('title')).toBeLessThan(order.indexOf('write'));
    expect(print).not.toHaveBeenCalled();

    onLoad?.();
    timer?.();
    expect(print).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

/**
 * AUD-004 — der Bericht war eine Einkaufsliste ohne Schaltplan.
 *
 * Stückliste/Prüfbericht und Planbild waren zwei getrennte Exporte und konnten
 * auseinanderlaufen. Jetzt bettet der Bericht den Plan aus DEMSELBEN Snapshot
 * ein. Ein gesperrter Plan gibt weiterhin kein Dokument heraus, und ein
 * fehlgeschlagene Aufnahme wird benannt statt still verschwiegen.
 */
describe('buildPrintReportHtml — AUD-004 Schaltplan im Bericht', () => {
  const planImage = { dataUrl: 'data:image/png;base64,AAAA', width: 1200, height: 800 };

  it('bettet den Schaltplan ein', () => {
    const html = buildPrintReportHtml({ ...input(), planImage });
    expect(html).toContain('<h2>Schaltplan</h2>');
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).toContain('alt="Schaltplan der geplanten Elektroinstallation"');
  });

  it('setzt den Plan auf eine eigene Seite und beschneidet ihn nicht', () => {
    const html = buildPrintReportHtml({ ...input(), planImage });
    expect(html).toContain('.plan-sheet { break-before: page; }');
    expect(html).toContain('object-fit: contain');
  });

  it('nennt einen Aufnahmefehler ausdrücklich statt das Bild zu verschweigen', () => {
    const html = buildPrintReportHtml({
      ...input(),
      planImageError: 'Aufnahme fehlgeschlagen (SecurityError).',
    });
    expect(html).toContain('Kein Schaltplanbild in diesem Bericht.');
    expect(html).toContain('SecurityError');
    expect(html).not.toContain('<img');
  });

  it('gibt auch ohne Bild einen Hinweis auf den getrennten Bild-Export', () => {
    const html = buildPrintReportHtml(input());
    expect(html).toContain('Kein Schaltplanbild in diesem Bericht.');
    expect(html).toContain('Plan als Bild exportieren');
  });

  it('zeigt bei gesperrtem Plan weder Stückliste noch Schaltplan', () => {
    const blocked = summary({
      verdict: 'NON_COMPLIANT',
      failed: 1,
      passed: 0,
      findings: [criticalFinding('Sicherung zu groß für die Leitung.')],
    });
    const html = buildPrintReportHtml({ ...input({ summary: blocked }), planImage });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('src="data:image/png');
    expect(html).toContain('werden nicht ausgegeben');
  });

  it('escaped die Data-URL (kein Attribut-Ausbruch)', () => {
    const html = buildPrintReportHtml({
      ...input(),
      planImage: { ...planImage, dataUrl: 'data:image/png;base64,AA" onload="alert(1)' },
    });
    expect(html).not.toContain('onload="alert(1)');
    expect(html).toContain('&quot;');
  });
});
